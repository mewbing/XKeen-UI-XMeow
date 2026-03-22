package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"time"

	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
	"github.com/mewbing/XKeen-UI-XMeow/internal/handler"
	"github.com/mewbing/XKeen-UI-XMeow/internal/logwatch"
	"github.com/mewbing/XKeen-UI-XMeow/internal/releases"
	"github.com/mewbing/XKeen-UI-XMeow/internal/remote"
	"github.com/mewbing/XKeen-UI-XMeow/internal/sshserver"
	"github.com/mewbing/XKeen-UI-XMeow/internal/terminal"
	"github.com/mewbing/XKeen-UI-XMeow/internal/updater"
)

// Server wraps the HTTP server with config, router, LogHub, terminal Hub, and SSH server.
type Server struct {
	httpServer    *http.Server
	cfg           *config.AppConfig
	logHub        *logwatch.LogHub
	termHub       *terminal.Hub
	sshServer     *sshserver.Server
	remoteHandler *handler.RemoteHandler
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

	// Initialize remote management (SSH server + token store + direct store) if enabled
	var sshSrv *sshserver.Server
	var remoteStore *remote.Store
	var directStore *remote.DirectStore
	if cfg.RemoteEnabled {
		remoteStore = remote.NewStore(cfg.AgentsFilePath)
		directStore = remote.NewDirectStore(
			filepath.Join(filepath.Dir(cfg.AgentsFilePath), "direct-agents.json"),
		)
		var err error
		sshSrv, err = sshserver.NewServer(
			cfg.SSHHostKeyPath,
			remoteStore.ValidateToken,
			remoteStore.UpdateLastSeen,
		)
		if err != nil {
			log.Printf("WARNING: SSH server init failed: %v (remote management disabled)", err)
			cfg.RemoteEnabled = false
			sshSrv = nil
			remoteStore = nil
			directStore = nil
		}
	}

	router, remoteHandler := NewRouter(cfg, logHub, upd, termHub, relCache, mihomoInst, xmeowInst, remoteStore, directStore, sshSrv)

	return &Server{
		httpServer: &http.Server{
			Addr:    fmt.Sprintf(":%d", cfg.Port),
			Handler: router,
		},
		cfg:           cfg,
		logHub:        logHub,
		termHub:       termHub,
		sshServer:     sshSrv,
		remoteHandler: remoteHandler,
	}
}

// Start begins listening and serving HTTP requests.
// Also starts the SSH server in a background goroutine if remote management is enabled.
// Returns http.ErrServerClosed when Shutdown is called.
func (s *Server) Start() error {
	// Start SSH server if enabled
	if s.sshServer != nil {
		go func() {
			addr := fmt.Sprintf(":%d", s.cfg.SSHPort)
			log.Printf("SSH server listening on %s", addr)
			if err := s.sshServer.ListenAndServe(addr); err != nil {
				log.Printf("SSH server error: %v", err)
			}
		}()
	}

	return s.httpServer.ListenAndServe()
}

// Shutdown gracefully shuts down the server, LogHub, terminal Hub, SSH server, and all WS connections.
func (s *Server) Shutdown(ctx context.Context) error {
	if s.remoteHandler != nil {
		log.Printf("Shutting down remote handler...")
		s.remoteHandler.Shutdown()
	}
	if s.sshServer != nil {
		log.Printf("Shutting down SSH server...")
		s.sshServer.Shutdown()
	}
	log.Printf("Shutting down LogHub...")
	s.logHub.Shutdown()
	log.Printf("Shutting down terminal Hub...")
	s.termHub.Shutdown()
	return s.httpServer.Shutdown(ctx)
}
