package main

import (
	"encoding/binary"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"golang.org/x/crypto/ssh"
)

// Version is set via ldflags at build time:
//
//	go build -ldflags "-X main.Version=0.1.0" ./cmd/xmeow-agent/
var Version = "0.1.6"

// Config represents the agent configuration loaded from agent.conf.
type Config struct {
	ServerHost string `json:"server_host"`
	ServerPort int    `json:"server_port"`
	Token      string `json:"token"`
	DeviceName string `json:"device_name"`
}

// HeartbeatData is the payload sent to the master every heartbeat interval.
type HeartbeatData struct {
	DeviceName   string `json:"device_name"`
	Arch         string `json:"arch"`
	MihomoVer    string `json:"mihomo_ver"`
	XkeenVer     string `json:"xkeen_ver,omitempty"`
	AgentVer     string `json:"agent_ver"`
	UptimeSec    int64  `json:"uptime_sec"`
	IP           string `json:"ip"`
	MihomoSecret string `json:"mihomo_secret,omitempty"`
}

// forwardRequest is the SSH tcpip-forward request payload (RFC 4254).
type forwardRequest struct {
	BindAddr string
	BindPort uint32
}

// forwardResponse is the SSH tcpip-forward reply payload.
type forwardResponse struct {
	Port uint32
}

// forwardedTCPPayload is the payload for forwarded-tcpip channel opens.
type forwardedTCPPayload struct {
	Addr       string
	Port       uint32
	OriginAddr string
	OriginPort uint32
}

const (
	initialDelay    = 1 * time.Second
	maxDelay        = 5 * time.Minute
	jitterFrac      = 0.3
	heartbeatPeriod = 30 * time.Second
	connectTimeout  = 10 * time.Second
)

// Ports to forward via reverse tunnel.
var forwardPorts = []uint32{5000, 9090, 22}

var (
	cfg       Config
	startTime time.Time
	done      chan struct{}
)

func main() {
	configPath := flag.String("config", "/opt/etc/xmeow-ui/agent.conf", "Path to agent config file")
	showVersion := flag.Bool("version", false, "Print version and exit")
	flag.BoolVar(showVersion, "v", false, "Print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Println(Version)
		os.Exit(0)
	}

	// Load config
	if err := loadConfig(*configPath); err != nil {
		log.Fatalf("[Agent] Failed to load config %s: %v", *configPath, err)
	}

	// Validate config
	if cfg.ServerHost == "" {
		log.Fatal("[Agent] server_host is required in config")
	}
	if cfg.Token == "" {
		log.Fatal("[Agent] token is required in config")
	}
	if cfg.ServerPort == 0 {
		cfg.ServerPort = 2222
	}
	if cfg.DeviceName == "" {
		name, _ := os.Hostname()
		if name == "" {
			name = "unknown"
		}
		cfg.DeviceName = name
	}

	log.Printf("[Agent] XMeow Agent v%s", Version)
	log.Printf("[Agent] Device: %s, Server: %s:%d", cfg.DeviceName, cfg.ServerHost, cfg.ServerPort)

	startTime = time.Now()
	done = make(chan struct{})

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Println("[Agent] Received shutdown signal")
		close(done)
	}()

	connectLoop()
	log.Println("[Agent] Stopped")
}

func loadConfig(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read config: %w", err)
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return fmt.Errorf("parse config: %w", err)
	}
	return nil
}

func connectLoop() {
	attempt := 0
	for {
		select {
		case <-done:
			return
		default:
		}

		client, err := connect()
		if err != nil {
			attempt++
			delay := backoff(attempt)
			log.Printf("[Agent] Connection failed (attempt %d): %v. Retrying in %v", attempt, err, delay)

			select {
			case <-done:
				return
			case <-time.After(delay):
			}
			continue
		}

		// Connected successfully
		attempt = 0
		log.Printf("[Agent] Connected to %s:%d", cfg.ServerHost, cfg.ServerPort)

		runSession(client)
		log.Println("[Agent] Disconnected, will reconnect...")
	}
}

