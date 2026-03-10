package handler

import (
	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
)

// Handlers holds shared dependencies for all API handlers.
type Handlers struct {
	cfg *config.AppConfig
}

// NewHandlers creates a new Handlers instance with the given config.
func NewHandlers(cfg *config.AppConfig) *Handlers {
	return &Handlers{cfg: cfg}
}
