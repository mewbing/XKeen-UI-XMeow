package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os/exec"
	"strings"
	"time"

	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
	"github.com/mewbing/XKeen-UI-XMeow/internal/releases"
	"github.com/mewbing/XKeen-UI-XMeow/internal/updater"
)

// ReleasesHandler handles endpoints for listing releases and installing mihomo/xmeow versions.
type ReleasesHandler struct {
	cache        *releases.Cache
	installer    *releases.MihomoInstaller
	xmeowInst   *releases.XmeowInstaller
	cfg          *config.AppConfig
}

// NewReleasesHandler creates a new ReleasesHandler.
func NewReleasesHandler(cache *releases.Cache, installer *releases.MihomoInstaller, xmeowInst *releases.XmeowInstaller, cfg *config.AppConfig) *ReleasesHandler {
	return &ReleasesHandler{cache: cache, installer: installer, xmeowInst: xmeowInst, cfg: cfg}
}

// mihomoReleaseItem is a single release in the response.
type mihomoReleaseItem struct {
	TagName     string `json:"tag_name"`
	PublishedAt string `json:"published_at"`
	Body        string `json:"body"`
	AssetName   string `json:"asset_name"`
	AssetSize   int64  `json:"asset_size"`
	IsCurrent   bool   `json:"is_current"`
	IsNewer     bool   `json:"is_newer"`
}

// MihomoReleases returns 10 latest mihomo releases from GitHub.
// GET /api/releases/mihomo
func (h *ReleasesHandler) MihomoReleases(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	rels, err := h.cache.GetReleases(ctx, releases.MihomoRepo(), "XMeow/"+h.cfg.Version, 15)
	if err != nil {
		if errors.Is(err, releases.ErrNoRelease) {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"current_version": "unknown",
				"releases":        []interface{}{},
			})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
		return
	}

	// Get current mihomo version
	vctx, vcancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer vcancel()
	currentVersion := fetchMihomoVersion(vctx, h.cfg)

	// Filter to stable releases and limit to 10
	items := make([]mihomoReleaseItem, 0, 10)
	for _, rel := range rels {
		if rel.Prerelease {
			continue
		}
		if len(items) >= 10 {
			break
		}

		asset := findMihomoAssetFromRelease(rel)
		assetName := ""
		var assetSize int64
		if asset != nil {
			assetName = asset.Name
			assetSize = asset.Size
		}

		isCurrent := versionMatch(currentVersion, rel.TagName)
		isNewer := !isCurrent && updater.CompareVersions(currentVersion, rel.TagName) < 0

		items = append(items, mihomoReleaseItem{
			TagName:     rel.TagName,
			PublishedAt: rel.PublishedAt.Format(time.RFC3339),
			Body:        rel.Body,
			AssetName:   assetName,
			AssetSize:   assetSize,
			IsCurrent:   isCurrent,
			IsNewer:     isNewer,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"current_version": currentVersion,
		"releases":        items,
	})
}

// XkeenReleases returns the latest xkeen release from GitHub.
// GET /api/releases/xkeen
func (h *ReleasesHandler) XkeenReleases(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	// Current xkeen version
	currentVersion := getXkeenVersion(h.cfg)

	rel, err := h.cache.GetLatestRelease(ctx, releases.XkeenRepo(), "XMeow/"+h.cfg.Version)
	if err != nil {
		if errors.Is(err, releases.ErrNoRelease) {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"current_version": currentVersion,
				"latest":          nil,
			})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
		return
	}

	hasUpdate := !versionMatch(currentVersion, rel.TagName) &&
		updater.CompareVersions(currentVersion, rel.TagName) < 0

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"current_version": currentVersion,
		"latest": map[string]interface{}{
			"tag_name":     rel.TagName,
			"published_at": rel.PublishedAt.Format(time.RFC3339),
			"body":         rel.Body,
			"has_update":   hasUpdate,
		},
	})
}

