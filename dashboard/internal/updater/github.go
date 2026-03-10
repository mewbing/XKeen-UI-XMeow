package updater

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// ErrNoRelease is returned when the GitHub repo or release does not exist yet.
var ErrNoRelease = errors.New("no release found")

const (
	githubRepo = "mewbing/XKeen-UI-XMeow"
	githubAPI  = "https://api.github.com/repos/" + githubRepo + "/releases/latest"
)

// githubRelease represents the JSON response from GitHub releases API.
type githubRelease struct {
	TagName     string        `json:"tag_name"`
	Body        string        `json:"body"`
	Prerelease  bool          `json:"prerelease"`
	PublishedAt time.Time     `json:"published_at"`
	Assets      []githubAsset `json:"assets"`
}

// githubAsset represents a single asset in a GitHub release.
type githubAsset struct {
	Name               string `json:"name"`
	Size               int64  `json:"size"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

// fetchLatestRelease fetches the latest stable release from GitHub API.
// The caller should provide a context with timeout (e.g., 15s).
func fetchLatestRelease(ctx context.Context, userAgent string) (*githubRelease, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, githubAPI, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", userAgent)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusNotFound {
			return nil, ErrNoRelease
		}
		if resp.StatusCode == http.StatusForbidden {
			return nil, fmt.Errorf("github API returned 403: rate limit exceeded, try again later")
		}
		return nil, fmt.Errorf("github API returned %d", resp.StatusCode)
	}

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, fmt.Errorf("failed to parse release JSON: %w", err)
	}

	if release.Prerelease {
		return nil, fmt.Errorf("no stable release found (latest is prerelease %s)", release.TagName)
	}

	return &release, nil
}

// findAssets searches release assets for the binary archive, checksums file, and dist archive.
// binaryAsset matches the current GOOS/GOARCH, checksumAsset is "checksums.txt",
// distAsset is "dist.tar.gz" (for external-ui mode SPA update).
func findAssets(assets []githubAsset) (binaryAsset, checksumAsset, distAsset *githubAsset) {
	suffix := runtime.GOOS + "-" + runtime.GOARCH
	for i := range assets {
		a := &assets[i]
		switch {
		case strings.Contains(a.Name, suffix) && strings.HasSuffix(a.Name, ".tar.gz") && a.Name != "dist.tar.gz":
			binaryAsset = a
		case a.Name == "checksums.txt":
			checksumAsset = a
		case a.Name == "dist.tar.gz":
			distAsset = a
		}
	}
	return
}

// CompareVersions compares two version strings with arbitrary segment count.
// Returns -1 if current < latest, 0 if equal, 1 if current > latest.
// Strips "v" prefix and ignores prerelease suffixes (e.g., "-beta.1").
// Supports 2+ segments: "1.19.0", "1.1.3.9", etc.
func CompareVersions(current, latest string) int {
	current = strings.TrimPrefix(current, "v")
	latest = strings.TrimPrefix(latest, "v")

	// Separate prerelease suffix
	currentCore := strings.SplitN(current, "-", 2)[0]
	latestCore := strings.SplitN(latest, "-", 2)[0]

	cv := parseVersion(currentCore)
	lv := parseVersion(latestCore)

	maxLen := len(cv)
	if len(lv) > maxLen {
		maxLen = len(lv)
	}

	for i := 0; i < maxLen; i++ {
		var a, b int
		if i < len(cv) {
			a = cv[i]
		}
		if i < len(lv) {
			b = lv[i]
		}
		if a < b {
			return -1
		}
		if a > b {
			return 1
		}
	}
	return 0
}

// parseVersion splits a dotted version string into a slice of ints.
func parseVersion(s string) []int {
	parts := strings.Split(s, ".")
	v := make([]int, len(parts))
	for i, p := range parts {
		v[i], _ = strconv.Atoi(p)
	}
	return v
}

// progressWriter wraps an io.Writer and reports download progress via callback.
type progressWriter struct {
	w          io.Writer
	total      int64
	written    int64
	onProgress func(pct int)
	lastPct    int
	lastReport time.Time
}

func (pw *progressWriter) Write(p []byte) (int, error) {
	n, err := pw.w.Write(p)
	pw.written += int64(n)

	if pw.onProgress != nil && pw.total > 0 {
		pct := int(pw.written * 100 / pw.total)
		now := time.Now()
		if pct != pw.lastPct && now.Sub(pw.lastReport) >= 500*time.Millisecond {
			pw.lastPct = pct
			pw.lastReport = now
			pw.onProgress(pct)
		}
	}

	return n, err
}

// DownloadFileWithProgress downloads a URL to a local file path with progress reporting.
// totalSize is the expected file size. onProgress receives percent (0-100), throttled to 500ms.
func DownloadFileWithProgress(ctx context.Context, url, destPath string, totalSize int64, onProgress func(pct int)) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("create download request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download returned HTTP %d", resp.StatusCode)
	}

	if totalSize <= 0 {
		totalSize = resp.ContentLength
	}

	f, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("create file %s: %w", destPath, err)
	}

	pw := &progressWriter{
		w:          f,
		total:      totalSize,
		onProgress: onProgress,
	}

	if _, err := io.Copy(pw, resp.Body); err != nil {
		f.Close()
		os.Remove(destPath)
		return fmt.Errorf("write file %s: %w", destPath, err)
	}

	if onProgress != nil {
		onProgress(100)
	}

	if err := f.Close(); err != nil {
		os.Remove(destPath)
		return fmt.Errorf("close file %s: %w", destPath, err)
	}

	return nil
}

// downloadFile downloads a URL to a local file path using streaming copy.
// On error, the partially downloaded file is removed.
func DownloadFile(ctx context.Context, url, destPath string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("create download request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download returned HTTP %d", resp.StatusCode)
	}

	f, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("create file %s: %w", destPath, err)
	}

	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		os.Remove(destPath)
		return fmt.Errorf("write file %s: %w", destPath, err)
	}

	if err := f.Close(); err != nil {
		os.Remove(destPath)
		return fmt.Errorf("close file %s: %w", destPath, err)
	}

	return nil
}
