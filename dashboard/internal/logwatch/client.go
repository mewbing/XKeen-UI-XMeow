package logwatch

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
)

// Client represents a connected WebSocket log viewer.
type Client struct {
	Conn        *websocket.Conn
	mu          sync.Mutex
	CurrentFile string // "error" or "access" (default: "error")
	Offset      int64  // byte offset for incremental reading
}

// NewClient creates a new Client with default file set to "error".
func NewClient(conn *websocket.Conn) *Client {
	return &Client{
		Conn:        conn,
		CurrentFile: "error",
		Offset:      0,
	}
}

// SendJSON marshals v to JSON and sends it via the WebSocket connection.
// Thread-safe via mutex lock.
func (c *Client) SendJSON(v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.Conn.WriteMessage(websocket.TextMessage, data)
}

// Close closes the WebSocket connection.
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Conn.Close()
}
