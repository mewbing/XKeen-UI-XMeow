package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/gorilla/websocket"

	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
	"github.com/mewbing/XKeen-UI-XMeow/internal/terminal"
)

// WsTerminalHandler handles WebSocket connections for the terminal.
// Auth is validated before the WebSocket upgrade (unlike /ws/logs).
type WsTerminalHandler struct {
	hub *terminal.Hub
	cfg *config.AppConfig
}

// NewWsTerminalHandler creates a new terminal WebSocket handler.
func NewWsTerminalHandler(hub *terminal.Hub, cfg *config.AppConfig) *WsTerminalHandler {
	return &WsTerminalHandler{hub: hub, cfg: cfg}
}

// termCmd represents a JSON control message from the client.
type termCmd struct {
	Type     string `json:"type"`
	Host     string `json:"host,omitempty"`
	Port     int    `json:"port,omitempty"`
	User     string `json:"user,omitempty"`
	Password string `json:"password,omitempty"`
	Command  string `json:"command,omitempty"`
	Cols     int    `json:"cols,omitempty"`
	Rows     int    `json:"rows,omitempty"`
}

// termReply represents a JSON response sent to the client.
type termReply struct {
	Type        string `json:"type"`
	Message     string `json:"message,omitempty"`
	Reused      bool   `json:"reused,omitempty"`
	Reason      string `json:"reason,omitempty"`
	SessionType string `json:"session_type,omitempty"`
}

// ServeHTTP validates auth, upgrades to WebSocket, and runs the terminal message loop.
func (h *WsTerminalHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// 1. Auth check BEFORE WebSocket upgrade
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

	// 2. Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[Terminal WS] Upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// 3. Track client in hub
	h.hub.AttachClient()
	defer h.hub.DetachClient()

	log.Printf("[Terminal WS] Client connected")

	// Output goroutine management
	var (
		outputCancel context.CancelFunc
		outputWg     sync.WaitGroup
	)

	// If hub already has an alive session, start reading output
	if sess := h.hub.GetSession(); sess != nil {
		outputCancel = h.startOutputReader(conn, sess, &outputWg)
	}

	// Ensure output goroutine is cleaned up on exit
	defer func() {
		if outputCancel != nil {
			outputCancel()
			outputWg.Wait()
		}
		log.Printf("[Terminal WS] Client handler exited")
	}()

	// 4. Read loop (blocking)
	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("[Terminal WS] Unexpected close: %v", err)
			} else {
				log.Printf("[Terminal WS] Connection closed")
			}
			break
		}

		switch msgType {
		case websocket.BinaryMessage:
			// Terminal input -> session stdin
			sess := h.hub.GetSession()
			if sess != nil {
				if _, err := sess.Write(data); err != nil {
					log.Printf("[Terminal WS] Write to session failed: %v", err)
				}
			}

		case websocket.TextMessage:
			// JSON control command
			var cmd termCmd
			if err := json.Unmarshal(data, &cmd); err != nil {
				log.Printf("[Terminal WS] Invalid JSON: %v", err)
				continue
			}

			switch cmd.Type {
			case "connect":
				h.handleConnect(conn, &cmd, &outputCancel, &outputWg)

			case "exec":
				h.handleExec(conn, &cmd, &outputCancel, &outputWg)

			case "resize":
				if sess := h.hub.GetSession(); sess != nil {
					if err := sess.Resize(cmd.Cols, cmd.Rows); err != nil {
						log.Printf("[Terminal WS] Resize failed: %v", err)
					}
				}

			case "disconnect":
				// Stop output reader first
				if outputCancel != nil {
					outputCancel()
					outputWg.Wait()
					outputCancel = nil
				}
				if sess := h.hub.GetSession(); sess != nil {
					sess.Close()
				}
				sendJSON(conn, termReply{Type: "disconnected", Reason: "user"})

			case "ping":
				sendJSON(conn, termReply{Type: "pong"})

			default:
				log.Printf("[Terminal WS] Unknown command: %s", cmd.Type)
			}
		}
	}
}

