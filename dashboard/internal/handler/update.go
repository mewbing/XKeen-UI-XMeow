package handler

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
	"github.com/mewbing/XKeen-UI-XMeow/internal/updater"
)

const initdScript = "/opt/etc/init.d/S99xmeow-server"

// UpdateHandler handles update-related HTTP endpoints.
// Separated from Handlers because it depends on updater.Updater.
type UpdateHandler struct {
	updater *updater.Updater
	cfg     *config.AppConfig
}

// NewUpdateHandler creates a new UpdateHandler.
func NewUpdateHandler(upd *updater.Updater, cfg *config.AppConfig) *UpdateHandler {
	return &UpdateHandler{
		updater: upd,
		cfg:     cfg,
	}
}

// CheckUpdate handles GET /api/update/check.
// Returns version comparison and release metadata from GitHub API (cached for 1 hour).
// On non-critical errors (rate limit, no asset, network), returns 200 with has_update=false
// instead of 500, so the frontend console stays clean.
func (u *UpdateHandler) CheckUpdate(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	info, err := u.updater.Check(ctx)
	if err != nil {
		log.Printf("update check error (non-fatal): %v", err)
		writeJSON(w, http.StatusOK, &updater.ReleaseInfo{
			CurrentVersion: u.cfg.Version,
			LatestVersion:  u.cfg.Version,
			HasUpdate:      false,
			IsExternalUI:   u.updater.IsExternalUI(),
		})
		return
	}

	writeJSON(w, http.StatusOK, info)
}

// ApplyUpdate handles POST /api/update/apply.
// Downloads the latest binary, verifies SHA256, replaces the current binary, and restarts via init.d.
func (u *UpdateHandler) ApplyUpdate(w http.ResponseWriter, r *http.Request) {
	if u.updater.IsUpdating() {
		writeJSON(w, http.StatusConflict, map[string]string{
			"error": "update already in progress",
		})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	if err := u.updater.Apply(ctx); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
		return
	}

	// Send response BEFORE restart -- the process will be killed by init.d
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "restarting",
		"message": "Update applied, restarting...",
	})
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}

	// Schedule restart with 1s delay to allow HTTP response to be sent
	time.AfterFunc(1*time.Second, restartService)
}

// RollbackUpdate handles POST /api/update/rollback.
// Restores the previous binary from .bak backup and restarts.
func (u *UpdateHandler) RollbackUpdate(w http.ResponseWriter, r *http.Request) {
	if err := u.updater.Rollback(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
		return
	}

	// Send response BEFORE restart
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "restarting",
		"message": "Rollback applied, restarting...",
	})
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}

	// Schedule restart with 1s delay
	time.AfterFunc(1*time.Second, restartService)
}

// ApplyDist handles POST /api/update/apply-dist.
// Downloads dist.tar.gz and extracts it into mihomo's external-ui directory.
// Only available in external-ui mode (SUPD-06).
func (u *UpdateHandler) ApplyDist(w http.ResponseWriter, r *http.Request) {
	if !u.updater.IsExternalUI() {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "not in external-ui mode",
		})
		return
	}

	if u.updater.IsUpdating() {
		writeJSON(w, http.StatusConflict, map[string]string{
			"error": "update already in progress",
		})
		return
	}

	// Resolve external-ui directory from mihomo config
	externalUI := config.ReadMihomoField(u.cfg.MihomoConfigPath, "external-ui")
	if externalUI == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "external-ui not configured in mihomo config",
		})
		return
	}

	// Resolve relative path against mihomo config directory
	externalUIDir := externalUI
	if !filepath.IsAbs(externalUIDir) {
		externalUIDir = filepath.Join(filepath.Dir(u.cfg.MihomoConfigPath), externalUI)
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	if err := u.updater.ApplyDist(ctx, externalUIDir); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"message": "Dashboard updated",
	})
}

// restartService attempts to restart via init.d script.
// This is fire-and-forget: the init.d script will kill the current process.
// If the script is not found, we log a warning (response was already sent).
func restartService() {
	if _, err := os.Stat(initdScript); os.IsNotExist(err) {
		log.Printf("WARNING: init.d script not found at %s, cannot restart automatically", initdScript)
		return
	}

	log.Printf("Restarting service via %s restart", initdScript)
	if err := exec.Command(initdScript, "restart").Start(); err != nil {
		log.Printf("WARNING: failed to restart service: %v", err)
	}
}
