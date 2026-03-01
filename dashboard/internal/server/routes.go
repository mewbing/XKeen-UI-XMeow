package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/mewbing/XKeen-UI-Xmeow/internal/config"
	"github.com/mewbing/XKeen-UI-Xmeow/internal/handler"
)

// NewRouter creates a chi.Mux with all route registrations.
// spaHandler serves the embedded SPA as a catch-all fallback.
func NewRouter(cfg *config.AppConfig, spaHandler http.Handler) *chi.Mux {
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

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Health endpoint -- no auth required (for monitoring)
		r.Get("/health", handler.Health)

		// Protected API routes -- require auth
		r.Group(func(r chi.Router) {
			r.Use(AuthMiddleware(getSecret))

			// Config endpoints (plan 02)
			// r.Get("/config", handler.GetConfig)
			// r.Put("/config", handler.PutConfig)

			// Xkeen file endpoints (plan 02)
			// r.Get("/xkeen/{filename}", handler.GetXkeenFile)
			// r.Put("/xkeen/{filename}", handler.PutXkeenFile)

			// Service management endpoints (plan 02)
			// r.Post("/service/{action}", handler.ServiceAction)
			// r.Get("/service/status", handler.ServiceStatus)

			// Versions endpoint (plan 02)
			// r.Get("/versions", handler.GetVersions)

			// System metrics endpoints (plan 02)
			// r.Get("/system/cpu", handler.SystemCPU)
			// r.Get("/system/network", handler.SystemNetwork)

			// Log endpoints (plan 02)
			// r.Get("/logs/{name}", handler.GetLogFile)
			// r.Get("/logs/{name}/parsed", handler.GetParsedLog)
			// r.Post("/logs/{name}/clear", handler.ClearLog)

			// Proxy servers endpoint (plan 02)
			// r.Get("/proxies/servers", handler.ProxyServers)
		})
	})

	// WebSocket route (plan 03)
	// r.Get("/ws/logs", handler.WsLogStream)

	// Mihomo reverse proxy (plan 04)
	// r.Handle("/api/mihomo/*", mihomoProxy)

	// SPA fallback (LAST -- catches all unmatched routes)
	r.NotFound(spaHandler.ServeHTTP)

	return r
}
