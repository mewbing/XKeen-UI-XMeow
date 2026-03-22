package server

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
	"github.com/mewbing/XKeen-UI-XMeow/internal/handler"
	"github.com/mewbing/XKeen-UI-XMeow/internal/logwatch"
	"github.com/mewbing/XKeen-UI-XMeow/internal/proxy"
	"github.com/mewbing/XKeen-UI-XMeow/internal/releases"
	"github.com/mewbing/XKeen-UI-XMeow/internal/remote"
	"github.com/mewbing/XKeen-UI-XMeow/internal/sshserver"
	"github.com/mewbing/XKeen-UI-XMeow/internal/terminal"
	"github.com/mewbing/XKeen-UI-XMeow/internal/updater"
)

// NewRouter creates a chi.Mux with all route registrations.
// The SPA is served by mihomo via external-ui; this server is API-only.
func NewRouter(cfg *config.AppConfig, logHub *logwatch.LogHub, upd *updater.Updater, termHub *terminal.Hub, relCache *releases.Cache, mihomoInst *releases.MihomoInstaller, xmeowInst *releases.XmeowInstaller, remoteStore *remote.Store, directStore *remote.DirectStore, sshSrv *sshserver.Server) (*chi.Mux, *handler.RemoteHandler) {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	if cfg.DevMode {
		r.Use(middleware.Logger)
	}

	// CORS middleware -- always enabled because the dashboard may be served
	// from mihomo external-ui (port 9090) while the backend runs on port 5000
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "PUT", "POST", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-API-Key"},
		AllowCredentials: true,
	}))

	// Auth middleware getter -- reads secret from mihomo config on each request
	getSecret := func() string {
		return config.GetMihomoSecret(cfg.MihomoConfigPath)
	}

	// Create handlers with shared config dependency
	h := handler.NewHandlers(cfg)
	uh := handler.NewUpdateHandler(upd, cfg)
	rh := handler.NewReleasesHandler(relCache, mihomoInst, xmeowInst, cfg)

	// Remote management handler (nil-safe — only created if store is available)
	var rmt *handler.RemoteHandler
	if remoteStore != nil {
		rmt = handler.NewRemoteHandler(remoteStore, directStore, sshSrv, remote.NewProxy(sshSrv, directStore), cfg)
	}

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
			r.Get("/system/memory", h.SystemMemory)
			r.Get("/system/network", h.SystemNetwork)

			// Log endpoints
			r.Get("/logs/{name}", h.GetLogFile)
			r.Get("/logs/{name}/parsed", h.GetParsedLog)
			r.Post("/logs/{name}/clear", h.ClearLog)

			// Proxy servers endpoint
			r.Get("/proxies/servers", h.ProxyServers)

			// Update endpoints
			r.Route("/update", func(r chi.Router) {
				r.Get("/check", uh.CheckUpdate)
				r.Post("/apply", uh.ApplyUpdate)
				r.Post("/rollback", uh.RollbackUpdate)
				r.Post("/apply-dist", uh.ApplyDist)
			})

			// Releases endpoints (mihomo/xkeen/xmeow version management)
			r.Get("/releases/mihomo", rh.MihomoReleases)
			r.Get("/releases/xkeen", rh.XkeenReleases)
			r.Get("/releases/xmeow", rh.XmeowReleases)
			r.Post("/releases/mihomo/install", rh.InstallMihomo)
			r.Post("/releases/xmeow/install", rh.InstallXmeow)

			// Remote management endpoints
			if rmt != nil {
				r.Route("/remote", func(r chi.Router) {
					r.Get("/agents", rmt.ListAgents)
					r.Post("/tokens", rmt.CreateToken)
					r.Get("/tokens", rmt.ListTokens)
					r.Delete("/tokens/{id}", rmt.RevokeToken)
					r.Delete("/agents/{id}", rmt.DeleteAgent)
					r.Post("/direct", rmt.CreateDirect)

					// Proxy to remote agent services (wildcard routes)
					r.HandleFunc("/{agentID}/proxy/*", rmt.ProxyToAgent)
					r.HandleFunc("/{agentID}/mihomo/*", rmt.ProxyToAgentMihomo)
				})
			}
		})
	})

	// WebSocket routes (outside /api group)
	wsLogHandler := handler.NewWsLogHandler(logHub, cfg)
	r.Get("/ws/logs", wsLogHandler.ServeHTTP)

	// Terminal WebSocket (has its own auth check in handler -- token as query param)
	wsTermHandler := handler.NewWsTerminalHandler(termHub, cfg)
	r.Get("/ws/terminal", wsTermHandler.ServeHTTP)

	// Remote agent status WebSocket (has its own auth check in handler)
	if rmt != nil {
		r.Get("/ws/remote/status", rmt.WsRemoteStatus)

		// Remote terminal WebSocket — SSH through tunnel, no xmeow-server required
		wsRemoteTermHandler := handler.NewWsRemoteTerminalHandler(sshSrv, directStore, cfg)
		r.Get("/ws/remote/{agentID}/terminal", wsRemoteTermHandler.ServeHTTP)
	}

	// Mihomo reverse proxy -- forwards /api/mihomo/* to mihomo external-controller
	// with automatic Authorization header injection (reads from config.yaml)
	mihomoProxy := proxy.NewMihomoProxy(cfg)
	r.Handle("/api/mihomo/*", mihomoProxy)

	// 404 JSON for unmatched API routes (SPA served by mihomo external-ui)
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "not found"})
	})

	return r, rmt
}
