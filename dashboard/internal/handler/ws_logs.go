package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"

	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
	"github.com/mewbing/XKeen-UI-XMeow/internal/logwatch"
)

// upgrader allows all origins (CORS handled at middleware level).
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// WsLogHandler handles WebSocket connections for real-time log streaming.
// Protocol matches Flask server.py ws_log_stream exactly.
type WsLogHandler struct {
	hub *logwatch.LogHub
	cfg *config.AppConfig
}

// NewWsLogHandler creates a new WebSocket log handler.
func NewWsLogHandler(hub *logwatch.LogHub, cfg *config.AppConfig) *WsLogHandler {
	return &WsLogHandler{hub: hub, cfg: cfg}
}

// wsCommand represents an incoming WebSocket command from the client.
type wsCommand struct {
	Type string `json:"type"`
	File string `json:"file,omitempty"`
}

// ServeHTTP upgrades the connection to WebSocket and runs the read loop.
func (h *WsLogHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] Upgrade failed: %v", err)
		return
	}

	client := logwatch.NewClient(conn)
	h.hub.AddClient(client)
	defer func() {
		h.hub.RemoveClient(client)
		client.Close()
	}()

	log.Printf("[WS] Client connected")

	// Send initial content for default file ("error")
	lines, offset := logwatch.ReadLogTail(
		h.cfg.XkeenLogDir, "error", h.cfg.AllowedLogs, 1000,
	)
	initialMsg := map[string]interface{}{
		"type":  "initial",
		"lines": lines,
		"file":  "error",
	}
	if err := client.SendJSON(initialMsg); err != nil {
		log.Printf("[WS] Failed to send initial: %v", err)
		return
	}
	client.Offset = offset
	log.Printf("[WS] Sent initial %d lines for error", len(lines))

	// Read loop (blocking)
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			// Client disconnected (normal close or error)
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("[WS] Unexpected close: %v", err)
			} else {
				log.Printf("[WS] Connection closed")
			}
			break
		}

		var cmd wsCommand
		if err := json.Unmarshal(message, &cmd); err != nil {
			log.Printf("[WS] Invalid message: %v", err)
			continue
		}

		switch cmd.Type {
		case "switchFile":
			file := strings.TrimSuffix(cmd.File, ".log")
			if file == "" {
				file = "error"
			}
			// Validate against allowed logs
			if _, ok := h.cfg.AllowedLogs[file]; !ok {
				log.Printf("[WS] Invalid file: %s", file)
				continue
			}
			client.CurrentFile = file
			newLines, newOffset := logwatch.ReadLogTail(
				h.cfg.XkeenLogDir, file, h.cfg.AllowedLogs, 1000,
			)
			msg := map[string]interface{}{
				"type":  "initial",
				"lines": newLines,
				"file":  file,
			}
			if err := client.SendJSON(msg); err != nil {
				log.Printf("[WS] Error sending switchFile initial: %v", err)
			}
			client.Offset = newOffset

		case "reload":
			newLines, newOffset := logwatch.ReadLogTail(
				h.cfg.XkeenLogDir, client.CurrentFile, h.cfg.AllowedLogs, 1000,
			)
			msg := map[string]interface{}{
				"type":  "initial",
				"lines": newLines,
				"file":  client.CurrentFile,
			}
			if err := client.SendJSON(msg); err != nil {
				log.Printf("[WS] Error sending reload initial: %v", err)
			}
			client.Offset = newOffset

		case "clear":
			if err := logwatch.ClearLog(h.cfg.XkeenLogDir, client.CurrentFile, h.cfg.AllowedLogs); err != nil {
				log.Printf("[WS] Error clearing log: %v", err)
			}
			if err := client.SendJSON(map[string]string{"type": "clear"}); err != nil {
				log.Printf("[WS] Error sending clear: %v", err)
			}
			client.Offset = 0

		case "ping":
			if err := client.SendJSON(map[string]string{"type": "pong"}); err != nil {
				log.Printf("[WS] Error sending pong: %v", err)
			}

		default:
			log.Printf("[WS] Unknown command: %s", cmd.Type)
		}
	}

	log.Printf("[WS] Client handler exited")
}
