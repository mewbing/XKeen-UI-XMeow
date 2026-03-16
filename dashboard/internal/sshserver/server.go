package sshserver

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"log"
	"net"
	"os"
	"sync"

	"golang.org/x/crypto/ssh"
)

// Server is an embedded SSH server that accepts reverse tunnel connections
// from remote xmeow-agent instances. It handles token-based authentication,
// reverse port forwarding (tcpip-forward), and heartbeat processing.
type Server struct {
	mu             sync.RWMutex
	config         *ssh.ServerConfig
	listener       net.Listener
	agents         map[string]*AgentConn // agentID -> agent
	done           chan struct{}
	onAgentChange  func()                                    // callback for notifying WebSocket subscribers
	validateToken  func(token string) (agentID string, ok bool)
	updateLastSeen func(agentID string)
}

// NewServer creates a new SSH server with ed25519 host key and token-based auth.
//
// hostKeyPath: path to the ed25519 host key file (generated if not exists).
// validateToken: callback to validate agent tokens against the store.
// updateLastSeen: callback to update the LastSeen timestamp in the store.
func NewServer(hostKeyPath string, validateToken func(string) (string, bool), updateLastSeen func(string)) (*Server, error) {
	hostKey, err := loadOrGenerateHostKey(hostKeyPath)
	if err != nil {
		return nil, fmt.Errorf("host key: %w", err)
	}

	s := &Server{
		agents:         make(map[string]*AgentConn),
		done:           make(chan struct{}),
		validateToken:  validateToken,
		updateLastSeen: updateLastSeen,
	}

	s.config = &ssh.ServerConfig{
		// Token-based auth: agent sends token as SSH password, username is device_name (informational).
		PasswordCallback: func(c ssh.ConnMetadata, pass []byte) (*ssh.Permissions, error) {
			agentID, ok := s.validateToken(string(pass))
			if !ok {
				return nil, fmt.Errorf("invalid token")
			}
			return &ssh.Permissions{
				Extensions: map[string]string{
					"agent-id": agentID,
				},
			}, nil
		},
	}
	s.config.AddHostKey(hostKey)

	return s, nil
}

// ListenAndServe starts the SSH server on the given address (e.g., ":2222").
// Blocks until Shutdown is called or a fatal error occurs.
func (s *Server) ListenAndServe(addr string) error {
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen %s: %w", addr, err)
	}
	s.listener = ln
	log.Printf("[SSH Server] Listening on %s", addr)

	for {
		conn, err := ln.Accept()
		if err != nil {
			select {
			case <-s.done:
				return nil // graceful shutdown
			default:
				log.Printf("[SSH Server] Accept error: %v", err)
				continue
			}
		}
		go s.handleConnection(conn)
	}
}

// handleConnection processes a single incoming SSH connection.
// It performs the SSH handshake, registers the agent, handles global requests
// (tunnels, heartbeats), and cleans up on disconnect.
func (s *Server) handleConnection(netConn net.Conn) {
	sshConn, chans, reqs, err := ssh.NewServerConn(netConn, s.config)
	if err != nil {
		log.Printf("[SSH Server] Handshake failed from %s: %v", netConn.RemoteAddr(), err)
		netConn.Close()
		return
	}

	agentID := sshConn.Permissions.Extensions["agent-id"]
	remoteAddr := netConn.RemoteAddr().String()
	log.Printf("[SSH Server] Agent %s connected from %s (user: %s)", agentID, remoteAddr, sshConn.User())

	agent := &AgentConn{
		ID:          agentID,
		Name:        sshConn.User(), // initial name from SSH username
		conn:        sshConn,
		tunnelPorts: make(map[int]int),
	}

	s.registerAgent(agentID, agent)
	defer s.unregisterAgent(agentID)

	// Handle global requests (tcpip-forward, heartbeat) in a goroutine
	go handleGlobalRequests(agentID, agent, sshConn, reqs, s.updateLastSeen)

	// CRITICAL: Must drain the chans channel to avoid SSH connection deadlock.
	// We don't expect channel opens from the agent — reject all.
	for newChan := range chans {
		newChan.Reject(ssh.Prohibited, "no channels allowed from agent")
	}

	// When chans closes, the connection has dropped — defer handles cleanup
	log.Printf("[SSH Server] Agent %s disconnected", agentID)
}

