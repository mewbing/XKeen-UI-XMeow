package releases

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"github.com/mewbing/XKeen-UI-XMeow/internal/config"
	"github.com/mewbing/XKeen-UI-XMeow/internal/updater"
)

const xmeowRepo = "mewbing/XKeen-UI-XMeow"

// XmeowRepo returns the GitHub repo for xmeow releases.
func XmeowRepo() string { return xmeowRepo }

// XmeowInstaller handles downloading and installing xmeow-server or dist assets.
type XmeowInstaller struct {
	cfg        *config.AppConfig
	installing atomic.Bool
}

// NewXmeowInstaller creates a new XmeowInstaller.
func NewXmeowInstaller(cfg *config.AppConfig) *XmeowInstaller {
	return &XmeowInstaller{cfg: cfg}
}

// IsInstalling returns true if an installation is in progress.
func (x *XmeowInstaller) IsInstalling() bool {
	return x.installing.Load()
}

// Install downloads and installs a specific xmeow version.
// target is "server" (binary) or "dist" (dashboard SPA).
func (x *XmeowInstaller) Install(ctx context.Context, version, target string, releases []Release, onProgress ProgressFunc) error {
	if !x.installing.CompareAndSwap(false, true) {
		return fmt.Errorf("installation already in progress")
	}
	defer x.installing.Store(false)

	if onProgress == nil {
		onProgress = func(string, string, int) {}
	}

	// Find the release
	var rel *Release
	for i := range releases {
		if releases[i].TagName == version {
			rel = &releases[i]
			break
		}
	}
	if rel == nil {
		return fmt.Errorf("release %s not found", version)
	}

	switch target {
	case "server":
		return x.installServer(ctx, rel, onProgress)
	case "dist":
		return x.installDist(ctx, rel, onProgress)
	default:
		return fmt.Errorf("unknown target: %s", target)
	}
}

func (x *XmeowInstaller) installServer(ctx context.Context, rel *Release, onProgress ProgressFunc) error {
	asset := findXmeowServerAsset(rel.Assets)
	if asset == nil {
		return fmt.Errorf("no server asset found in release %s", rel.TagName)
	}

	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("cannot determine executable path: %w", err)
	}
	exePath, _ = filepath.EvalSymlinks(exePath)
	destDir := filepath.Dir(exePath)

	onProgress("check_disk", "Проверка свободного места...", -1)
	if err := updater.CheckDiskSpace(destDir, asset.Size*3); err != nil {
		return err
	}

	onProgress("download", fmt.Sprintf("Скачивание %s (%s)...", asset.Name, formatSize(asset.Size)), 0)
	tmpPath := filepath.Join(destDir, ".xmeow-update.tar.gz")
	if err := updater.DownloadFileWithProgress(ctx, asset.BrowserDownloadURL, tmpPath, asset.Size, func(pct int) {
		onProgress("download", fmt.Sprintf("Скачивание: %d%%", pct), pct)
	}); err != nil {
		return fmt.Errorf("download: %w", err)
	}
	defer os.Remove(tmpPath)

	onProgress("extract", "Извлечение бинарника...", -1)
	newBinPath, err := updater.ExtractBinaryFromTarGz(tmpPath, "xmeow-server", destDir)
	if err != nil {
		return fmt.Errorf("extract: %w", err)
	}
	os.Remove(tmpPath)

	onProgress("backup", "Резервное копирование...", -1)
	bakPath := exePath + ".bak"
	os.Remove(bakPath)
	if err := os.Rename(exePath, bakPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("backup: %w", err)
	}

	onProgress("install", "Установка нового бинарника...", -1)
	if err := os.Rename(newBinPath, exePath); err != nil {
		os.Rename(bakPath, exePath)
		return fmt.Errorf("install: %w", err)
	}
	os.Chmod(exePath, 0755)

	return nil
}

func (x *XmeowInstaller) installDist(ctx context.Context, rel *Release, onProgress ProgressFunc) error {
	asset := findDistAsset(rel.Assets)
	if asset == nil {
		return fmt.Errorf("no dist.tar.gz found in release %s", rel.TagName)
	}

	destDir := config.ReadMihomoField(x.cfg.MihomoConfigPath, "external-ui")
	if destDir == "" {
		destDir = "ui"
	}
	if !filepath.IsAbs(destDir) {
		destDir = filepath.Join(filepath.Dir(x.cfg.MihomoConfigPath), destDir)
	}

	onProgress("check_disk", "Проверка свободного места...", -1)
	if err := updater.CheckDiskSpace(destDir, asset.Size*3); err != nil {
		return err
	}

	onProgress("download", fmt.Sprintf("Скачивание dist.tar.gz (%s)...", formatSize(asset.Size)), 0)
	tmpPath := filepath.Join(destDir, ".dist-update.tar.gz")
	if err := updater.DownloadFileWithProgress(ctx, asset.BrowserDownloadURL, tmpPath, asset.Size, func(pct int) {
		onProgress("download", fmt.Sprintf("Скачивание: %d%%", pct), pct)
	}); err != nil {
		return fmt.Errorf("download: %w", err)
	}
	defer os.Remove(tmpPath)

	onProgress("extract", "Извлечение файлов...", -1)
	if err := updater.ExtractDistTarGz(tmpPath, destDir); err != nil {
		return fmt.Errorf("extract: %w", err)
	}

	return nil
}

func findXmeowServerAsset(assets []Asset) *Asset {
	for i := range assets {
		a := &assets[i]
		if strings.Contains(a.Name, "linux") &&
			strings.Contains(a.Name, "arm64") &&
			strings.HasSuffix(a.Name, ".tar.gz") &&
			a.Name != "dist.tar.gz" {
			return a
		}
	}
	return nil
}

func findDistAsset(assets []Asset) *Asset {
	for i := range assets {
		if assets[i].Name == "dist.tar.gz" {
			return &assets[i]
		}
	}
	return nil
}

// sleepCtx sleeps for d or until ctx is canceled.
func sleepCtx(ctx context.Context, d time.Duration) {
	select {
	case <-ctx.Done():
	case <-time.After(d):
	}
	_ = ctx // suppress unused warning
}
