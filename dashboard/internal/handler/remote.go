package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"

	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
	"github.com/mewbing/XKeen-UI-XMeow/internal/remote"
	"github.com/mewbing/XKeen-UI-XMeow/internal/sshserver"
)

// directAgentMeta holds dynamic metadata fetched from a remote xmeow-server.
// Kept in memory only (not persisted) — refreshed every probe cycle.
type directAgentMeta struct {
	Arch      string
	MihomoVer string
	IP        string
	UptimeSec int64
	LastProbe time.Time
}

// RemoteHandler provides REST API handlers for remote agent management
// and a WebSocket endpoint for real-time agent status updates.
type RemoteHandler struct {
	store       *remote.Store
	directStore *remote.DirectStore
	sshServer   *sshserver.Server
	proxy       *remote.Proxy
	cfg         *config.AppConfig

	// WebSocket broadcast
	wsMu      sync.Mutex
	wsClients []*websocket.Conn

	// In-memory metadata for direct agents (fetched from xmeow-server)
	metaMu sync.RWMutex
	meta   map[string]*directAgentMeta

	// Background probe lifecycle
	stopCh chan struct{}
}

// NewRemoteHandler creates a RemoteHandler and wires the SSH server's
// agent change callback to broadcast status updates via WebSocket.
func NewRemoteHandler(store *remote.Store, directStore *remote.DirectStore, sshServer *sshserver.Server, proxy *remote.Proxy, cfg *config.AppConfig) *RemoteHandler {
	h := &RemoteHandler{
		store:       store,
		directStore: directStore,
		sshServer:   sshServer,
		proxy:       proxy,
		cfg:         cfg,
		meta:        make(map[string]*directAgentMeta),
		stopCh:      make(chan struct{}),
	}

	// Wire SSH server agent change notification to WebSocket broadcast
	if sshServer != nil {
		sshServer.SetOnAgentChange(func() {
			h.broadcastAgentStatus()
		})
	}

	// Start background xmeow-server probe for direct agents
	if directStore != nil {
		go h.probeServerLoop()
	}

	return h
}

// Shutdown stops background goroutines (server probe, etc).
func (h *RemoteHandler) Shutdown() {
	close(h.stopCh)
}

