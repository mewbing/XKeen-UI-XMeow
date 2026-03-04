package terminal

import (
	"log"
	"sync"
	"time"
)

// Hub manages a single SSH terminal session with inactivity timeout.
// It tracks the number of attached WebSocket clients but does not
// manage WS connections directly -- the WS handler does that.
type Hub struct {
	mu      sync.Mutex
	session *Session
	clients int
	timeout time.Duration
	done    chan struct{}
}

// NewHub creates a new terminal hub with the given inactivity timeout.
// It starts a background goroutine to check for idle sessions.
func NewHub(timeout time.Duration) *Hub {
	h := &Hub{
		timeout: timeout,
		done:    make(chan struct{}),
	}
	go h.inactivityChecker()
	return h
}

// GetSession returns the current session if alive, nil otherwise.
func (h *Hub) GetSession() *Session {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.session != nil && h.session.Alive() {
		return h.session
	}
	return nil
}

// CreateSession creates a new SSH session, closing any existing one.
// The returned session is not yet connected -- caller must call Connect.
func (h *Hub) CreateSession() *Session {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Close existing session if alive
	if h.session != nil && h.session.Alive() {
		h.session.Close()
	}

	s := NewSession()
	h.session = s
	return s
}

// AttachClient increments the WebSocket client count.
func (h *Hub) AttachClient() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients++
	log.Printf("[Terminal] Client attached (total: %d)", h.clients)
}

// DetachClient decrements the WebSocket client count.
func (h *Hub) DetachClient() {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients > 0 {
		h.clients--
	}
	log.Printf("[Terminal] Client detached (total: %d)", h.clients)
}

// Shutdown closes the current session (if any) and stops the inactivity checker.
func (h *Hub) Shutdown() {
	h.mu.Lock()
	if h.session != nil && h.session.Alive() {
		h.session.Close()
	}
	h.mu.Unlock()

	close(h.done)
	log.Printf("[Terminal] Hub shut down")
}

// inactivityChecker runs in a background goroutine and closes idle sessions.
func (h *Hub) inactivityChecker() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			h.mu.Lock()
			if h.session != nil && h.session.Alive() {
				if time.Since(h.session.LastInput()) > h.timeout {
					log.Printf("[Terminal] Session timed out after %v of inactivity", h.timeout)
					h.session.Close()
				}
			}
			h.mu.Unlock()
		case <-h.done:
			return
		}
	}
}
