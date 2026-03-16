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
	finalBinPath := m.cfg.MihomoBin

	// Use /tmp for download & decompression (RAM — always has space)
	tmpDir := "/tmp"

	// Download .gz file to /tmp
	onProgress("download", fmt.Sprintf("Скачивание %s (%s)...", asset.Name, formatSize(asset.Size)), 0)
	tmpGzPath := filepath.Join(tmpDir, ".mihomo-update.gz")
	if err := updater.DownloadFileWithProgress(ctx, asset.BrowserDownloadURL, tmpGzPath, asset.Size, func(pct int) {
		onProgress("download", fmt.Sprintf("Скачивание: %d%%", pct), pct)
	}); err != nil {
		return fmt.Errorf("download %s: %w", asset.Name, err)
	}
	defer os.Remove(tmpGzPath)

	// Gunzip to /tmp
	onProgress("decompress", "Распаковка архива...", -1)
	tmpBinPath := filepath.Join(tmpDir, ".mihomo-new")
	if err := gunzipToFile(tmpGzPath, tmpBinPath); err != nil {
		return fmt.Errorf("gunzip %s: %w", asset.Name, err)
	}
	defer os.Remove(tmpBinPath)

	// Remove downloaded .gz early to free RAM
	os.Remove(tmpGzPath)

	// Check new binary size
	binInfo, _ := os.Stat(tmpBinPath)
	binSize := int64(0)
	if binInfo != nil {
		binSize = binInfo.Size()
	}

	// Stop mihomo BEFORE space check — we need to free the binary for replacement
	onProgress("stop", "Остановка mihomo...", -1)
	stopCtx, stopCancel := context.WithTimeout(ctx, 30*time.Second)
	defer stopCancel()
	if err := exec.CommandContext(stopCtx, m.cfg.XkeenBin, "-stop").Run(); err != nil {
		fmt.Fprintf(os.Stderr, "warning: xkeen -stop failed: %v\n", err)
	}

	// Backup current binary (resolve symlinks from previous RAM installs)
	bakPath := m.cfg.MihomoBin + ".bak"
	onProgress("backup", "Резервное копирование текущей версии...", -1)
	os.Remove(bakPath) // remove previous backup

	// If current binary is a symlink (from previous RAM install), remove it
	// — there's nothing to back up since /tmp target is gone after reboot
	if linkTarget, err := os.Readlink(m.cfg.MihomoBin); err == nil {
		fmt.Fprintf(os.Stderr, "info: %s is a symlink to %s, removing\n", m.cfg.MihomoBin, linkTarget)
		os.Remove(m.cfg.MihomoBin)
	} else if err := os.Rename(m.cfg.MihomoBin, bakPath); err != nil {
		if !os.IsNotExist(err) {
			return fmt.Errorf("backup current mihomo: %w", err)
		}
	}

	// Check disk space — first with backup kept
	useRAM := false
	if err := updater.CheckDiskSpace(destDir, binSize); err != nil {
		// Not enough space even with backup — remove backup to free space
		// (old binary ~35MB freed = enough room for the new one)
		os.Remove(bakPath)
		if err := updater.CheckDiskSpace(destDir, binSize); err != nil {
			// Still not enough even without backup — RAM fallback
			onProgress("info", "Недостаточно места на диске — установка в RAM (/tmp)", -1)
			finalBinPath = filepath.Join(tmpDir, "mihomo")
			useRAM = true
		}
	}

	// Install new binary
	onProgress("install", "Установка нового бинарника...", -1)
	if err := copyFile(tmpBinPath, finalBinPath); err != nil {
		if !useRAM {
			os.Rename(bakPath, m.cfg.MihomoBin)
		}
		return fmt.Errorf("install new mihomo: %w", err)
	}
	os.Chmod(finalBinPath, 0755)
	os.Remove(tmpBinPath)

	// If installed to RAM, create symlink from original path
	if useRAM && finalBinPath != m.cfg.MihomoBin {
		os.Remove(m.cfg.MihomoBin) // remove old binary/symlink
		os.Symlink(finalBinPath, m.cfg.MihomoBin)
	}

	// Start mihomo via xkeen
	onProgress("start", "Запуск mihomo...", -1)
	startCtx, startCancel := context.WithTimeout(ctx, 30*time.Second)
	defer startCancel()
	if err := exec.CommandContext(startCtx, m.cfg.XkeenBin, "-start").Run(); err != nil {
		return fmt.Errorf("mihomo installed but failed to start: %w", err)
	}

	if useRAM {
		onProgress("warning", "Mihomo установлен в RAM (/tmp). После перезагрузки роутера потребуется повторная установка.", -1)
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

// copyFile copies src to dst, creating or truncating dst. Works across filesystems.
func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}

	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		os.Remove(dst)
		return err
	}
	return out.Close()
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
