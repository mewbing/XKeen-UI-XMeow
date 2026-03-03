package updater

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mewbing/XKeen-UI-Xmeow/internal/config"
)

// ReleaseInfo contains version comparison and release metadata.
// Serialized as JSON by HTTP handlers (Plan 02).
type ReleaseInfo struct {
	CurrentVersion string    `json:"current_version"`
	LatestVersion  string    `json:"latest_version"`
	HasUpdate      bool      `json:"has_update"`
	ReleaseNotes   string    `json:"release_notes"`
	PublishedAt    time.Time `json:"published_at"`
	AssetName      string    `json:"asset_name"`
	AssetSize      int64     `json:"asset_size"`
	DistSize       int64     `json:"dist_size,omitempty"`
	IsPrerelease   bool      `json:"is_prerelease"`

	// Internal fields (not serialized) -- used by Apply()
	assetURL    string
	checksumURL string
	distURL     string
}

// Updater manages update checking, downloading, and applying.
// Thread-safe: uses RWMutex for cache and atomic.Bool for update lock.
type Updater struct {
	mu       sync.RWMutex
	cached   *ReleaseInfo
	cachedAt time.Time
	cacheTTL time.Duration

	cfg      *config.AppConfig
	updating atomic.Bool
}

// NewUpdater creates an Updater with 1-hour cache TTL.
func NewUpdater(cfg *config.AppConfig) *Updater {
	return &Updater{
		cacheTTL: 1 * time.Hour,
		cfg:      cfg,
	}
}

// Check returns release info with version comparison.
// Results are cached for 1 hour to avoid GitHub API rate limits (60 req/hour unauthenticated).
func (u *Updater) Check(ctx context.Context) (*ReleaseInfo, error) {
	// Try cache first (read lock)
	u.mu.RLock()
	if u.cached != nil && time.Since(u.cachedAt) < u.cacheTTL {
		info := *u.cached // copy
		u.mu.RUnlock()
		return &info, nil
	}
	u.mu.RUnlock()

	// Fetch from GitHub API
	release, err := fetchLatestRelease(ctx, "XMeow-UI/"+u.cfg.Version)
	if err != nil {
		return nil, err
	}

	// Find matching assets for current platform
	binaryAsset, checksumAsset, distAsset := findAssets(release.Assets)
	if binaryAsset == nil {
		return nil, fmt.Errorf("no binary asset found for %s_%s", "linux", "arm64")
	}

	// Compare versions
	hasUpdate := compareVersions(u.cfg.Version, release.TagName) < 0

	info := &ReleaseInfo{
		CurrentVersion: u.cfg.Version,
		LatestVersion:  release.TagName,
		HasUpdate:      hasUpdate,
		ReleaseNotes:   release.Body,
		PublishedAt:    release.PublishedAt,
		AssetName:      binaryAsset.Name,
		AssetSize:      binaryAsset.Size,
		IsPrerelease:   release.Prerelease,
		assetURL:       binaryAsset.BrowserDownloadURL,
	}

	if checksumAsset != nil {
		info.checksumURL = checksumAsset.BrowserDownloadURL
	}
	if distAsset != nil {
		info.DistSize = distAsset.Size
		info.distURL = distAsset.BrowserDownloadURL
	}

	// Cache the result (write lock)
	u.mu.Lock()
	u.cached = info
	u.cachedAt = time.Now()
	u.mu.Unlock()

	copy := *info
	return &copy, nil
}

// Apply downloads the latest release, verifies SHA256, and atomically replaces the binary.
// Only one Apply can run at a time (concurrent calls return error).
// Flow: download -> verify checksum -> backup current -> atomic rename.
func (u *Updater) Apply(ctx context.Context) error {
	if !u.updating.CompareAndSwap(false, true) {
		return fmt.Errorf("update already in progress")
	}
	defer u.updating.Store(false)

	// Get release info (may use cache)
	info, err := u.Check(ctx)
	if err != nil {
		return fmt.Errorf("check for update: %w", err)
	}
	if !info.HasUpdate {
		return fmt.Errorf("no update available (current: %s, latest: %s)",
			info.CurrentVersion, info.LatestVersion)
	}

	// Resolve executable path (follow symlinks for correct FS)
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("cannot determine executable path: %w", err)
	}
	exePath, err = filepath.EvalSymlinks(exePath)
	if err != nil {
		return fmt.Errorf("cannot resolve executable path: %w", err)
	}

	destDir := filepath.Dir(exePath)

	// Check disk space (3x asset size for archive + binary + safety)
	if err := checkDiskSpace(destDir, info.AssetSize*3); err != nil {
		return err
	}

	// Download archive to same directory (NOT /tmp -- must be same FS for rename)
	tmpArchivePath := filepath.Join(destDir, ".xmeow-update.tar.gz")
	if err := downloadFile(ctx, info.assetURL, tmpArchivePath); err != nil {
		return fmt.Errorf("download update: %w", err)
	}
	defer os.Remove(tmpArchivePath)

	// Verify SHA256 checksum
	if info.checksumURL != "" {
		checksumPath := filepath.Join(destDir, ".checksums.txt")
		if err := downloadFile(ctx, info.checksumURL, checksumPath); err != nil {
			return fmt.Errorf("download checksums: %w", err)
		}
		defer os.Remove(checksumPath)

		if err := verifyChecksum(tmpArchivePath, checksumPath, info.AssetName); err != nil {
			return err
		}
	}

	// Extract binary from tar.gz
	newBinaryPath, err := extractBinaryFromTarGz(tmpArchivePath, "xmeow-server", destDir)
	if err != nil {
		return fmt.Errorf("extract binary: %w", err)
	}

	// Cleanup archive early (no longer needed)
	os.Remove(tmpArchivePath)

	// Atomic replacement: backup current -> rename new -> rollback on failure
	bakPath := exePath + ".bak"
	os.Remove(bakPath) // remove old backup if exists

	if err := os.Rename(exePath, bakPath); err != nil {
		os.Remove(newBinaryPath)
		return fmt.Errorf("backup current binary: %w", err)
	}

	if err := os.Rename(newBinaryPath, exePath); err != nil {
		// Rollback: restore backup
		os.Rename(bakPath, exePath)
		return fmt.Errorf("replace binary: %w", err)
	}

	os.Chmod(exePath, 0755)

	// Invalidate cache so next Check() fetches fresh data
	u.InvalidateCache()

	return nil
}

