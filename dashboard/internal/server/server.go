package server

import (
	"context"
	"fmt"
	"io/fs"
	"net/http"

	"github.com/mewbing/XKeen-UI-Xmeow/internal/config"
	"github.com/mewbing/XKeen-UI-Xmeow/internal/spa"
)

// Server wraps the HTTP server with config and router.
type Server struct {
	httpServer *http.Server
	cfg        *config.AppConfig
}

// New creates a new Server with chi router, SPA handler, and all middleware wired.
func New(cfg *config.AppConfig, distFS fs.FS) *Server {
	spaHandler := spa.NewSPAHandler(distFS)
	router := NewRouter(cfg, spaHandler)

	return &Server{
		httpServer: &http.Server{
			Addr:    fmt.Sprintf(":%d", cfg.Port),
			Handler: router,
		},
		cfg: cfg,
	}
}

// Start begins listening and serving HTTP requests.
// Returns http.ErrServerClosed when Shutdown is called.
func (s *Server) Start() error {
	return s.httpServer.ListenAndServe()
}

// Shutdown gracefully shuts down the server with the given context.
func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}
