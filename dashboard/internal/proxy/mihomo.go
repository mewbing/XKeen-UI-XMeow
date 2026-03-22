package proxy

import (
	"encoding/json"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
)

// NewMihomoProxy creates a reverse proxy handler that forwards /api/mihomo/*
// requests to the mihomo external-controller with automatic Authorization
// header injection.
//
// The mihomo address is auto-detected from config.yaml external-controller field.
// The secret is read from config.yaml secret field and injected as Bearer token.
//
// If mihomo address is empty or config not found, returns a handler that
// responds with 503 Service Unavailable.
func NewMihomoProxy(cfg *config.AppConfig) http.Handler {
	address := config.GetMihomoExternalController(cfg.MihomoConfigPath)

	if address == "" {
		log.Printf("Mihomo reverse proxy disabled: external-controller not configured")
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Mihomo not configured",
			})
		})
	}

	target, err := url.Parse("http://" + address)
	if err != nil {
		log.Printf("Mihomo reverse proxy disabled: invalid address %q: %v", address, err)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Mihomo not configured",
			})
		})
	}

	log.Printf("Mihomo reverse proxy -> %s", target)

	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(target)
			// Strip /api/mihomo prefix from path
			pr.Out.URL.Path = strings.TrimPrefix(pr.Out.URL.Path, "/api/mihomo")
			if pr.Out.URL.Path == "" {
				pr.Out.URL.Path = "/"
			}
			// Read secret dynamically on each request — config.yaml may change
			// at runtime or may not have been available at server startup.
			secret := config.GetMihomoSecret(cfg.MihomoConfigPath)
			if secret != "" {
				pr.Out.Header.Set("Authorization", "Bearer "+secret)
			}
		},
	}

	return proxy
}