// Rollback restores the previous binary from the .bak backup file.
func (u *Updater) Rollback() error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("cannot determine executable path: %w", err)
	}
	exePath, err = filepath.EvalSymlinks(exePath)
	if err != nil {
		return fmt.Errorf("cannot resolve executable path: %w", err)
	}

	bakPath := exePath + ".bak"
	if _, err := os.Stat(bakPath); os.IsNotExist(err) {
		return fmt.Errorf("no backup found at %s", bakPath)
	}

	// Remove current binary (may be corrupted) and restore backup
	os.Remove(exePath)
	if err := os.Rename(bakPath, exePath); err != nil {
		return fmt.Errorf("restore backup: %w", err)
	}

	os.Chmod(exePath, 0755)
	return nil
}

// IsUpdating returns true if an update is currently in progress.
func (u *Updater) IsUpdating() bool {
	return u.updating.Load()
}

// InvalidateCache clears the cached release info, forcing the next Check() to fetch from GitHub.
func (u *Updater) InvalidateCache() {
	u.mu.Lock()
	u.cached = nil
	u.mu.Unlock()
}

// IsExternalUI checks if mihomo is configured with an external-ui directory.
// When external-ui is set, the dashboard SPA is served by mihomo (not embedded in the binary).
func (u *Updater) IsExternalUI() bool {
	val := config.ReadMihomoField(u.cfg.MihomoConfigPath, "external-ui")
	return val != ""
}

// ApplyDist downloads dist.tar.gz from the latest release and extracts it into destDir.
// Used in external-ui mode to update the SPA served by mihomo.
// Only one update operation can run at a time (shares the updating lock with Apply).
func (u *Updater) ApplyDist(ctx context.Context, destDir string) error {
	if !u.updating.CompareAndSwap(false, true) {
		return fmt.Errorf("update already in progress")
	}
	defer u.updating.Store(false)

	// Get release info (may use cache)
	info, err := u.Check(ctx)
	if err != nil {
		return fmt.Errorf("check for update: %w", err)
	}
	if info.distURL == "" {
		return fmt.Errorf("dist.tar.gz not found in release %s", info.LatestVersion)
	}

	// Check disk space (3x dist size for archive + extracted + safety)
	requiredSpace := info.DistSize * 3
	if requiredSpace < 10*1024*1024 {
		requiredSpace = 10 * 1024 * 1024 // minimum 10 MB
	}
	if err := checkDiskSpace(destDir, requiredSpace); err != nil {
		return err
	}

	// Download dist.tar.gz to temp file in destDir
	tmpPath := filepath.Join(destDir, ".dist-update.tar.gz")
	if err := downloadFile(ctx, info.distURL, tmpPath); err != nil {
		return fmt.Errorf("download dist.tar.gz: %w", err)
	}
	defer os.Remove(tmpPath)

	// Verify SHA256 checksum if checksums.txt is available
	if info.checksumURL != "" {
		checksumPath := filepath.Join(destDir, ".checksums.txt")
		if err := downloadFile(ctx, info.checksumURL, checksumPath); err != nil {
			return fmt.Errorf("download checksums: %w", err)
		}
		defer os.Remove(checksumPath)

		if err := verifyChecksum(tmpPath, checksumPath, "dist.tar.gz"); err != nil {
			return err
		}
	}

	// Extract dist.tar.gz contents into destDir (overwrites existing files)
	if err := extractDistTarGz(tmpPath, destDir); err != nil {
		return fmt.Errorf("extract dist.tar.gz: %w", err)
	}

	return nil
}
