package handler

import (
	"encoding/json"
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

// RemoteHandler provides REST API handlers for remote agent management
// and a WebSocket endpoint for real-time agent status updates.
type RemoteHandler struct {
	store     *remote.Store
	sshServer *sshserver.Server
	proxy     *remote.Proxy
	cfg       *config.AppConfig

	// WebSocket broadcast
	wsMu      sync.Mutex
	wsClients []*websocket.Conn
}

// NewRemoteHandler creates a RemoteHandler and wires the SSH server's
// agent change callback to broadcast status updates via WebSocket.
func NewRemoteHandler(store *remote.Store, sshServer *sshserver.Server, proxy *remote.Proxy, cfg *config.AppConfig) *RemoteHandler {
	h := &RemoteHandler{
		store:     store,
		sshServer: sshServer,
		proxy:     proxy,
		cfg:       cfg,
	}

	// Wire SSH server agent change notification to WebSocket broadcast
	if sshServer != nil {
		sshServer.SetOnAgentChange(func() {
			h.broadcastAgentStatus()
		})
	}

	return h
}

// agentResponse is the merged agent view combining token store and SSH connection state.
type agentResponse struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Online        bool      `json:"online"`
	Arch          string    `json:"arch,omitempty"`
	MihomoVer     string    `json:"mihomo_ver,omitempty"`
	IP            string    `json:"ip,omitempty"`
	UptimeSec     int64     `json:"uptime_sec,omitempty"`
	LastHeartbeat time.Time `json:"last_heartbeat,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

// ListAgents returns a merged list of registered agents with online/offline status.
// GET /api/remote/agents
func (h *RemoteHandler) ListAgents(w http.ResponseWriter, r *http.Request) {
	tokens := h.store.List()

	var onlineAgents []sshserver.AgentInfo
	if h.sshServer != nil {
		onlineAgents = h.sshServer.GetAllAgents()
	}

	// Build online lookup by agent ID
	onlineMap := make(map[string]sshserver.AgentInfo, len(onlineAgents))
	for _, a := range onlineAgents {
		onlineMap[a.ID] = a
	}

	result := make([]agentResponse, 0, len(tokens))
	for _, t := range tokens {
		if t.Revoked {
			continue
		}
		resp := agentResponse{
			ID:        t.ID,
			Name:      t.Name,
			CreatedAt: t.CreatedAt,
		}
		if agent, ok := onlineMap[t.ID]; ok {
			resp.Online = true
			resp.Name = agent.Name // prefer heartbeat name
			resp.Arch = agent.Arch
			resp.MihomoVer = agent.MihomoVer
			resp.IP = agent.IP
			resp.UptimeSec = agent.Uptime
			resp.LastHeartbeat = agent.LastHeartbeat
		}
		result = append(result, resp)
	}

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

// DeleteAgent permanently removes an agent token.
// DELETE /api/remote/agents/{id}
func (h *RemoteHandler) DeleteAgent(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.store.Delete(id); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusNoContent)
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

// getAgentList returns the merged agent list for WebSocket broadcast.
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
	for _, t := range tokens {
		if t.Revoked {
			continue
		}
		resp := agentResponse{
			ID:        t.ID,
			Name:      t.Name,
			CreatedAt: t.CreatedAt,
		}
		if agent, ok := onlineMap[t.ID]; ok {
			resp.Online = true
			resp.Name = agent.Name
			resp.Arch = agent.Arch
			resp.MihomoVer = agent.MihomoVer
			resp.IP = agent.IP
			resp.UptimeSec = agent.Uptime
			resp.LastHeartbeat = agent.LastHeartbeat
		}
		result = append(result, resp)
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
