package server

import (
	"encoding/json"
	"net/http"
	"strings"
)

// AuthMiddleware returns a chi-compatible middleware that validates
// the API key from Authorization or X-API-Key headers.
//
// getSecret is called on each request to get the current secret
// (reads from mihomo config.yaml). If the secret is empty (not configured),
// auth is skipped (all requests allowed).
//
// Requests with X-Tunnel-Auth header from localhost (SSH tunnel proxy) bypass auth.
// This is safe because only the master backend can set this header, and the master
// already verified the user's authentication before proxying through the tunnel.
func AuthMiddleware(getSecret func() string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip auth for OPTIONS requests (CORS preflight)
			if r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// Trust requests proxied through SSH tunnel from master backend.
			// X-Tunnel-Auth is set by the master's remote proxy, and the connection
			// comes from localhost via the SSH reverse tunnel.
			if r.Header.Get("X-Tunnel-Auth") == "true" {
				remoteIP := r.RemoteAddr
				// RemoteAddr is "IP:port", check that IP is loopback
				if idx := strings.LastIndex(remoteIP, ":"); idx >= 0 {
					remoteIP = remoteIP[:idx]
				}
				if remoteIP == "127.0.0.1" || remoteIP == "::1" || remoteIP == "[::1]" {
					// Strip the tunnel auth header so it can't be forwarded further
					r.Header.Del("X-Tunnel-Auth")
					next.ServeHTTP(w, r)
					return
				}
			}

			secret := getSecret()

			// If no secret configured, skip auth entirely
			if secret == "" {
				next.ServeHTTP(w, r)
				return
			}

			// Check Authorization: Bearer {token}
			token := ""
			if auth := r.Header.Get("Authorization"); auth != "" {
				if strings.HasPrefix(auth, "Bearer ") {
					token = strings.TrimPrefix(auth, "Bearer ")
				}
			}

			// Fallback: check X-API-Key header
			if token == "" {
				token = r.Header.Get("X-API-Key")
			}

			// Fallback: check ?token= query param (WebSocket can't send custom headers)
			if token == "" {
				token = r.URL.Query().Get("token")
			}

			// Validate token
			if token != secret {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized"})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
