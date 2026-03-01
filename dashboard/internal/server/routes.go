package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/mewbing/XKeen-UI-Xmeow/internal/config"
	"github.com/mewbing/XKeen-UI-Xmeow/internal/handler"
	"github.com/mewbing/XKeen-UI-Xmeow/internal/logwatch"
	"github.com/mewbing/XKeen-UI-Xmeow/internal/proxy"
)

// NewRouter creates a chi.Mux with all route registrations.
// spaHandler serves the embedded SPA as a catch-all fallback.
// logHub manages WebSocket clients and file watchers.
func NewRouter(cfg *config.AppConfig, spaHandler http.Handler, logHub *logwatch.LogHub) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)

	// CORS middleware (dev mode only, per GOBK-07)
	if cfg.DevMode {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   []string{"*"},
			AllowedMethods:   []string{"GET", "PUT", "POST", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-API-Key"},
			AllowCredentials: true,
		}))
	}

	// Auth middleware getter -- reads secret from mihomo config on each request
	getSecret := func() string {
		return config.GetMihomoSecret(cfg.MihomoConfigPath)
	}

	// Create handlers with shared config dependency
	h := handler.NewHandlers(cfg)

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Health endpoint -- no auth required (for monitoring)
		r.Get("/health", handler.Health)

		// Protected API routes -- require auth
		r.Group(func(r chi.Router) {
			r.Use(AuthMiddleware(getSecret))

			// Config endpoints
			r.Get("/config", h.GetConfig)
			r.Put("/config", h.PutConfig)

			// Xkeen file endpoints
			r.Get("/xkeen/{filename}", h.GetXkeenFile)
			r.Put("/xkeen/{filename}", h.PutXkeenFile)

			// Service management endpoints
			r.Post("/service/{action}", h.ServiceAction)
			r.Get("/service/status", h.ServiceStatus)

			// Versions endpoint
			r.Get("/versions", h.GetVersions)

			// System metrics endpoints
			r.Get("/system/cpu", h.SystemCPU)
			r.Get("/system/network", h.SystemNetwork)

			// Log endpoints
			r.Get("/logs/{name}", h.GetLogFile)
			r.Get("/logs/{name}/parsed", h.GetParsedLog)
			r.Post("/logs/{name}/clear", h.ClearLog)

			// Proxy servers endpoint
			r.Get("/proxies/servers", h.ProxyServers)
		})
	})

	// WebSocket route (outside /api group, no auth on WS upgrade)
	wsLogHandler := handler.NewWsLogHandler(logHub, cfg)
	r.Get("/ws/logs", wsLogHandler.ServeHTTP)

	// Mihomo reverse proxy -- forwards /api/mihomo/* to mihomo external-controller
	// with automatic Authorization header injection (reads from config.yaml)
	mihomoProxy := proxy.NewMihomoProxy(cfg)
	r.Handle("/api/mihomo/*", mihomoProxy)

	// SPA fallback (LAST -- catches all unmatched routes)
	r.NotFound(spaHandler.ServeHTTP)

	return r
}
