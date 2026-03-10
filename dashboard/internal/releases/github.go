package releases

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// ErrNoRelease is returned when a GitHub repo has no releases.
var ErrNoRelease = errors.New("no release found")

// Release represents a single GitHub release.
type Release struct {
	TagName     string    `json:"tag_name"`
	Body        string    `json:"body"`
	Prerelease  bool      `json:"prerelease"`
	PublishedAt time.Time `json:"published_at"`
	Assets      []Asset   `json:"assets"`
}

// Asset represents a single file in a GitHub release.
type Asset struct {
	Name               string `json:"name"`
	Size               int64  `json:"size"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

// FetchReleases fetches the last `limit` releases from a GitHub repository.
// repo format: "owner/name" (e.g. "MetaCubeX/mihomo").
func FetchReleases(ctx context.Context, repo, userAgent string, limit int) ([]Release, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/releases?per_page=%d", repo, limit)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
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
			return nil, fmt.Errorf("github API rate limit exceeded, try again later")
		}
		return nil, fmt.Errorf("github API returned %d", resp.StatusCode)
	}

	var releases []Release
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, fmt.Errorf("parse releases JSON: %w", err)
	}

	return releases, nil
}

// FetchLatestRelease fetches only the latest release from a GitHub repository.
func FetchLatestRelease(ctx context.Context, repo, userAgent string) (*Release, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", repo)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
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
			return nil, fmt.Errorf("github API rate limit exceeded, try again later")
		}
		return nil, fmt.Errorf("github API returned %d", resp.StatusCode)
	}

	var release Release
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, fmt.Errorf("parse release JSON: %w", err)
	}

	return &release, nil
}