func backoff(attempt int) time.Duration {
	delay := float64(initialDelay) * math.Pow(2, float64(attempt-1))
	if delay > float64(maxDelay) {
		delay = float64(maxDelay)
	}
	// Add jitter: +/- 30%
	jitter := delay * jitterFrac * (2*rand.Float64() - 1)
	return time.Duration(delay + jitter)
}

func connect() (*ssh.Client, error) {
	sshConfig := &ssh.ClientConfig{
		User: cfg.DeviceName,
		Auth: []ssh.AuthMethod{
			ssh.Password(cfg.Token),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         connectTimeout,
	}

	addr := fmt.Sprintf("%s:%d", cfg.ServerHost, cfg.ServerPort)
	client, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return nil, fmt.Errorf("ssh dial: %w", err)
	}
	return client, nil
}

func runSession(client *ssh.Client) {
	defer client.Close()

	// Request reverse port forwarding for each port
	for _, port := range forwardPorts {
		payload := ssh.Marshal(forwardRequest{
			BindAddr: "0.0.0.0",
			BindPort: port,
		})
		ok, resp, err := client.Conn.SendRequest("tcpip-forward", true, payload)
		if err != nil {
			log.Printf("[Agent] Failed to request forward for port %d: %v", port, err)
			continue
		}
		if !ok {
			log.Printf("[Agent] Server rejected forward for port %d", port)
			continue
		}
		var fwdResp forwardResponse
		if len(resp) >= 4 {
			fwdResp.Port = binary.BigEndian.Uint32(resp[:4])
		}
		log.Printf("[Agent] Reverse tunnel established: remote port %d -> allocated %d", port, fwdResp.Port)
	}

	// Start heartbeat goroutine
	var wg sync.WaitGroup
	sessionDone := make(chan struct{})

	wg.Add(1)
	go func() {
		defer wg.Done()
		heartbeatLoop(client.Conn, sessionDone)
	}()

	// Handle forwarded channels (blocks until SSH connection drops)
	handleForwardedChannels(client, sessionDone)

	close(sessionDone)
	wg.Wait()
}

func heartbeatLoop(conn ssh.Conn, sessionDone chan struct{}) {
	ticker := time.NewTicker(heartbeatPeriod)
	defer ticker.Stop()

	// Send initial heartbeat immediately
	sendHeartbeat(conn)

	for {
		select {
		case <-ticker.C:
			if !sendHeartbeat(conn) {
				return
			}
		case <-sessionDone:
			return
		case <-done:
			return
		}
	}
}

func sendHeartbeat(conn ssh.Conn) bool {
	data := HeartbeatData{
		DeviceName:   cfg.DeviceName,
		Arch:         runtime.GOARCH,
		MihomoVer:    getMihomoVersion(),
		XkeenVer:     getXkeenVersion(),
		AgentVer:     Version,
		UptimeSec:    getSystemUptime(),
		IP:           getOutboundIP(),
		MihomoSecret: getMihomoSecret(),
	}

	payload, err := json.Marshal(data)
	if err != nil {
		log.Printf("[Agent] Heartbeat marshal error: %v", err)
		return false
	}

	ok, _, err := conn.SendRequest("heartbeat", true, payload)
	if err != nil {
		log.Printf("[Agent] Heartbeat send error: %v", err)
		return false
	}
	if !ok {
		log.Printf("[Agent] Heartbeat rejected by server")
		return false
	}
	return true
}

func getMihomoVersion() string {
	out, err := exec.Command("mihomo", "-v").Output()
	if err != nil {
		return "unknown"
	}
	// Parse first line: "Mihomo Meta v1.18.0 linux arm64 ..."
	line := strings.TrimSpace(strings.SplitN(string(out), "\n", 2)[0])
	if line == "" {
		return "unknown"
	}
	return line
}

