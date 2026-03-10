package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
	"github.com/mewbing/XKeen-UI-XMeow/internal/logwatch"
	"github.com/mewbing/XKeen-UI-XMeow/internal/releases"
	"github.com/mewbing/XKeen-UI-XMeow/internal/terminal"
	"github.com/mewbing/XKeen-UI-XMeow/internal/updater"
)

// Server wraps the HTTP server with config, router, LogHub, and terminal Hub.
type Server struct {
	httpServer *http.Server
	cfg        *config.AppConfig
	logHub     *logwatch.LogHub
	termHub    *terminal.Hub
}

// New creates a new Server with chi router, LogHub, Updater, and all middleware wired.
// The SPA is served by mihomo via external-ui; this server is API-only.
func New(cfg *config.AppConfig) *Server {
	logHub := logwatch.NewLogHub(cfg)
	upd := updater.NewUpdater(cfg)
	termHub := terminal.NewHub(30 * time.Minute)
	relCache := releases.NewCache(15 * time.Minute)
	mihomoInst := releases.NewMihomoInstaller(cfg)
	xmeowInst := releases.NewXmeowInstaller(cfg)
	router := NewRouter(cfg, logHub, upd, termHub, relCache, mihomoInst, xmeowInst)

	return &Server{
		httpServer: &http.Server{
			Addr:    fmt.Sprintf(":%d", cfg.Port),
			Handler: router,
		},
		cfg:     cfg,
		logHub:  logHub,
		termHub: termHub,
	}
}

// Start begins listening and serving HTTP requests.
// Returns http.ErrServerClosed when Shutdown is called.
func (s *Server) Start() error {
	return s.httpServer.ListenAndServe()
}

// Shutdown gracefully shuts down the server, LogHub, terminal Hub, and all WS connections.
func (s *Server) Shutdown(ctx context.Context) error {
	log.Printf("Shutting down LogHub...")
	s.logHub.Shutdown()
	log.Printf("Shutting down terminal Hub...")
	s.termHub.Shutdown()
	return s.httpServer.Shutdown(ctx)
}
