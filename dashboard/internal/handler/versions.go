package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
)

// versionRe matches a version string with 2+ numeric segments: 1.2, 1.2.3, 1.1.3.9, etc.
// Allows optional pre-release suffix: 1.2.3-beta, 1.1.3.9-rc1
var versionRe = regexp.MustCompile(`\d+(?:\.\d+)+(?:-[\w.]+)?`)

// GetVersions returns server, dashboard, xkeen, and mihomo versions.
// Response: 200 {"server": "...", "dashboard": "...", "xkeen": "...", "mihomo": "..."}
func (h *Handlers) GetVersions(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// xkeen version — extract just the semver part, ignore build date
	xkeenVersion := "unknown"
	out, err := exec.CommandContext(ctx, h.cfg.XkeenBin, "-v").Output()
	if err == nil {
		if v := versionRe.FindString(strings.TrimSpace(string(out))); v != "" {
			xkeenVersion = v
		}
	}

	// mihomo version from external-controller API
	mihomoVersion := fetchMihomoVersion(ctx, h.cfg)

	writeJSON(w, http.StatusOK, map[string]string{
		"server":    h.cfg.Version,
		"dashboard": h.cfg.Version,
		"xkeen":     xkeenVersion,
		"mihomo":    mihomoVersion,
		"arch":      runtime.GOARCH,
	})
}

// fetchMihomoVersion calls mihomo's /version endpoint via external-controller.
func fetchMihomoVersion(ctx context.Context, cfg *config.AppConfig) string {
	address := config.GetMihomoExternalController(cfg.MihomoConfigPath)
	if address == "" {
		return "unknown"
	}

	secret := config.GetMihomoSecret(cfg.MihomoConfigPath)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("http://%s/version", address), nil)
	if err != nil {
		return "unknown"
	}
	if secret != "" {
		req.Header.Set("Authorization", "Bearer "+secret)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "unknown"
	}
	defer resp.Body.Close()

	var data struct {
		Version string `json:"version"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "unknown"
	}
	if data.Version == "" {
		return "unknown"
	}
	return data.Version
}