// getXkeenVersion returns the installed xkeen version string.
// Returns empty string if xkeen is not installed.
func getXkeenVersion() string {
	out, err := exec.Command("xkeen", "-v").Output()
	if err != nil {
		return ""
	}
	line := strings.TrimSpace(strings.SplitN(string(out), "\n", 2)[0])
	return line
}

// getSystemUptime reads /proc/uptime for the real system uptime.
// Falls back to agent process uptime if /proc/uptime is unavailable.
func getSystemUptime() int64 {
	data, err := os.ReadFile("/proc/uptime")
	if err == nil {
		fields := strings.Fields(string(data))
		if len(fields) > 0 {
			if secs, err := strconv.ParseFloat(fields[0], 64); err == nil {
				return int64(secs)
			}
		}
	}
	return int64(time.Since(startTime).Seconds())
}

// getMihomoSecret reads the mihomo secret from config.yaml.
// Returns empty string if config not found or no secret configured.
// Handles YAML values like: secret: 'value' # comment
func getMihomoSecret() string {
	data, err := os.ReadFile("/opt/etc/mihomo/config.yaml")
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "secret:") {
			val := strings.TrimSpace(strings.TrimPrefix(line, "secret:"))
			if len(val) == 0 {
				return ""
			}
			// Single-quoted YAML string: find closing quote
			if val[0] == '\'' {
				if end := strings.Index(val[1:], "'"); end >= 0 {
					return val[1 : end+1]
				}
			}
			// Double-quoted YAML string: find closing quote
			if val[0] == '"' {
				if end := strings.Index(val[1:], "\""); end >= 0 {
					return val[1 : end+1]
				}
			}
			// Unquoted: strip inline YAML comment
			if idx := strings.Index(val, " #"); idx >= 0 {
				val = val[:idx]
			}
			return strings.TrimSpace(val)
		}
	}
	return ""
}

func getOutboundIP() string {
	conn, err := net.DialTimeout("udp", "8.8.8.8:80", 2*time.Second)
	if err != nil {
		return "unknown"
	}
	defer conn.Close()
	localAddr := conn.LocalAddr().(*net.UDPAddr)
	return localAddr.IP.String()
}

func handleForwardedChannels(client *ssh.Client, sessionDone chan struct{}) {
	chans := client.HandleChannelOpen("forwarded-tcpip")
	if chans == nil {
		log.Println("[Agent] Could not register forwarded-tcpip channel handler")
		return
	}

	for {
		select {
		case newCh, ok := <-chans:
			if !ok {
				// Channel closed — SSH connection dropped
				return
			}
			go handleForwardedChannel(newCh)
		case <-done:
			return
		}
	}
}

func handleForwardedChannel(newCh ssh.NewChannel) {
	// Parse the forwarded-tcpip payload to determine target port
	var payload forwardedTCPPayload
	if err := ssh.Unmarshal(newCh.ExtraData(), &payload); err != nil {
		log.Printf("[Agent] Failed to parse forwarded-tcpip payload: %v", err)
		newCh.Reject(ssh.ConnectionFailed, "invalid payload")
		return
	}

	targetAddr := fmt.Sprintf("127.0.0.1:%d", payload.Port)

	// Connect to local service
	localConn, err := net.DialTimeout("tcp", targetAddr, 5*time.Second)
	if err != nil {
		log.Printf("[Agent] Failed to connect to local %s: %v", targetAddr, err)
		newCh.Reject(ssh.ConnectionFailed, "local service unavailable")
		return
	}

	// Accept the SSH channel
	channel, reqs, err := newCh.Accept()
	if err != nil {
		log.Printf("[Agent] Failed to accept channel: %v", err)
		localConn.Close()
		return
	}
	go ssh.DiscardRequests(reqs)

	// Bidirectional copy
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		io.Copy(channel, localConn)
		channel.CloseWrite()
	}()

	go func() {
		defer wg.Done()
		io.Copy(localConn, channel)
		localConn.Close()
	}()

	wg.Wait()
	channel.Close()
	localConn.Close()
}
