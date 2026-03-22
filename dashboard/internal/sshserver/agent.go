package sshserver

import (
	"net"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
)

// HeartbeatData is the JSON payload sent periodically by the agent
// via a custom "heartbeat" SSH global request.
type HeartbeatData struct {
	DeviceName   string `json:"device_name"`
	Arch         string `json:"arch"`
	MihomoVer    string `json:"mihomo_ver"`
	XkeenVer     string `json:"xkeen_ver,omitempty"`
	AgentVer     string `json:"agent_ver,omitempty"`
	Uptime       int64  `json:"uptime_sec"`
	IP           string `json:"ip"`
	MihomoSecret string `json:"mihomo_secret,omitempty"`
}

// AgentInfo is the exported, JSON-safe representation of a connected agent.
// Used for API responses — does not expose the SSH connection.
type AgentInfo struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Arch          string         `json:"arch"`
	MihomoVer     string         `json:"mihomo_ver"`
	XkeenVer      string         `json:"xkeen_ver,omitempty"`
	AgentVer      string         `json:"agent_ver,omitempty"`
	IP            string         `json:"ip"`
	Uptime        int64          `json:"uptime_sec"`
	Online        bool           `json:"online"`
	TunnelPorts   map[int]int    `json:"tunnel_ports"` // remote port -> local forwarded port
	LastHeartbeat time.Time      `json:"last_heartbeat"`
}

// AgentConn represents a single connected agent with its SSH connection,
// tunnel port mappings, and heartbeat state.
type AgentConn struct {
	ID            string
	Name          string
	Arch          string
	MihomoVer     string
	XkeenVer      string
	AgentVer      string
	IP            string
	Uptime        int64
	mihomoSecret  string         // mihomo API secret (not exposed in AgentInfo)
	conn          ssh.Conn
	tunnelPorts   map[int]int    // remote port -> local forwarded port
	listeners     []net.Listener // tracked for cleanup on disconnect
	lastHeartbeat time.Time
	mu            sync.Mutex
}

// Info converts the internal AgentConn to the exported AgentInfo type
// suitable for JSON serialization and API responses.
func (a *AgentConn) Info() AgentInfo {
	a.mu.Lock()
	defer a.mu.Unlock()

	// Copy tunnel ports to avoid race
	ports := make(map[int]int, len(a.tunnelPorts))
	for k, v := range a.tunnelPorts {
		ports[k] = v
	}

	return AgentInfo{
		ID:            a.ID,
		Name:          a.Name,
		Arch:          a.Arch,
		MihomoVer:     a.MihomoVer,
		XkeenVer:      a.XkeenVer,
		AgentVer:      a.AgentVer,
		IP:            a.IP,
		Uptime:        a.Uptime,
		Online:        true,
		TunnelPorts:   ports,
		LastHeartbeat: a.lastHeartbeat,
	}
}

// Close shuts down all tunnel listeners and the SSH connection.
// Must be called when the agent disconnects to prevent port leaks.
func (a *AgentConn) Close() {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, ln := range a.listeners {
		ln.Close()
	}
	a.listeners = nil
	a.tunnelPorts = nil

	if a.conn != nil {
		a.conn.Close()
	}
}

// GetLocalPort returns the local forwarded port for a given remote port.
// Returns the port and true if the mapping exists, 0 and false otherwise.
func (a *AgentConn) GetLocalPort(remotePort int) (int, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()

	port, ok := a.tunnelPorts[remotePort]
	return port, ok
}

// addListener registers a tunnel listener for cleanup tracking.
func (a *AgentConn) addListener(ln net.Listener, remotePort int, localPort int) {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.listeners = append(a.listeners, ln)
	a.tunnelPorts[remotePort] = localPort
}

// GetMihomoSecret returns the mihomo API secret received from the agent's heartbeat.
func (a *AgentConn) GetMihomoSecret() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.mihomoSecret
}

// updateHeartbeat applies heartbeat data received from the agent.
func (a *AgentConn) updateHeartbeat(hb HeartbeatData) {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.Name = hb.DeviceName
	a.Arch = hb.Arch
	a.MihomoVer = hb.MihomoVer
	a.XkeenVer = hb.XkeenVer
	a.AgentVer = hb.AgentVer
	a.Uptime = hb.Uptime
	a.IP = hb.IP
	a.mihomoSecret = hb.MihomoSecret
	a.lastHeartbeat = time.Now()
}
