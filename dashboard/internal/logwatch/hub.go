package logwatch

import (
	"log"
	"path/filepath"
	"strings"
	"sync"

	"github.com/mewbing/XKeen-UI-Xmeow/internal/config"
)

// LogHub manages WebSocket clients and a lazy file watcher.
// The watcher starts when the first client connects and stops when the last disconnects.
type LogHub struct {
	mu      sync.RWMutex
	clients map[*Client]struct{}
	cfg     *config.AppConfig
	watcher *Watcher
}

// NewLogHub creates a new LogHub with the given configuration.
func NewLogHub(cfg *config.AppConfig) *LogHub {
	return &LogHub{
		clients: make(map[*Client]struct{}),
		cfg:     cfg,
	}
}

// AddClient registers a client with the hub.
// Starts the file watcher if this is the first client.
func (h *LogHub) AddClient(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.clients[c] = struct{}{}
	log.Printf("[LogHub] Client added (total: %d)", len(h.clients))

	// Start watcher on first client
	if len(h.clients) == 1 {
		h.startWatcher()
	}
}

// RemoveClient unregisters a client from the hub.
// Stops the file watcher if this was the last client.
func (h *LogHub) RemoveClient(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.clients, c)
	log.Printf("[LogHub] Client removed (total: %d)", len(h.clients))

	// Stop watcher when no clients left
	if len(h.clients) == 0 {
		h.stopWatcher()
	}
}

// BroadcastNewLines reads new content from the changed file and sends it
// to all connected clients watching that file.
func (h *LogHub) BroadcastNewLines(changedFile string) {
	// Extract base filename (e.g., "error.log") and derive log name (e.g., "error")
	baseName := filepath.Base(changedFile)

	// Find the log name key for this filename
	logName := ""
	for name, filename := range h.cfg.AllowedLogs {
		if filename == baseName {
			logName = name
			break
		}
	}
	if logName == "" {
		return // Not an allowed log file
	}

	h.mu.RLock()
	// Copy client list under read lock
	clients := make([]*Client, 0, len(h.clients))
	for c := range h.clients {
		clients = append(clients, c)
	}
	h.mu.RUnlock()

	for _, client := range clients {
		// Only send to clients watching this file
		if client.CurrentFile != logName {
			continue
		}

		lines, newSize, truncated := ReadFromOffset(
			h.cfg.XkeenLogDir, logName, h.cfg.AllowedLogs, client.Offset,
		)

		if truncated {
			// File was truncated, send full initial
			initialLines, offset := ReadLogTail(
				h.cfg.XkeenLogDir, logName, h.cfg.AllowedLogs, 1000,
			)
			msg := map[string]interface{}{
				"type":  "initial",
				"lines": initialLines,
				"file":  logName,
			}
			if err := client.SendJSON(msg); err != nil {
				log.Printf("[LogHub] Error sending initial after truncation: %v", err)
				continue
			}
			client.Offset = offset
		} else if len(lines) > 0 {
			msg := map[string]interface{}{
				"type":  "append",
				"lines": lines,
			}
			if err := client.SendJSON(msg); err != nil {
				log.Printf("[LogHub] Error sending append: %v", err)
				continue
			}
			client.Offset = newSize
		} else {
			client.Offset = newSize
		}
	}
}

// startWatcher creates and starts a file watcher. Must be called under write lock.
func (h *LogHub) startWatcher() {
	log.Printf("[LogHub] Starting file watcher")
	h.watcher = NewWatcher(h, h.cfg.XkeenLogDir, h.cfg.AllowedLogs)
	h.watcher.Start()
}

// stopWatcher stops the file watcher. Must be called under write lock.
func (h *LogHub) stopWatcher() {
	if h.watcher != nil {
		log.Printf("[LogHub] Stopping file watcher")
		h.watcher.Stop()
		h.watcher = nil
	}
}

// Shutdown stops the watcher and closes all client connections.
func (h *LogHub) Shutdown() {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.stopWatcher()
	for c := range h.clients {
		c.Close()
		delete(h.clients, c)
	}
	log.Printf("[LogHub] Shut down")
}

// filenameToLogName converts a full path or filename to a log name key.
// E.g., "/opt/var/log/xray/error.log" -> "error"
func filenameToLogName(path string, allowedLogs map[string]string) string {
	base := filepath.Base(path)
	for name, filename := range allowedLogs {
		if filename == base {
			return name
		}
	}
	// Try without .log extension
	noExt := strings.TrimSuffix(base, ".log")
	if _, ok := allowedLogs[noExt]; ok {
		return noExt
	}
	return ""
}
