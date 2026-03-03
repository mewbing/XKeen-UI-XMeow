package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const (
	githubRepo = "mewbing/XKeen-UI-Xmeow"
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
	suffix := runtime.GOOS + "_" + runtime.GOARCH
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

// compareVersions compares two semver version strings.
// Returns -1 if current < latest, 0 if equal, 1 if current > latest.
// Strips "v" prefix and ignores prerelease suffixes (e.g., "-beta.1").
func compareVersions(current, latest string) int {
	current = strings.TrimPrefix(current, "v")
	latest = strings.TrimPrefix(latest, "v")

	// Separate prerelease suffix (compare only major.minor.patch)
	currentCore := strings.SplitN(current, "-", 2)[0]
	latestCore := strings.SplitN(latest, "-", 2)[0]

	cv := parseVersion(currentCore)
	lv := parseVersion(latestCore)

	for i := 0; i < 3; i++ {
		if cv[i] < lv[i] {
			return -1
		}
		if cv[i] > lv[i] {
			return 1
		}
	}
	return 0
}

// parseVersion splits a "major.minor.patch" string into [3]int.
func parseVersion(s string) [3]int {
	var v [3]int
	parts := strings.SplitN(s, ".", 3)
	for i, p := range parts {
		if i < 3 {
			v[i], _ = strconv.Atoi(p)
		}
	}
	return v
}

// downloadFile downloads a URL to a local file path using streaming copy.
// On error, the partially downloaded file is removed.
func downloadFile(ctx context.Context, url, destPath string) error {
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