// InstallMihomo installs a specific mihomo version with NDJSON progress streaming.
// POST /api/releases/mihomo/install  body: {"version": "v1.19.0"}
func (h *ReleasesHandler) InstallMihomo(w http.ResponseWriter, r *http.Request) {
	if h.installer.IsInstalling() {
		writeJSON(w, http.StatusConflict, map[string]string{
			"error": "installation already in progress",
		})
		return
	}

	var body struct {
		Version string `json:"version"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Version == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "version is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	// Get releases from cache
	rels, err := h.cache.GetReleases(ctx, releases.MihomoRepo(), "XMeow/"+h.cfg.Version, 15)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to fetch releases: " + err.Error(),
		})
		return
	}

	// Stream NDJSON progress
	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)

	flusher, _ := w.(http.Flusher)

	writeProgress := func(step, message string, progress int) {
		line, _ := json.Marshal(map[string]interface{}{
			"step":     step,
			"message":  message,
			"progress": progress,
		})
		w.Write(line)
		w.Write([]byte("\n"))
		if flusher != nil {
			flusher.Flush()
		}
	}

	if err := h.installer.Install(ctx, body.Version, rels, releases.ProgressFunc(writeProgress)); err != nil {
		writeProgress("error", err.Error(), -1)
		return
	}

	// Invalidate cache so next request sees fresh version
	h.cache.Invalidate(releases.MihomoRepo())

	writeProgress("done", "mihomo "+body.Version+" установлен", -1)
}

// getXkeenVersion runs "xkeen -v" and extracts the semver part.
func getXkeenVersion(cfg *config.AppConfig) string {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	out, err := execCommandContext(ctx, cfg.XkeenBin, "-v")
	if err != nil {
		return "unknown"
	}
	if v := versionRe.FindString(strings.TrimSpace(string(out))); v != "" {
		return v
	}
	return "unknown"
}

// execCommandContext is a helper that runs a command and returns its output.
func execCommandContext(ctx context.Context, name string, args ...string) ([]byte, error) {
	return exec.CommandContext(ctx, name, args...).Output()
}

// findMihomoAssetFromRelease finds the linux-arm64 asset in a release.
func findMihomoAssetFromRelease(rel releases.Release) *releases.Asset {
	for i := range rel.Assets {
		a := &rel.Assets[i]
		if strings.Contains(a.Name, "linux-arm64") &&
			strings.HasSuffix(a.Name, ".gz") &&
			!strings.Contains(a.Name, "-go1") &&
			!strings.HasSuffix(a.Name, ".tar.gz") {
			return a
		}
	}
	return nil
}

// versionMatch checks if two version strings refer to the same version
// (ignoring "v" prefix differences).
func versionMatch(a, b string) bool {
	return strings.TrimPrefix(a, "v") == strings.TrimPrefix(b, "v")
}

// xmeowReleaseItem is a single xmeow release in the response.
type xmeowReleaseItem struct {
	TagName         string `json:"tag_name"`
	PublishedAt     string `json:"published_at"`
	Body            string `json:"body"`
	ServerAssetName string `json:"server_asset_name"`
	ServerAssetSize int64  `json:"server_asset_size"`
	DistAssetName   string `json:"dist_asset_name"`
	DistAssetSize   int64  `json:"dist_asset_size"`
	IsCurrent       bool   `json:"is_current"`
	IsNewer         bool   `json:"is_newer"`
}

// XmeowReleases returns 10 latest xmeow releases from GitHub.
// GET /api/releases/xmeow
func (h *ReleasesHandler) XmeowReleases(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	rels, err := h.cache.GetReleases(ctx, releases.XmeowRepo(), "XMeow/"+h.cfg.Version, 10)
	if err != nil {
		if errors.Is(err, releases.ErrNoRelease) {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"current_version": h.cfg.Version,
				"releases":        []interface{}{},
			})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
		return
	}

	items := make([]xmeowReleaseItem, 0, 10)
	for _, rel := range rels {
		if rel.Prerelease {
			continue
		}
		if len(items) >= 10 {
			break
		}

		var serverName string
		var serverSize int64
		var distName string
		var distSize int64
		for _, a := range rel.Assets {
			if strings.Contains(a.Name, "linux") && strings.Contains(a.Name, "arm64") &&
				strings.HasSuffix(a.Name, ".tar.gz") && a.Name != "dist.tar.gz" {
				serverName = a.Name
				serverSize = a.Size
			}
			if a.Name == "dist.tar.gz" {
				distName = a.Name
				distSize = a.Size
			}
		}

		isCurrent := versionMatch(h.cfg.Version, rel.TagName)
		isNewer := !isCurrent && updater.CompareVersions(h.cfg.Version, rel.TagName) < 0

		items = append(items, xmeowReleaseItem{
			TagName:         rel.TagName,
			PublishedAt:     rel.PublishedAt.Format(time.RFC3339),
			Body:            rel.Body,
			ServerAssetName: serverName,
			ServerAssetSize: serverSize,
			DistAssetName:   distName,
			DistAssetSize:   distSize,
			IsCurrent:       isCurrent,
			IsNewer:         isNewer,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"current_version": h.cfg.Version,
		"releases":        items,
	})
}

// InstallXmeow installs a specific xmeow version with NDJSON progress streaming.
// POST /api/releases/xmeow/install  body: {"version": "v0.1.0", "target": "server"|"dist"}
func (h *ReleasesHandler) InstallXmeow(w http.ResponseWriter, r *http.Request) {
	if h.xmeowInst.IsInstalling() {
		writeJSON(w, http.StatusConflict, map[string]string{
			"error": "installation already in progress",
		})
		return
	}

	var body struct {
		Version string `json:"version"`
		Target  string `json:"target"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Version == "" || body.Target == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "version and target are required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	rels, err := h.cache.GetReleases(ctx, releases.XmeowRepo(), "XMeow/"+h.cfg.Version, 10)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to fetch releases: " + err.Error(),
		})
		return
	}

	// Stream NDJSON progress
	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)

	flusher, _ := w.(http.Flusher)

	writeProgress := func(step, message string, progress int) {
		line, _ := json.Marshal(map[string]interface{}{
			"step":     step,
			"message":  message,
			"progress": progress,
		})
		w.Write(line)
		w.Write([]byte("\n"))
		if flusher != nil {
			flusher.Flush()
		}
	}

	if err := h.xmeowInst.Install(ctx, body.Version, body.Target, rels, releases.ProgressFunc(writeProgress)); err != nil {
		writeProgress("error", err.Error(), -1)
		return
	}

	h.cache.Invalidate(releases.XmeowRepo())
	writeProgress("done", "xmeow "+body.Target+" "+body.Version+" установлен", -1)

	// After server binary replacement, schedule service restart
	// (same pattern as ApplyUpdate — send response, then restart after 1s)
	if body.Target == "server" {
		time.AfterFunc(1*time.Second, restartService)
	}
}
