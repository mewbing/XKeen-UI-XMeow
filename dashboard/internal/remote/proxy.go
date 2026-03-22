package remote

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/mewbing/XKeen-UI-XMeow/internal/sshserver"
)

// stripCORSHeaders removes CORS headers from upstream responses to prevent
// double CORS headers (*, *) when both the upstream service and our CORS
// middleware each add their own Access-Control-Allow-Origin: * header.
func stripCORSHeaders(resp *http.Response) error {
	resp.Header.Del("Access-Control-Allow-Origin")
	resp.Header.Del("Access-Control-Allow-Methods")
	resp.Header.Del("Access-Control-Allow-Headers")
	resp.Header.Del("Access-Control-Allow-Credentials")
	resp.Header.Del("Access-Control-Expose-Headers")
	resp.Header.Del("Access-Control-Max-Age")
	return nil
}

// Proxy forwards HTTP requests to remote agent services, either through
// SSH tunnels (for tunnel agents) or directly by IP:port (for direct agents).
type Proxy struct {
	sshServer   *sshserver.Server
	directStore *DirectStore
}

// NewProxy creates a new Proxy that uses the SSH server for tunnel lookups
// and the DirectStore for direct IP:port connections.
func NewProxy(sshServer *sshserver.Server, directStore *DirectStore) *Proxy {
	return &Proxy{sshServer: sshServer, directStore: directStore}
}

// resolveAgentTarget resolves the agent ID to the xmeow-server target URL.
// For tunnel agents: SSH tunnel port 5000.
// For direct agents: host:ServerPort (if configured), otherwise error.
func (p *Proxy) resolveAgentTarget(agentID string) (target *url.URL, tunnelAuth bool, secret string, err error) {
	// Try SSH tunnel agent first
	if p.sshServer != nil {
		if agent := p.sshServer.GetAgent(agentID); agent != nil {
			localPort, ok := agent.GetLocalPort(5000)
			if ok {
				t, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", localPort))
				return t, true, "", nil
			}
		}
	}

	// Try direct agent (only if ServerPort is configured)
	if p.directStore != nil {
		if direct := p.directStore.Get(agentID); direct != nil {
			if direct.ServerPort <= 0 {
				return nil, false, "", fmt.Errorf("xmeow-server not configured for this agent")
			}
			t, _ := url.Parse(fmt.Sprintf("http://%s:%d", direct.Host, direct.ServerPort))
			return t, false, direct.Secret, nil
		}
	}

	return nil, false, "", fmt.Errorf("agent not connected")
}

// resolveAgentMihomoTarget resolves the agent ID to the mihomo API target URL.
// For tunnel agents: prefers direct mihomo (port 9090) — works without xmeow-server.
// Falls back to xmeow-server proxy (port 5000) if port 9090 is not tunneled.
// For direct agents: connects directly to mihomo external-controller (host:MihomoPort).
// Returns directMihomo=true when connecting directly to mihomo (path has no /api/mihomo prefix).
func (p *Proxy) resolveAgentMihomoTarget(agentID string) (target *url.URL, tunnelAuth bool, secret string, directMihomo bool, err error) {
	// Try SSH tunnel agent
	if p.sshServer != nil {
		if agent := p.sshServer.GetAgent(agentID); agent != nil {
			// Prefer direct mihomo (port 9090) — works even without xmeow-server
			if localPort, ok := agent.GetLocalPort(9090); ok {
				t, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", localPort))
				return t, false, agent.GetMihomoSecret(), true, nil
			}
			// Fallback to xmeow-server proxy (port 5000)
			if localPort, ok := agent.GetLocalPort(5000); ok {
				t, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", localPort))
				return t, true, "", false, nil
			}
		}
	}

	// Try direct agent — connect directly to mihomo external-controller
	if p.directStore != nil {
		if direct := p.directStore.Get(agentID); direct != nil {
			t, _ := url.Parse(fmt.Sprintf("http://%s:%d", direct.Host, direct.MihomoPort))
			return t, false, direct.Secret, true, nil
		}
	}

	return nil, false, "", false, fmt.Errorf("agent not connected")
}

// ProxyToAgent forwards requests to the remote agent's XMeow API (port 5000).
// Route: /api/remote/{agentID}/proxy/*
//
// For tunnel agents: strips Authorization, sets X-Tunnel-Auth: true.
// For direct agents: sets Authorization: Bearer {stored_secret}.
func (p *Proxy) ProxyToAgent(w http.ResponseWriter, r *http.Request) {
	agentID := chi.URLParam(r, "agentID")
	target, tunnelAuth, secret, err := p.resolveAgentTarget(agentID)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, err.Error())
		return
	}

	prefix := fmt.Sprintf("/api/remote/%s/proxy", agentID)

	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(target)
			pr.Out.URL.Path = strings.TrimPrefix(pr.Out.URL.Path, prefix)
			if pr.Out.URL.Path == "" {
				pr.Out.URL.Path = "/"
			}
			pr.Out.Header.Del("Authorization")
			if tunnelAuth {
				pr.Out.Header.Set("X-Tunnel-Auth", "true")
			} else if secret != "" {
				pr.Out.Header.Set("Authorization", "Bearer "+secret)
			}
		},
		ModifyResponse: stripCORSHeaders,
	}
	proxy.ServeHTTP(w, r)
}

// ProxyToAgentMihomo forwards requests to the remote agent's mihomo API.
// Route: /api/remote/{agentID}/mihomo/*
//
// For tunnel agents: routes through xmeow-server's /api/mihomo/* proxy
//
//	/api/remote/{id}/mihomo/connections → /api/mihomo/connections (on xmeow-server)
//
// For direct agents: connects directly to mihomo external-controller
//
//	/api/remote/{id}/mihomo/connections → /connections (on mihomo)
func (p *Proxy) ProxyToAgentMihomo(w http.ResponseWriter, r *http.Request) {
	agentID := chi.URLParam(r, "agentID")
	target, tunnelAuth, secret, directMihomo, err := p.resolveAgentMihomoTarget(agentID)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, err.Error())
		return
	}

	prefix := fmt.Sprintf("/api/remote/%s/mihomo", agentID)

	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(target)
			path := strings.TrimPrefix(pr.Out.URL.Path, prefix)
			if path == "" {
				path = "/"
			}

			if directMihomo {
				// Direct to mihomo: raw API path (e.g. /connections, /proxies)
				pr.Out.URL.Path = path
			} else {
				// Through xmeow-server: prepend /api/mihomo
				pr.Out.URL.Path = "/api/mihomo" + path
			}

			pr.Out.Header.Del("Authorization")
			q := pr.Out.URL.Query()
			q.Del("token")

			if tunnelAuth {
				pr.Out.Header.Set("X-Tunnel-Auth", "true")
			} else if secret != "" {
				pr.Out.Header.Set("Authorization", "Bearer "+secret)
				if directMihomo {
					// Also add as query param — mihomo WebSocket endpoints
					// and some configurations prefer token in URL.
					q.Set("token", secret)
				}
			}

			pr.Out.URL.RawQuery = q.Encode()

			log.Printf("[Remote Mihomo Proxy] %s %s → %s%s (directMihomo=%v, hasSecret=%v)",
				r.Method, r.URL.Path, target, pr.Out.URL.Path, directMihomo, secret != "")
		},
		ModifyResponse: func(resp *http.Response) error {
			if resp.StatusCode >= 400 {
				log.Printf("[Remote Mihomo Proxy] upstream returned %d for %s", resp.StatusCode, resp.Request.URL.String())
			}
			return stripCORSHeaders(resp)
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
