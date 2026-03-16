package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
	"github.com/mewbing/XKeen-UI-XMeow/internal/server"
)

// Version is set via ldflags at build time:
//
//	go build -ldflags "-X main.Version=1.0.0" ./cmd/xmeow-server/
var Version = "0.1.0"

func main() {
	// Print bare version string and exit (used by installer for update detection)
	if len(os.Args) > 1 && (os.Args[1] == "--version" || os.Args[1] == "-v") {
		fmt.Println(Version)
		os.Exit(0)
	}

	// Load configuration from environment variables
	cfg := config.LoadConfig()
	cfg.Version = Version

	log.Printf("XMeow Dashboard v%s", cfg.Version)
	if cfg.DevMode {
		log.Println("Running in development mode (CORS enabled)")
	}
	if cfg.RemoteEnabled {
		log.Printf("Remote management enabled (SSH port: %d)", cfg.SSHPort)
	}

	// Create API server (SPA served by mihomo via external-ui)
	srv := server.New(cfg)

	// Graceful shutdown with signal.NotifyContext (SIGINT, SIGTERM)
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Start server in goroutine
	go func() {
		log.Printf("XMeow Dashboard listening on :%d", cfg.Port)
		if err := srv.Start(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for interrupt signal
	<-ctx.Done()
	log.Println("Shutting down...")

	// 5-second shutdown timeout
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Shutdown error: %v", err)
	}

	log.Println("Server stopped")
}
