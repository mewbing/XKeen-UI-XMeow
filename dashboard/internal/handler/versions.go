package handler

import (
	"context"
	"net/http"
	"os/exec"
	"strings"
	"time"
)

// GetVersions returns xkeen and dashboard versions.
// Response: 200 {"xkeen": "...", "dashboard": "..."}
func (h *Handlers) GetVersions(w http.ResponseWriter, r *http.Request) {
	// xkeen version: use full path from config (NOT bare "xkeen" -- PATH may not include /opt/sbin)
	xkeenVersion := "unknown"
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	out, err := exec.CommandContext(ctx, h.cfg.XkeenBin, "-v").Output()
	if err == nil {
		lines := strings.SplitN(strings.TrimSpace(string(out)), "\n", 2)
		if len(lines) > 0 && lines[0] != "" {
			xkeenVersion = lines[0]
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"xkeen":     xkeenVersion,
		"dashboard": h.cfg.Version,
	})
}
