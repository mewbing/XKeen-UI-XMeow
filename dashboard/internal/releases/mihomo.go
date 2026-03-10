package releases

import (
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
	"github.com/mewbing/XKeen-UI-XMeow/internal/updater"
)

const (
	mihomoRepo = "MetaCubeX/mihomo"
	xkeenRepo  = "jameszeroX/XKeen"

	// maxGunzipSize protects against gzip bombs (100 MB).
	maxGunzipSize = 100 * 1024 * 1024
)

// ProgressFunc is called during installation to report progress.
// step identifies the current phase, message is human-readable, progress is 0-100 for download or -1.
type ProgressFunc func(step, message string, progress int)

// MihomoInstaller handles downloading and installing specific mihomo versions.
type MihomoInstaller struct {
	cfg        *config.AppConfig
	installing atomic.Bool
}

// NewMihomoInstaller creates a new installer.
func NewMihomoInstaller(cfg *config.AppConfig) *MihomoInstaller {
	return &MihomoInstaller{cfg: cfg}
}

// IsInstalling returns true if an installation is in progress.
func (m *MihomoInstaller) IsInstalling() bool {
	return m.installing.Load()
}

// MihomoRepo returns the GitHub repo for mihomo releases.
func MihomoRepo() string { return mihomoRepo }

// XkeenRepo returns the GitHub repo for xkeen releases.
func XkeenRepo() string { return xkeenRepo }

// Install downloads and installs a specific mihomo version.
// The version must match a tag_name from the releases list.
// onProgress is called for each step (may be nil).
func (m *MihomoInstaller) Install(ctx context.Context, version string, releases []Release, onProgress ProgressFunc) error {
	if !m.installing.CompareAndSwap(false, true) {
		return fmt.Errorf("installation already in progress")
	}
	defer m.installing.Store(false)

	if onProgress == nil {
		onProgress = func(string, string, int) {}
	}

	// Find the release matching the requested version
	var target *Release
	for i := range releases {
		if releases[i].TagName == version {
			target = &releases[i]
			break
		}
	}
	if target == nil {
		return fmt.Errorf("release %s not found", version)
	}

	// Find the matching asset for linux/arm64
	asset := findMihomoAsset(target.Assets)
	if asset == nil {
		return fmt.Errorf("no linux-arm64 asset found in release %s", version)
	}

	destDir := filepath.Dir(m.cfg.MihomoBin)

	// Check disk space (3x asset size)
	onProgress("check_disk", "Проверка свободного места...", -1)
	if err := updater.CheckDiskSpace(destDir, asset.Size*3); err != nil {
		return err
	}

	// Download .gz file
	onProgress("download", fmt.Sprintf("Скачивание %s (%s)...", asset.Name, formatSize(asset.Size)), 0)
	tmpGzPath := filepath.Join(destDir, ".mihomo-update.gz")
	if err := updater.DownloadFileWithProgress(ctx, asset.BrowserDownloadURL, tmpGzPath, asset.Size, func(pct int) {
		onProgress("download", fmt.Sprintf("Скачивание: %d%%", pct), pct)
	}); err != nil {
		return fmt.Errorf("download %s: %w", asset.Name, err)
	}
	defer os.Remove(tmpGzPath)

	// Gunzip to temporary binary
	onProgress("decompress", "Распаковка архива...", -1)
	tmpBinPath := filepath.Join(destDir, ".mihomo-new")
	if err := gunzipToFile(tmpGzPath, tmpBinPath); err != nil {
		return fmt.Errorf("gunzip %s: %w", asset.Name, err)
	}
	defer os.Remove(tmpBinPath)

	// Remove downloaded .gz early
	os.Remove(tmpGzPath)

	// Stop mihomo via xkeen
	onProgress("stop", "Остановка mihomo...", -1)
	stopCtx, stopCancel := context.WithTimeout(ctx, 30*time.Second)
	defer stopCancel()
	if err := exec.CommandContext(stopCtx, m.cfg.XkeenBin, "-stop").Run(); err != nil {
		// Try to continue anyway — mihomo might not be running
		fmt.Fprintf(os.Stderr, "warning: xkeen -stop failed: %v\n", err)
	}

	// Backup current binary
	onProgress("backup", "Резервное копирование текущей версии...", -1)
	bakPath := m.cfg.MihomoBin + ".bak"
	os.Remove(bakPath)
	if err := os.Rename(m.cfg.MihomoBin, bakPath); err != nil {
		// Binary might not exist on fresh install
		if !os.IsNotExist(err) {
			return fmt.Errorf("backup current mihomo: %w", err)
		}
	}

	// Install new binary
	onProgress("install", "Установка нового бинарника...", -1)
	if err := os.Rename(tmpBinPath, m.cfg.MihomoBin); err != nil {
		// Rollback
		os.Rename(bakPath, m.cfg.MihomoBin)
		return fmt.Errorf("install new mihomo: %w", err)
	}
	os.Chmod(m.cfg.MihomoBin, 0755)

	// Start mihomo via xkeen
	onProgress("start", "Запуск mihomo...", -1)
	startCtx, startCancel := context.WithTimeout(ctx, 30*time.Second)
	defer startCancel()
	if err := exec.CommandContext(startCtx, m.cfg.XkeenBin, "-start").Run(); err != nil {
		return fmt.Errorf("mihomo installed but failed to start: %w (backup at %s)", err, bakPath)
	}

	return nil
}

// formatSize formats bytes into a human-readable string.
func formatSize(bytes int64) string {
	const mb = 1024 * 1024
	if bytes >= mb {
		return fmt.Sprintf("%.1f MB", float64(bytes)/float64(mb))
	}
	return fmt.Sprintf("%.1f KB", float64(bytes)/1024)
}

// findMihomoAsset finds the correct binary asset for linux/arm64.
// Mihomo releases use plain .gz (not tar.gz): mihomo-linux-arm64-v1.19.0.gz
// Excludes Go-version-specific builds like mihomo-linux-arm64-go120-v1.19.0.gz
func findMihomoAsset(assets []Asset) *Asset {
	for i := range assets {
		a := &assets[i]
		name := a.Name
		if strings.Contains(name, "linux-arm64") &&
			strings.HasSuffix(name, ".gz") &&
			!strings.Contains(name, "-go1") &&
			!strings.HasSuffix(name, ".tar.gz") {
			return a
		}
	}
	return nil
}

// gunzipToFile decompresses a plain .gz file to a destination path.
// Limited to maxGunzipSize to protect against gzip bombs.
func gunzipToFile(gzPath, destPath string) error {
	f, err := os.Open(gzPath)
	if err != nil {
		return fmt.Errorf("open gz: %w", err)
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return fmt.Errorf("gzip reader: %w", err)
	}
	defer gz.Close()

	out, err := os.OpenFile(destPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}

	if _, err := io.Copy(out, io.LimitReader(gz, maxGunzipSize)); err != nil {
		out.Close()
		os.Remove(destPath)
		return fmt.Errorf("decompress: %w", err)
	}

	return out.Close()
}
