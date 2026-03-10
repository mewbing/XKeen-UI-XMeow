package releases

import (
	"context"
	"errors"
	"sync"
	"time"
)

type cacheEntry struct {
	releases  []Release
	fetchedAt time.Time
}

// Cache stores GitHub releases per repository with a configurable TTL.
type Cache struct {
	mu      sync.RWMutex
	entries map[string]*cacheEntry
	ttl     time.Duration
}

// NewCache creates a Cache with the given TTL.
func NewCache(ttl time.Duration) *Cache {
	return &Cache{
		entries: make(map[string]*cacheEntry),
		ttl:     ttl,
	}
}

// GetReleases returns cached releases or fetches fresh ones from GitHub.
func (c *Cache) GetReleases(ctx context.Context, repo, userAgent string, limit int) ([]Release, error) {
	c.mu.RLock()
	if e, ok := c.entries[repo]; ok && time.Since(e.fetchedAt) < c.ttl {
		out := make([]Release, len(e.releases))
		copy(out, e.releases)
		c.mu.RUnlock()
		return out, nil
	}
	c.mu.RUnlock()

	releases, err := FetchReleases(ctx, repo, userAgent, limit)
	if err != nil {
		if errors.Is(err, ErrNoRelease) {
			return nil, err
		}
		return nil, err
	}

	c.mu.Lock()
	c.entries[repo] = &cacheEntry{releases: releases, fetchedAt: time.Now()}
	c.mu.Unlock()

	out := make([]Release, len(releases))
	copy(out, releases)
	return out, nil
}

// GetLatestRelease returns the cached latest release or fetches a fresh one.
func (c *Cache) GetLatestRelease(ctx context.Context, repo, userAgent string) (*Release, error) {
	c.mu.RLock()
	if e, ok := c.entries[repo]; ok && time.Since(e.fetchedAt) < c.ttl && len(e.releases) > 0 {
		r := e.releases[0]
		c.mu.RUnlock()
		return &r, nil
	}
	c.mu.RUnlock()

	release, err := FetchLatestRelease(ctx, repo, userAgent)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	c.entries[repo] = &cacheEntry{releases: []Release{*release}, fetchedAt: time.Now()}
	c.mu.Unlock()

	r := *release
	return &r, nil
}

// Invalidate clears the cache for a specific repository.
func (c *Cache) Invalidate(repo string) {
	c.mu.Lock()
	delete(c.entries, repo)
	c.mu.Unlock()
}
