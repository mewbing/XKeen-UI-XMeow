package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"

	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
	"github.com/mewbing/XKeen-UI-XMeow/internal/remote"
	"github.com/mewbing/XKeen-UI-XMeow/internal/sshserver"
	"github.com/mewbing/XKeen-UI-XMeow/internal/terminal"
)

// WsRemoteTerminalHandler handles WebSocket terminal connections to remote agents.
// Unlike the regular WsTerminalHandler which proxies through xmeow-server,
// this handler SSH-dials directly to the agent's port 22 — either through
// the SSH reverse tunnel (tunnel agents) or direct IP (direct agents).
// This works even when xmeow-server is not running on the remote router.
type WsRemoteTerminalHandler struct {
	sshServer   *sshserver.Server
	directStore *remote.DirectStore
	cfg         *config.AppConfig

	mu       sync.Mutex
	sessions map[string]*terminal.Session // agentID -> session
}

// NewWsRemoteTerminalHandler creates a new remote terminal handler.
func NewWsRemoteTerminalHandler(sshSrv *sshserver.Server, directStore *remote.DirectStore, cfg *config.AppConfig) *WsRemoteTerminalHandler {
	return &WsRemoteTerminalHandler{
		sshServer:   sshSrv,
		directStore: directStore,
		cfg:         cfg,
		sessions:    make(map[string]*terminal.Session),
	}
}

// resolveSSHTarget determines the SSH host:port for the given agent.
// For tunnel agents: 127.0.0.1:<tunneled_port_22>
// For direct agents: host:22
func (h *WsRemoteTerminalHandler) resolveSSHTarget(agentID string) (host string, port int, err error) {
	// Try SSH tunnel agent first
	if h.sshServer != nil {
		if agent := h.sshServer.GetAgent(agentID); agent != nil {
			localPort, ok := agent.GetLocalPort(22)
			if ok {
				return "127.0.0.1", localPort, nil
			}
			return "", 0, fmt.Errorf("agent %s has no port 22 tunnel", agentID)
		}
	}

	// Try direct agent
	if h.directStore != nil {
		if direct := h.directStore.Get(agentID); direct != nil {
			return direct.Host, 22, nil
		}
	}

	return "", 0, fmt.Errorf("agent %s not found", agentID)
}

// getSession returns the existing session for an agent, or nil.
// Cleans up dead sessions automatically.
func (h *WsRemoteTerminalHandler) getSession(agentID string) *terminal.Session {
	h.mu.Lock()
	defer h.mu.Unlock()

	sess, ok := h.sessions[agentID]
	if !ok {
		return nil
	}
	if !sess.Alive() {
		delete(h.sessions, agentID)
		return nil
	}
	return sess
}

// setSession stores a session for an agent.
func (h *WsRemoteTerminalHandler) setSession(agentID string, sess *terminal.Session) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.sessions[agentID] = sess
}

// ServeHTTP validates auth, upgrades to WebSocket, and runs the terminal loop.
func (h *WsRemoteTerminalHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	agentID := chi.URLParam(r, "agentID")
	if agentID == "" {
		http.Error(w, "missing agentID", http.StatusBadRequest)
		return
	}

	// Auth check before WebSocket upgrade
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
		log.Printf("[Remote Terminal WS] Upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("[Remote Terminal WS] Client connected for agent %s", agentID)

	// Output goroutine management
	var (
		outputCancel context.CancelFunc
		outputWg     sync.WaitGroup
	)

	// If session already alive, start reading output
	if sess := h.getSession(agentID); sess != nil {
		outputCancel = startRemoteOutputReader(conn, sess, &outputWg)
	}

	defer func() {
		if outputCancel != nil {
			outputCancel()
			outputWg.Wait()
		}
		log.Printf("[Remote Terminal WS] Client handler exited for agent %s", agentID)
	}()

	// Read loop
	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("[Remote Terminal WS] Unexpected close: %v", err)
			}
			break
		}

		switch msgType {
		case websocket.BinaryMessage:
			// Terminal input -> session stdin
			if sess := h.getSession(agentID); sess != nil {
				if _, err := sess.Write(data); err != nil {
					log.Printf("[Remote Terminal WS] Write to session failed: %v", err)
				}
			}

		case websocket.TextMessage:
			var cmd termCmd
			if err := json.Unmarshal(data, &cmd); err != nil {
				log.Printf("[Remote Terminal WS] Invalid JSON: %v", err)
				continue
			}

			switch cmd.Type {
			case "connect":
				h.handleRemoteConnect(conn, agentID, &cmd, &outputCancel, &outputWg)

			case "exec":
				// Remote exec: validate against whitelist, write to SSH stdin
				if _, ok := terminal.AllowedCommands[cmd.Command]; !ok {
					sendJSON(conn, termReply{Type: "error", Message: "Команда не разрешена: " + cmd.Command})
					break
				}
				sess := h.getSession(agentID)
				if sess == nil || !sess.Alive() {
					sendJSON(conn, termReply{Type: "error", Message: "Требуется SSH-подключение"})
					break
				}
				if _, err := sess.Write([]byte(cmd.Command + "\n")); err != nil {
					log.Printf("[Remote Terminal WS] Exec write failed: %v", err)
					sendJSON(conn, termReply{Type: "error", Message: "Ошибка отправки команды"})
					break
				}
				sendJSON(conn, termReply{Type: "exec_sent", Message: cmd.Command})

			case "resize":
				if sess := h.getSession(agentID); sess != nil {
					if err := sess.Resize(cmd.Cols, cmd.Rows); err != nil {
						log.Printf("[Remote Terminal WS] Resize failed: %v", err)
					}
				}

			case "disconnect":
				if outputCancel != nil {
					outputCancel()
					outputWg.Wait()
					outputCancel = nil
				}
				if sess := h.getSession(agentID); sess != nil {
					sess.Close()
				}
				sendJSON(conn, termReply{Type: "disconnected", Reason: "user"})

			case "ping":
				sendJSON(conn, termReply{Type: "pong"})
			}
		}
	}
}

