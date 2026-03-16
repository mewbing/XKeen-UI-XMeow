package remote

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/mewbing/XKeen-UI-XMeow/internal/sshserver"
)

// Proxy forwards HTTP requests through SSH tunnels to remote agent services.
type Proxy struct {
	sshServer *sshserver.Server
}

// NewProxy creates a new Proxy that uses the SSH server to look up agent tunnels.
func NewProxy(sshServer *sshserver.Server) *Proxy {
	return &Proxy{sshServer: sshServer}
}

// ProxyToAgent forwards requests to the remote agent's XMeow API (port 5000)
// through the SSH reverse tunnel.
// Route: /api/remote/{agentID}/proxy/*
func (p *Proxy) ProxyToAgent(w http.ResponseWriter, r *http.Request) {
	agentID := chi.URLParam(r, "agentID")
	agent := p.sshServer.GetAgent(agentID)
	if agent == nil {
		writeJSONError(w, http.StatusBadGateway, "agent not connected")
		return
	}

	localPort, ok := agent.GetLocalPort(5000)
	if !ok {
		writeJSONError(w, http.StatusBadGateway, "tunnel not established for port 5000")
		return
	}

	target, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", localPort))
	prefix := fmt.Sprintf("/api/remote/%s/proxy", agentID)

	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(target)
			pr.Out.URL.Path = strings.TrimPrefix(pr.Out.URL.Path, prefix)
			if pr.Out.URL.Path == "" {
				pr.Out.URL.Path = "/"
			}
		},
	}
	proxy.ServeHTTP(w, r)
}

// ProxyToAgentMihomo forwards requests to the remote agent's mihomo API (port 9090)
// through the SSH reverse tunnel.
// Route: /api/remote/{agentID}/mihomo/*
func (p *Proxy) ProxyToAgentMihomo(w http.ResponseWriter, r *http.Request) {
	agentID := chi.URLParam(r, "agentID")
	agent := p.sshServer.GetAgent(agentID)
	if agent == nil {
		writeJSONError(w, http.StatusBadGateway, "agent not connected")
		return
	}

	localPort, ok := agent.GetLocalPort(9090)
	if !ok {
		writeJSONError(w, http.StatusBadGateway, "tunnel not established for port 9090")
		return
	}

	target, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", localPort))
	prefix := fmt.Sprintf("/api/remote/%s/mihomo", agentID)

	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(target)
			pr.Out.URL.Path = strings.TrimPrefix(pr.Out.URL.Path, prefix)
			if pr.Out.URL.Path == "" {
				pr.Out.URL.Path = "/"
			}
		},
	}
	proxy.ServeHTTP(w, r)
}

// writeJSONError writes a JSON error response with the given status code.
func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