// agentResponse is the merged agent view combining token store, SSH connection state,
// and direct connections.
type agentResponse struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Online        bool      `json:"online"`
	Type          string    `json:"type"` // "tunnel" or "direct"
	Arch          string    `json:"arch,omitempty"`
	MihomoVer     string    `json:"mihomo_ver,omitempty"`
	XkeenVer      string    `json:"xkeen_ver,omitempty"`
	AgentVer      string    `json:"agent_ver,omitempty"`
	IP            string    `json:"ip,omitempty"`
	Host          string    `json:"host,omitempty"`
	MihomoPort    int       `json:"mihomo_port,omitempty"`
	ServerPort    int       `json:"server_port,omitempty"`
	HasServer     bool      `json:"has_server,omitempty"`
	UptimeSec     int64     `json:"uptime_sec,omitempty"`
	LastHeartbeat time.Time `json:"last_heartbeat,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

// ListAgents returns a merged list of registered agents (tunnel + direct) with online/offline status.
// GET /api/remote/agents
func (h *RemoteHandler) ListAgents(w http.ResponseWriter, r *http.Request) {
	result := h.getAgentList()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// createTokenRequest is the JSON body for token creation.
type createTokenRequest struct {
	Name string `json:"name"`
}

// CreateToken generates a new agent token.
// POST /api/remote/tokens
func (h *RemoteHandler) CreateToken(w http.ResponseWriter, r *http.Request) {
	var req createTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid JSON body"})
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "name is required"})
		return
	}

	token, err := h.store.Create(req.Name)
	if err != nil {
		log.Printf("[Remote] Create token failed: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to create token"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(token)
}

// ListTokens returns all registered tokens with masked token values.
// GET /api/remote/tokens
func (h *RemoteHandler) ListTokens(w http.ResponseWriter, r *http.Request) {
	tokens := h.store.List()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tokens)
}

// RevokeToken marks a token as revoked (can no longer authenticate).
// DELETE /api/remote/tokens/{id}
func (h *RemoteHandler) RevokeToken(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.store.Revoke(id); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteAgent permanently removes an agent (tunnel token or direct connection).
// DELETE /api/remote/agents/{id}
func (h *RemoteHandler) DeleteAgent(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Try token store first
	if err := h.store.Delete(id); err == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Try direct store
	if h.directStore != nil {
		if err := h.directStore.Delete(id); err == nil {
			h.broadcastAgentStatus()
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotFound)
	json.NewEncoder(w).Encode(map[string]string{"error": "agent not found"})
}

// createDirectRequest is the JSON body for adding a direct agent.
type createDirectRequest struct {
	Name       string `json:"name"`
	Host       string `json:"host"`
	MihomoPort int    `json:"mihomo_port"`
	ServerPort int    `json:"server_port"`
	Secret     string `json:"secret"`
}

// CreateDirect adds a direct agent connection by IP:port.
// Tests the connection first by probing mihomo's /version endpoint.
// POST /api/remote/direct
func (h *RemoteHandler) CreateDirect(w http.ResponseWriter, r *http.Request) {
	var req createDirectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid JSON body"})
		return
	}

	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Host) == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "name and host are required"})
		return
	}

	if req.MihomoPort <= 0 || req.MihomoPort > 65535 {
		req.MihomoPort = 9090
	}
	if req.ServerPort < 0 || req.ServerPort > 65535 {
		req.ServerPort = 0
	}

	// Test connection to mihomo before saving
	if err := testMihomoConnection(req.Host, req.MihomoPort, req.Secret); err != nil {
		log.Printf("[Remote] Connection test to %s:%d failed: %v", req.Host, req.MihomoPort, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	// Auto-detect xmeow-server on port 5000 if user didn't specify
	if req.ServerPort == 0 {
		if probeXmeowServer(req.Host, 5000) {
			req.ServerPort = 5000
			log.Printf("[Remote] Auto-detected xmeow-server at %s:5000", req.Host)
		}
	}

	agent, err := h.directStore.Add(req.Name, req.Host, req.MihomoPort, req.ServerPort, req.Secret)
	if err != nil {
		log.Printf("[Remote] Create direct agent failed: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to create direct agent"})
		return
	}

	h.broadcastAgentStatus()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(agent)
}

// testMihomoConnection probes mihomo's /version endpoint to verify connectivity and auth.
func testMihomoConnection(host string, port int, secret string) error {
	url := fmt.Sprintf("http://%s:%d/version", host, port)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("Ошибка создания запроса: %v", err)
	}
	if secret != "" {
		req.Header.Set("Authorization", "Bearer "+secret)
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("Не удалось подключиться к %s:%d — проверьте адрес и порт", host, port)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		return nil // connection works
	case http.StatusUnauthorized:
		return fmt.Errorf("Неверный секрет mihomo (401 Unauthorized)")
	default:
		return fmt.Errorf("Неожиданный ответ от mihomo: %d", resp.StatusCode)
	}
}

// ProxyToAgent forwards to proxy.ProxyToAgent.
func (h *RemoteHandler) ProxyToAgent(w http.ResponseWriter, r *http.Request) {
	h.proxy.ProxyToAgent(w, r)
}

// ProxyToAgentMihomo forwards to proxy.ProxyToAgentMihomo.
func (h *RemoteHandler) ProxyToAgentMihomo(w http.ResponseWriter, r *http.Request) {
	h.proxy.ProxyToAgentMihomo(w, r)
}

// WsRemoteStatus handles WebSocket connections for real-time agent status updates.
// GET /ws/remote/status
func (h *RemoteHandler) WsRemoteStatus(w http.ResponseWriter, r *http.Request) {
	// Auth check (same pattern as ws_terminal.go)
	secret := config.GetMihomoSecret(h.cfg.MihomoConfigPath)
	if secret != "" {
		token := r.URL.Query().Get("token")
		if token == "" {
			token = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		}
		if token != secret {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized"})
			return
		}
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[Remote WS] Upgrade failed: %v", err)
		return
	}

	log.Printf("[Remote WS] Client connected")

	// Register client
	h.wsMu.Lock()
	h.wsClients = append(h.wsClients, conn)
	h.wsMu.Unlock()

	// Send current agent list on connect
	h.sendAgentStatus(conn)

	// Heartbeat ping to keep connection alive
	done := make(chan struct{})
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				if err := conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second)); err != nil {
					return
				}
			case <-done:
				return
			}
		}
	}()

	// Read loop (blocks until client disconnects)
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}

	// Cleanup
	close(done)
	h.removeClient(conn)
	conn.Close()
	log.Printf("[Remote WS] Client disconnected")
}

// sendAgentStatus sends the current agent list to a single WebSocket client.
func (h *RemoteHandler) sendAgentStatus(conn *websocket.Conn) {
	agents := h.getAgentList()
	data, err := json.Marshal(agents)
	if err != nil {
		return
	}
	_ = conn.WriteMessage(websocket.TextMessage, data)
}

// broadcastAgentStatus sends the current agent list to all connected WebSocket clients.
func (h *RemoteHandler) broadcastAgentStatus() {
	agents := h.getAgentList()
	data, err := json.Marshal(agents)
	if err != nil {
		return
	}

	h.wsMu.Lock()
	defer h.wsMu.Unlock()

	alive := h.wsClients[:0]
	for _, conn := range h.wsClients {
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			conn.Close()
			continue
		}
		alive = append(alive, conn)
	}
	h.wsClients = alive
}

// getAgentList returns the merged agent list (tunnel + direct) for API and WebSocket broadcast.
func (h *RemoteHandler) getAgentList() []agentResponse {
	tokens := h.store.List()

	var onlineAgents []sshserver.AgentInfo
	if h.sshServer != nil {
		onlineAgents = h.sshServer.GetAllAgents()
	}

	onlineMap := make(map[string]sshserver.AgentInfo, len(onlineAgents))
	for _, a := range onlineAgents {
		onlineMap[a.ID] = a
	}

	result := make([]agentResponse, 0, len(tokens))

	// Tunnel agents (from token store + SSH status)
	for _, t := range tokens {
		if t.Revoked {
			continue
		}
		resp := agentResponse{
			ID:        t.ID,
			Name:      t.Name,
			Type:      "tunnel",
			CreatedAt: t.CreatedAt,
		}
		if agent, ok := onlineMap[t.ID]; ok {
			resp.Online = true
			resp.Name = agent.Name
			resp.Arch = agent.Arch
			resp.MihomoVer = agent.MihomoVer
			resp.XkeenVer = agent.XkeenVer
			resp.AgentVer = agent.AgentVer
			resp.IP = agent.IP
			resp.UptimeSec = agent.Uptime
			resp.LastHeartbeat = agent.LastHeartbeat
		}
		result = append(result, resp)
	}

	// Direct agents (always reported as online — actual availability checked at proxy time)
	if h.directStore != nil {
		h.metaMu.RLock()
		for _, d := range h.directStore.List() {
			resp := agentResponse{
				ID:         d.ID,
				Name:       d.Name,
				Online:     true,
				Type:       "direct",
				IP:         d.Host,
				Host:       d.Host,
				MihomoPort: d.MihomoPort,
				ServerPort: d.ServerPort,
				HasServer:  d.ServerPort > 0,
				CreatedAt:  d.CreatedAt,
			}
			// Merge in-memory metadata from xmeow-server probe
			if m, ok := h.meta[d.ID]; ok {
				resp.Arch = m.Arch
				resp.MihomoVer = m.MihomoVer
				if m.IP != "" {
					resp.IP = m.IP
				}
				resp.UptimeSec = m.UptimeSec
				resp.LastHeartbeat = m.LastProbe
			}
			result = append(result, resp)
		}
		h.metaMu.RUnlock()
	}

	return result
}

// removeClient removes a WebSocket connection from the clients list.
func (h *RemoteHandler) removeClient(conn *websocket.Conn) {
	h.wsMu.Lock()
	defer h.wsMu.Unlock()

	for i, c := range h.wsClients {
		if c == conn {
			h.wsClients = append(h.wsClients[:i], h.wsClients[i+1:]...)
			return
		}
	}
}

// probeServerLoop periodically checks direct agents for xmeow-server availability.
// Agents without ServerPort get probed on port 5000; agents with ServerPort get verified.
func (h *RemoteHandler) probeServerLoop() {
	// Initial probe after 10 seconds (let everything initialize)
	select {
	case <-time.After(10 * time.Second):
		h.probeDirectAgentServers()
	case <-h.stopCh:
		return
	}

	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			h.probeDirectAgentServers()
		case <-h.stopCh:
			return
		}
	}
}

// probeDirectAgentServers checks all direct agents for xmeow-server.
// - If ServerPort == 0: probe port 5000, set if found.
// - If ServerPort > 0: verify still alive, fetch metadata.
func (h *RemoteHandler) probeDirectAgentServers() {
	if h.directStore == nil {
		return
	}
	agents := h.directStore.List()
	changed := false
	for _, a := range agents {
		// Get full (unmasked) secret for auth
		full := h.directStore.Get(a.ID)
		secret := ""
		if full != nil {
			secret = full.Secret
		}

		if a.ServerPort > 0 {
			// Verify existing server is still alive
			if !probeXmeowServer(a.Host, a.ServerPort) {
				if h.directStore.UpdateServerPort(a.ID, 0) {
					changed = true
					log.Printf("[Remote] xmeow-server at %s:%d is no longer reachable, clearing", a.Host, a.ServerPort)
				}
				h.metaMu.Lock()
				delete(h.meta, a.ID)
				h.metaMu.Unlock()
			} else {
				// Server is alive — fetch metadata
				meta := fetchAgentMeta(a.Host, a.ServerPort, secret)
				if meta != nil {
					h.metaMu.Lock()
					old := h.meta[a.ID]
					h.meta[a.ID] = meta
					h.metaMu.Unlock()
					if old == nil || old.MihomoVer != meta.MihomoVer || old.IP != meta.IP {
						changed = true
					}
				}
			}
		} else {
			// Try to discover xmeow-server on default port
			if probeXmeowServer(a.Host, 5000) {
				if h.directStore.UpdateServerPort(a.ID, 5000) {
					changed = true
					log.Printf("[Remote] Auto-detected xmeow-server at %s:5000", a.Host)
				}
				// Immediately fetch metadata
				meta := fetchAgentMeta(a.Host, 5000, secret)
				if meta != nil {
					h.metaMu.Lock()
					h.meta[a.ID] = meta
					h.metaMu.Unlock()
				}
			}
		}
	}
	if changed {
		h.broadcastAgentStatus()
	}
}

// probeXmeowServer tests if xmeow-server is reachable at host:port by hitting /api/health.
func probeXmeowServer(host string, port int) bool {
	reqURL := fmt.Sprintf("http://%s:%d/api/health", host, port)
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(reqURL)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// fetchAgentMeta fetches versions and network info from a remote xmeow-server.
// secret is the mihomo/xmeow-server Bearer token for authentication.
func fetchAgentMeta(host string, port int, secret string) *directAgentMeta {
	meta := &directAgentMeta{LastProbe: time.Now()}

	// Fetch /api/versions → arch, mihomo version (fast endpoint)
	versionsClient := &http.Client{Timeout: 5 * time.Second}
	if req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("http://%s:%d/api/versions", host, port), nil); err == nil {
		if secret != "" {
			req.Header.Set("Authorization", "Bearer "+secret)
		}
		if resp, err := versionsClient.Do(req); err == nil {
			defer resp.Body.Close()
			var data struct {
				Arch   string `json:"arch"`
				Mihomo string `json:"mihomo"`
			}
			if json.NewDecoder(resp.Body).Decode(&data) == nil {
				meta.Arch = data.Arch
				if data.Mihomo != "" && data.Mihomo != "unknown" {
					meta.MihomoVer = data.Mihomo
				}
			}
		}
	}

	// Fetch /api/system/network → ip, uptime (slow: does external IP lookup via curl)
	networkClient := &http.Client{Timeout: 15 * time.Second}
	if req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("http://%s:%d/api/system/network", host, port), nil); err == nil {
		if secret != "" {
			req.Header.Set("Authorization", "Bearer "+secret)
		}
		if resp, err := networkClient.Do(req); err == nil {
			defer resp.Body.Close()
			var data struct {
				IP     *string `json:"ip"`
				Uptime *int64  `json:"uptime"`
			}
			if json.NewDecoder(resp.Body).Decode(&data) == nil {
				if data.IP != nil {
					meta.IP = *data.IP
				}
				if data.Uptime != nil {
					meta.UptimeSec = *data.Uptime
				}
			}
		}
	}

	return meta
}
