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
func AuthMiddleware(getSecret func() string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip auth for OPTIONS requests (CORS preflight)
			if r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
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
