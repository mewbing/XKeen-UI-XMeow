package sshserver

import (
	"encoding/json"
	"io"
	"log"
	"net"

	"golang.org/x/crypto/ssh"
)

// SSH RFC 4254 types for reverse port forwarding (tcpip-forward).

// forwardRequest is the payload of a "tcpip-forward" global request.
type forwardRequest struct {
	BindAddr string
	BindPort uint32
}

// forwardResponse is the reply payload containing the allocated port.
type forwardResponse struct {
	Port uint32
}

// forwardedTCPPayload is the payload sent when opening a "forwarded-tcpip" channel
// back through the SSH connection to the agent.
type forwardedTCPPayload struct {
	Addr       string
	Port       uint32
	OriginAddr string
	OriginPort uint32
}

// cancelForwardRequest is the payload of a "cancel-tcpip-forward" global request.
type cancelForwardRequest struct {
	BindAddr string
	BindPort uint32
}

// handleGlobalRequests processes SSH global requests from an agent connection.
// This includes tcpip-forward (reverse tunnel setup), cancel-tcpip-forward,
// and the custom "heartbeat" request for agent status updates.
func handleGlobalRequests(agentID string, agent *AgentConn, conn ssh.Conn, reqs <-chan *ssh.Request, updateLastSeen func(string)) {
	for req := range reqs {
		switch req.Type {
		case "tcpip-forward":
			handleTCPIPForward(agent, conn, req)

		case "cancel-tcpip-forward":
			handleCancelForward(agent, req)

		case "heartbeat":
			handleHeartbeat(agentID, agent, req, updateLastSeen)

		default:
			// Unknown request type — reject
			if req.WantReply {
				req.Reply(false, nil)
			}
		}
	}
}

// handleTCPIPForward processes a reverse tunnel request from the agent.
// It allocates a dynamic local port (127.0.0.1:0), maps it to the agent's
// remote port, and starts an accept loop to forward connections through the SSH tunnel.
func handleTCPIPForward(agent *AgentConn, conn ssh.Conn, req *ssh.Request) {
	var fwd forwardRequest
	if err := ssh.Unmarshal(req.Payload, &fwd); err != nil {
		log.Printf("[SSH Tunnel] Failed to unmarshal forward request: %v", err)
		if req.WantReply {
			req.Reply(false, nil)
		}
		return
	}

	// Allocate a dynamic local port — avoids conflicts between multiple agents
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Printf("[SSH Tunnel] Failed to listen for forward: %v", err)
		if req.WantReply {
			req.Reply(false, nil)
		}
		return
	}

	localPort := ln.Addr().(*net.TCPAddr).Port
	agent.addListener(ln, int(fwd.BindPort), localPort)

	// Reply with the allocated local port
	if req.WantReply {
		req.Reply(true, ssh.Marshal(forwardResponse{Port: uint32(localPort)}))
	}

	log.Printf("[SSH Tunnel] Agent %s: forwarding localhost:%d -> remote:%d", agent.ID, localPort, fwd.BindPort)

	// Accept loop: forward each incoming connection through the SSH tunnel
	go func() {
		for {
			local, err := ln.Accept()
			if err != nil {
				return // listener closed (agent disconnected or cancel-forward)
			}
			go forwardConnection(agent, conn, local, fwd.BindAddr, fwd.BindPort)
		}
	}()
}

// handleCancelForward processes a cancel-tcpip-forward request.
// It closes the listener for the specified remote port.
func handleCancelForward(agent *AgentConn, req *ssh.Request) {
	var cancel cancelForwardRequest
	if err := ssh.Unmarshal(req.Payload, &cancel); err != nil {
		if req.WantReply {
			req.Reply(false, nil)
		}
		return
	}

	agent.mu.Lock()
	remotePort := int(cancel.BindPort)
	for i, ln := range agent.listeners {
		addr := ln.Addr().(*net.TCPAddr)
		if localPort, ok := agent.tunnelPorts[remotePort]; ok && addr.Port == localPort {
			ln.Close()
			agent.listeners = append(agent.listeners[:i], agent.listeners[i+1:]...)
			delete(agent.tunnelPorts, remotePort)
			break
		}
	}
	agent.mu.Unlock()

	if req.WantReply {
		req.Reply(true, nil)
	}

	log.Printf("[SSH Tunnel] Agent %s: cancelled forward for remote port %d", agent.ID, cancel.BindPort)
}

// handleHeartbeat processes a heartbeat global request from the agent.
// The payload is a JSON-encoded HeartbeatData struct with device info.
func handleHeartbeat(agentID string, agent *AgentConn, req *ssh.Request, updateLastSeen func(string)) {
	var hb HeartbeatData
	if err := json.Unmarshal(req.Payload, &hb); err != nil {
		log.Printf("[SSH Heartbeat] Agent %s: invalid heartbeat data: %v", agentID, err)
		if req.WantReply {
			req.Reply(false, nil)
		}
		return
	}

	agent.updateHeartbeat(hb)

	// Update LastSeen in the token store
	if updateLastSeen != nil {
		updateLastSeen(agentID)
	}

	if req.WantReply {
		req.Reply(true, nil)
	}
}

// forwardConnection proxies a single TCP connection through the SSH tunnel.
// It opens a "forwarded-tcpip" channel to the agent and performs bidirectional
// data copying between the local connection and the SSH channel.
func forwardConnection(agent *AgentConn, conn ssh.Conn, local net.Conn, remoteAddr string, remotePort uint32) {
	defer local.Close()

	payload := ssh.Marshal(forwardedTCPPayload{
		Addr:       remoteAddr,
		Port:       remotePort,
		OriginAddr: "127.0.0.1",
		OriginPort: 0,
	})

	// Open a forwarded-tcpip channel back to the agent
	channel, reqs, err := conn.OpenChannel("forwarded-tcpip", payload)
	if err != nil {
		log.Printf("[SSH Tunnel] Agent %s: OpenChannel failed for port %d: %v", agent.ID, remotePort, err)
		return
	}
	defer channel.Close()

	// CRITICAL: Drain channel requests to avoid deadlock
	go ssh.DiscardRequests(reqs)

	// Bidirectional copy between local connection and SSH channel
	done := make(chan struct{}, 2)
	go func() {
		io.Copy(channel, local)
		done <- struct{}{}
	}()
	go func() {
		io.Copy(local, channel)
		done <- struct{}{}
	}()

	// Wait for either direction to complete, then let defers close both
	<-done
}