// handleConnect processes the "connect" command (SSH).
func (h *WsTerminalHandler) handleConnect(
	conn *websocket.Conn,
	cmd *termCmd,
	outputCancel *context.CancelFunc,
	outputWg *sync.WaitGroup,
) {
	// Check if session already alive -> reuse
	if sess := h.hub.GetSession(); sess != nil {
		log.Printf("[Terminal WS] Reusing existing session")
		// Resize to current client size
		if cmd.Cols > 0 && cmd.Rows > 0 {
			_ = sess.Resize(cmd.Cols, cmd.Rows)
		}
		// Restart output reader if not running
		if *outputCancel == nil {
			*outputCancel = h.startOutputReader(conn, sess, outputWg)
		}
		sendJSON(conn, termReply{Type: "connected", Reused: true, SessionType: "ssh"})
		return
	}

	// Stop old output reader if any
	if *outputCancel != nil {
		(*outputCancel)()
		outputWg.Wait()
		*outputCancel = nil
	}

	// Create and connect new SSH session
	sess := terminal.NewSession()
	h.hub.SetSession(sess)

	cols := cmd.Cols
	rows := cmd.Rows
	if cols <= 0 {
		cols = 80
	}
	if rows <= 0 {
		rows = 24
	}

	if err := sess.Connect(cmd.Host, cmd.Port, cmd.User, cmd.Password, cols, rows); err != nil {
		log.Printf("[Terminal WS] SSH connect failed: %v", err)
		sendJSON(conn, termReply{Type: "error", Message: err.Error()})
		return
	}

	log.Printf("[Terminal WS] SSH connected to %s:%d as %s", cmd.Host, cmd.Port, cmd.User)
	sendJSON(conn, termReply{Type: "connected", SessionType: "ssh"})

	// Start output reader
	*outputCancel = h.startOutputReader(conn, sess, outputWg)
}

// handleExec processes the "exec" command (local PTY).
func (h *WsTerminalHandler) handleExec(
	conn *websocket.Conn,
	cmd *termCmd,
	outputCancel *context.CancelFunc,
	outputWg *sync.WaitGroup,
) {
	// Stop old output reader
	if *outputCancel != nil {
		(*outputCancel)()
		outputWg.Wait()
		*outputCancel = nil
	}

	// Close existing session
	if sess := h.hub.GetSession(); sess != nil {
		sess.Close()
	}

	sess := terminal.NewExecSession()
	h.hub.SetSession(sess)

	cols := cmd.Cols
	rows := cmd.Rows
	if cols <= 0 {
		cols = 80
	}
	if rows <= 0 {
		rows = 24
	}

	if err := sess.Start(cmd.Command, cols, rows); err != nil {
		log.Printf("[Terminal WS] Exec failed: %v", err)
		sendJSON(conn, termReply{Type: "error", Message: err.Error()})
		return
	}

	log.Printf("[Terminal WS] Exec started: %s", cmd.Command)
	sendJSON(conn, termReply{Type: "connected", SessionType: "exec"})

	// Start output reader
	*outputCancel = h.startOutputReader(conn, sess, outputWg)
}

// startOutputReader starts a goroutine that reads from the session stdout
// and sends binary frames to the WebSocket. Returns a cancel function.
func (h *WsTerminalHandler) startOutputReader(
	conn *websocket.Conn,
	sess terminal.TerminalSession,
	wg *sync.WaitGroup,
) context.CancelFunc {
	ctx, cancel := context.WithCancel(context.Background())

	// Channel-based reader: a goroutine reads from session.Read() (blocking)
	// and sends data into a channel, allowing select with context cancellation.
	type readResult struct {
		data []byte
		err  error
	}
	readCh := make(chan readResult, 1)

	wg.Add(1)
	go func() {
		defer wg.Done()

		// Start the blocking reader in a sub-goroutine
		go func() {
			buf := make([]byte, 4096)
			for {
				n, err := sess.Read(buf)
				if n > 0 {
					// Copy data to avoid buffer reuse issues
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

		// Forward data to WebSocket until cancelled or error
		for {
			select {
			case <-ctx.Done():
				return
			case res := <-readCh:
				if res.err != nil {
					// Session read error (e.g., session closed)
					log.Printf("[Terminal WS] Output reader: session read error: %v", res.err)
					// Notify client that session ended
					sendJSON(conn, termReply{Type: "disconnected", Reason: "session_ended"})
					return
				}
				if err := conn.WriteMessage(websocket.BinaryMessage, res.data); err != nil {
					log.Printf("[Terminal WS] Output reader: WS write error: %v", err)
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

// sendJSON writes a JSON text message to the WebSocket connection.
func sendJSON(conn *websocket.Conn, v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return conn.WriteMessage(websocket.TextMessage, data)
}