// handleRemoteConnect resolves the SSH target from the agentID and connects.
func (h *WsRemoteTerminalHandler) handleRemoteConnect(
	conn *websocket.Conn,
	agentID string,
	cmd *termCmd,
	outputCancel *context.CancelFunc,
	outputWg *sync.WaitGroup,
) {
	// Check if session already alive -> reuse
	if sess := h.getSession(agentID); sess != nil {
		log.Printf("[Remote Terminal WS] Reusing existing session for agent %s", agentID)
		if cmd.Cols > 0 && cmd.Rows > 0 {
			_ = sess.Resize(cmd.Cols, cmd.Rows)
		}
		if *outputCancel == nil {
			*outputCancel = startRemoteOutputReader(conn, sess, outputWg)
		}
		sendJSON(conn, termReply{Type: "connected", Reused: true, SessionType: "ssh"})
		return
	}

	// Stop old output reader
	if *outputCancel != nil {
		(*outputCancel)()
		outputWg.Wait()
		*outputCancel = nil
	}

	// Resolve SSH target from agent
	sshHost, sshPort, err := h.resolveSSHTarget(agentID)
	if err != nil {
		log.Printf("[Remote Terminal WS] Resolve SSH target failed: %v", err)
		sendJSON(conn, termReply{Type: "error", Message: fmt.Sprintf("SSH target not available: %v", err)})
		return
	}

	// Create and connect new SSH session
	sess := terminal.NewSession()
	h.setSession(agentID, sess)

	cols := cmd.Cols
	rows := cmd.Rows
	if cols <= 0 {
		cols = 80
	}
	if rows <= 0 {
		rows = 24
	}

	user := cmd.User
	if user == "" {
		user = "root"
	}

	if err := sess.Connect(sshHost, sshPort, user, cmd.Password, cols, rows); err != nil {
		log.Printf("[Remote Terminal WS] SSH connect to %s:%d failed: %v", sshHost, sshPort, err)
		sendJSON(conn, termReply{Type: "error", Message: err.Error()})
		return
	}

	log.Printf("[Remote Terminal WS] SSH connected to %s:%d as %s (agent %s)", sshHost, sshPort, user, agentID)
	sendJSON(conn, termReply{Type: "connected", SessionType: "ssh"})

	// Start output reader
	*outputCancel = startRemoteOutputReader(conn, sess, outputWg)
}

// startRemoteOutputReader reads from the terminal session and sends binary
// frames to the WebSocket. Returns a cancel function.
func startRemoteOutputReader(
	conn *websocket.Conn,
	sess *terminal.Session,
	wg *sync.WaitGroup,
) context.CancelFunc {
	ctx, cancel := context.WithCancel(context.Background())

	type readResult struct {
		data []byte
		err  error
	}
	readCh := make(chan readResult, 1)

	wg.Add(1)
	go func() {
		defer wg.Done()

		// Blocking reader sub-goroutine
		go func() {
			buf := make([]byte, 4096)
			for {
				n, err := sess.Read(buf)
				if n > 0 {
					cp := make([]byte, n)
					copy(cp, buf[:n])
					select {
					case readCh <- readResult{data: cp}:
					case <-ctx.Done():
						return
					}
				}
				if err != nil {
					select {
					case readCh <- readResult{err: err}:
					case <-ctx.Done():
					}
					return
				}
			}
		}()

		for {
			select {
			case <-ctx.Done():
				return
			case res := <-readCh:
				if res.err != nil {
					log.Printf("[Remote Terminal WS] Output reader: session read error: %v", res.err)
					sendJSON(conn, termReply{Type: "disconnected", Reason: "session_ended"})
					return
				}
				if err := conn.WriteMessage(websocket.BinaryMessage, res.data); err != nil {
					log.Printf("[Remote Terminal WS] Output reader: WS write error: %v", err)
					return
				}
			case <-sess.Done():
				sendJSON(conn, termReply{Type: "disconnected", Reason: "session_ended"})
				return
			}
		}
	}()

	return cancel
}