// registerAgent adds an agent to the active agents map and notifies subscribers.
func (s *Server) registerAgent(id string, agent *AgentConn) {
	s.mu.Lock()
	// Close existing agent with same ID if reconnecting
	if existing, ok := s.agents[id]; ok {
		existing.Close()
	}
	s.agents[id] = agent
	s.mu.Unlock()

	if s.onAgentChange != nil {
		s.onAgentChange()
	}
}

// unregisterAgent removes an agent, closes all its tunnel listeners, and notifies subscribers.
func (s *Server) unregisterAgent(id string) {
	s.mu.Lock()
	if agent, ok := s.agents[id]; ok {
		agent.Close()
		delete(s.agents, id)
	}
	s.mu.Unlock()

	if s.onAgentChange != nil {
		s.onAgentChange()
	}
}

// GetAgent returns the AgentConn for the given ID, or nil if not connected.
func (s *Server) GetAgent(id string) *AgentConn {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.agents[id]
}

// GetAllAgents returns info for all currently connected agents.
func (s *Server) GetAllAgents() []AgentInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]AgentInfo, 0, len(s.agents))
	for _, agent := range s.agents {
		result = append(result, agent.Info())
	}
	return result
}

// SetOnAgentChange sets a callback invoked when agents connect or disconnect.
// Used to notify WebSocket subscribers of agent status changes.
func (s *Server) SetOnAgentChange(fn func()) {
	s.onAgentChange = fn
}

// Shutdown gracefully stops the SSH server, closing all agent connections and the listener.
func (s *Server) Shutdown() {
	close(s.done)

	if s.listener != nil {
		s.listener.Close()
	}

	s.mu.Lock()
	for id, agent := range s.agents {
		agent.Close()
		delete(s.agents, id)
	}
	s.mu.Unlock()

	log.Printf("[SSH Server] Shut down")
}

// loadOrGenerateHostKey loads an ed25519 host key from disk, or generates and
// persists a new one if the file does not exist.
func loadOrGenerateHostKey(path string) (ssh.Signer, error) {
	// Try loading existing key
	data, err := os.ReadFile(path)
	if err == nil {
		signer, err := ssh.ParsePrivateKey(data)
		if err != nil {
			return nil, fmt.Errorf("parse host key %s: %w", path, err)
		}
		log.Printf("[SSH Server] Loaded host key from %s", path)
		return signer, nil
	}

	if !os.IsNotExist(err) {
		return nil, fmt.Errorf("read host key %s: %w", path, err)
	}

	// Generate new ed25519 key
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate ed25519 key: %w", err)
	}

	// Marshal to PKCS8 DER
	der, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		return nil, fmt.Errorf("marshal key to PKCS8: %w", err)
	}

	// Encode as PEM
	pemBlock := &pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: der,
	}
	pemData := pem.EncodeToMemory(pemBlock)

	// Ensure parent directory exists
	if dir := dirOf(path); dir != "" {
		os.MkdirAll(dir, 0700)
	}

	// Save to disk with restricted permissions (owner read/write only)
	if err := os.WriteFile(path, pemData, 0600); err != nil {
		return nil, fmt.Errorf("save host key to %s: %w", path, err)
	}

	signer, err := ssh.ParsePrivateKey(pemData)
	if err != nil {
		return nil, fmt.Errorf("parse generated key: %w", err)
	}

	log.Printf("[SSH Server] Generated new host key at %s", path)
	return signer, nil
}

// dirOf returns the directory portion of a file path.
func dirOf(path string) string {
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '/' || path[i] == '\\' {
			return path[:i]
		}
	}
	return ""
}
