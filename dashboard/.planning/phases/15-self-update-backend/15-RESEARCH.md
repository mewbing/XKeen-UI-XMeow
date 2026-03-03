# Phase 15: Self-Update Backend - Research

**Researched:** 2026-03-03
**Domain:** Go binary self-update via GitHub Releases API, atomic file replacement, service restart
**Confidence:** HIGH

## Summary

Phase 15 implements a self-update backend: the Go binary checks GitHub releases for newer versions, downloads the appropriate architecture-specific archive, verifies its SHA256 checksum, atomically replaces itself, and restarts via init.d. In external-ui mode, it additionally downloads `dist.tar.gz` to update SPA files in mihomo's external-ui directory.

The project already has all infrastructure pieces: CI generates architecture-specific `.tar.gz` archives with `checksums.txt` (Phase 13), `setup.sh` installs the binary with init.d service (Phase 14), and the Go backend has established patterns for handlers, auth, and external process execution. The update logic itself is straightforward -- the key complexity is in edge cases: disk space checks, atomic replacement on a running binary, rollback, and restart coordination.

**Primary recommendation:** Hand-roll the update logic using Go stdlib (`net/http`, `archive/tar`, `crypto/sha256`, `os.Rename`, `os/exec`). The `go-selfupdate` library is overkill -- our archive naming includes version in the filename (`xmeow-server_{ver}_{os}_{arch}.tar.gz`) which doesn't match the library's expected convention, we need custom handling for `dist.tar.gz` (external-ui), and the entire flow is ~200 lines of straightforward Go code. Adding a heavy dependency with its transitive deps for a simple HTTP+tar+rename flow is unnecessary.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Repo: `mewbing/XKeen-UI-Xmeow` -- hardcoded, no fork support
- Only public releases, no GitHub token
- In-memory cache with 1h TTL for GET /api/update/check
- Asset detection: `runtime.GOOS` + `runtime.GOARCH` -> `xmeow-server-{os}-{arch}.tar.gz` in release assets
- Version comparison: current Version (ldflags) vs latest release tag
- Embedded mode: download `xmeow-server-{os}-{arch}.tar.gz`, extract binary, atomic replace
- External-ui mode: only binary update (SPA update via UI dashboard, Phase 16)
- Backup: rename `xmeow-server` -> `xmeow-server.bak` before replace (one previous backup)
- dist.tar.gz added as separate CI artifact (for Phase 16 SPA update)
- If no init.d script -- error with manual restart instruction
- SHA256 verification mandatory: CI generates `checksums.txt`, backend verifies after download
- Download to temp file (`/tmp`), cleanup on error/interrupt
- Rollback API: POST /api/update/rollback -- renames `.bak` back and restarts
- Disk space check before download -- error if insufficient

### Claude's Discretion
- Restart mechanism: init.d restart vs syscall.Exec
- How UI detects update completion (poll health + version vs SSE)
- Format of GET /api/update/check response (changelog, release notes, asset size)
- Error handling for tar.gz extraction
- Minimum disk space threshold

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SUPD-01 | Backend checks GitHub releases for newer version via API | GitHub REST API `/repos/{owner}/{repo}/releases/latest` returns tag_name, assets[], body (release notes). 60 req/hour unauthenticated rate limit. In-memory cache with TTL avoids hitting limit. |
| SUPD-02 | Backend downloads and replaces own binary atomically with rollback backup | `os.Rename` is atomic on Linux. Pattern: download to /tmp -> verify SHA256 -> rename current to .bak -> rename new to current. Rollback = reverse rename. |
| SUPD-03 | Backend restarts gracefully after self-update via init.d | `exec.Command("/opt/etc/init.d/S99xmeow-ui", "restart")` -- existing pattern from service.go. Init.d script does stop+sleep+start. Process signals via `signal.NotifyContext` for graceful shutdown. |
| SUPD-04 | Backend caches update check results (1h TTL to avoid GitHub rate limits) | Simple struct with `sync.RWMutex`, `time.Time` expiry, cached `*ReleaseInfo`. Check `time.Since(cachedAt) < 1*time.Hour` before making API call. |
| SUPD-05 | Backend auto-detects deployment mode (embedded SPA vs external-ui) | Check if `embed.FS` dist directory contains files (embedded mode) vs external-ui configured in mihomo config. Or simpler: check `os.Executable()` path -- if binary is in install dir and external-ui dir exists with index.html, it's external-ui mode. |
| SUPD-06 | In external-ui mode: downloads and extracts dist.tar.gz into mihomo external-ui directory | Download `dist.tar.gz` from release assets, verify SHA256 from `checksums.txt`, extract to configured external-ui path. Uses same tar extraction logic as binary update. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Go stdlib `net/http` | Go 1.25 | HTTP client for GitHub API + asset download | Already in project, zero deps |
| Go stdlib `archive/tar` + `compress/gzip` | Go 1.25 | Extract `.tar.gz` archives | Standard library, handles all tar formats |
| Go stdlib `crypto/sha256` | Go 1.25 | SHA256 checksum verification | Standard library |
| Go stdlib `encoding/json` | Go 1.25 | Parse GitHub API JSON response | Already used everywhere in handlers |
| Go stdlib `os` | Go 1.25 | Atomic rename, file operations, disk space | `os.Rename` is atomic on Linux (POSIX) |
| Go stdlib `os/exec` | Go 1.25 | init.d restart command | Pattern established in `service.go` |
| `golang.org/x/sys/unix` | latest | Disk space check via `unix.Statfs` | Replaces deprecated `syscall.Statfs` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sync` | stdlib | RWMutex for cache, Mutex for update state | Thread-safe cache and update lock |
| `runtime` | stdlib | `GOOS`, `GOARCH` for asset selection | Detect platform at runtime |
| `io` | stdlib | `io.Copy` for streaming download to temp file | Efficient large file download |
| `path/filepath` | stdlib | File path manipulation | Cross-platform path handling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled GitHub API | `creativeprojects/go-selfupdate` v1.5.2 | Library handles asset naming, rollback, multi-platform. But: archive naming mismatch (version in filename), no dist.tar.gz support, heavy dependency tree, overkill for our simple case |
| Hand-rolled GitHub API | `google/go-github` | Full GitHub client library. Overkill -- we only need one GET endpoint |
| `golang.org/x/sys/unix` | `syscall.Statfs` | `syscall` is deprecated but still works. Using `x/sys` is more correct |

**Installation:**
```bash
go get golang.org/x/sys
```

## Architecture Patterns

### Recommended Package Structure
```
internal/
├── updater/
│   ├── updater.go       # Updater struct, cache, Check(), Apply(), Rollback()
│   ├── github.go        # GitHub API client: fetchLatestRelease(), downloadAsset()
│   ├── archive.go       # tar.gz extraction, SHA256 verification
│   └── disk.go          # Disk space check via unix.Statfs
├── handler/
│   └── update.go        # HTTP handlers: CheckUpdate, ApplyUpdate, RollbackUpdate
└── config/
    └── config.go        # Extended AppConfig with InitdScript, InstallDir fields
```

### Pattern 1: Updater with In-Memory Cache
**What:** Single `Updater` struct holds cached release info, mutex for concurrent access, and all update logic.
**When to use:** Always -- the update API must be thread-safe and cache-aware.
**Example:**
```go
// Source: project pattern (handler struct with config DI)
type Updater struct {
    mu          sync.RWMutex
    cached      *ReleaseInfo
    cachedAt    time.Time
    cacheTTL    time.Duration
    cfg         *config.AppConfig
    updating    atomic.Bool // prevents concurrent updates
}

type ReleaseInfo struct {
    CurrentVersion string    `json:"current_version"`
    LatestVersion  string    `json:"latest_version"`
    HasUpdate      bool      `json:"has_update"`
    ReleaseNotes   string    `json:"release_notes"`
    PublishedAt    time.Time `json:"published_at"`
    AssetURL       string    `json:"asset_url"`
    AssetSize      int64     `json:"asset_size"`
    ChecksumURL    string    `json:"checksum_url"`
    DistURL        string    `json:"dist_url,omitempty"`  // for external-ui mode
    DistSize       int64     `json:"dist_size,omitempty"`
}

func (u *Updater) Check(ctx context.Context) (*ReleaseInfo, error) {
    u.mu.RLock()
    if u.cached != nil && time.Since(u.cachedAt) < u.cacheTTL {
        info := *u.cached
        u.mu.RUnlock()
        return &info, nil
    }
    u.mu.RUnlock()

    // Fetch from GitHub API
    info, err := u.fetchLatestRelease(ctx)
    if err != nil {
        return nil, err
    }

    u.mu.Lock()
    u.cached = info
    u.cachedAt = time.Now()
    u.mu.Unlock()

    return info, nil
}
```

### Pattern 2: Atomic Binary Replacement with Backup
**What:** Download to temp, verify checksum, rename current to .bak, rename new to current. On failure, rollback.
**When to use:** For SUPD-02 (binary replacement).
**Example:**
```go
// Source: standard Linux self-update pattern
func (u *Updater) Apply(ctx context.Context) error {
    if !u.updating.CompareAndSwap(false, true) {
        return fmt.Errorf("update already in progress")
    }
    defer u.updating.Store(false)

    info, err := u.Check(ctx)
    if err != nil {
        return err
    }
    if !info.HasUpdate {
        return fmt.Errorf("no update available")
    }

    exePath, err := os.Executable()
    if err != nil {
        return fmt.Errorf("cannot determine executable path: %w", err)
    }
    exePath, err = filepath.EvalSymlinks(exePath)
    if err != nil {
        return fmt.Errorf("cannot resolve executable path: %w", err)
    }

    // 1. Check disk space
    if err := u.checkDiskSpace(filepath.Dir(exePath), info.AssetSize*3); err != nil {
        return err
    }

    // 2. Download to temp file
    tmpFile, err := u.downloadToTemp(ctx, info.AssetURL)
    if err != nil {
        return err
    }
    defer os.Remove(tmpFile) // cleanup on any error path

    // 3. Download and verify checksum
    if err := u.verifyChecksum(ctx, tmpFile, info); err != nil {
        return err
    }

    // 4. Extract binary from tar.gz
    newBinary, err := u.extractBinary(tmpFile, "xmeow-server")
    if err != nil {
        return err
    }
    defer os.Remove(newBinary)

    // 5. Backup current binary
    bakPath := exePath + ".bak"
    os.Remove(bakPath) // remove old backup
    if err := os.Rename(exePath, bakPath); err != nil {
        return fmt.Errorf("backup failed: %w", err)
    }

    // 6. Atomic replace (rename is atomic on Linux)
    if err := os.Rename(newBinary, exePath); err != nil {
        // Rollback: restore backup
        os.Rename(bakPath, exePath)
        return fmt.Errorf("replace failed: %w", err)
    }

    // 7. Set executable permissions
    os.Chmod(exePath, 0755)

    return nil
}
```

### Pattern 3: Restart via init.d
**What:** After binary replacement, call init.d restart. The old process gets SIGTERM, new binary starts.
**When to use:** For SUPD-03 (service restart).
**Example:**
```go
// Source: existing pattern from service.go (exec.CommandContext)
func (u *Updater) Restart() error {
    initdScript := "/opt/etc/init.d/S99xmeow-ui"
    if _, err := os.Stat(initdScript); os.IsNotExist(err) {
        return fmt.Errorf("init.d script not found at %s. Please restart manually", initdScript)
    }

    // Fire-and-forget: start restart in background, then exit
    // The init.d script does: stop (kill PID) -> sleep 1 -> start (new binary)
    cmd := exec.Command(initdScript, "restart")
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    if err := cmd.Start(); err != nil {
        return fmt.Errorf("restart failed: %w", err)
    }

    // Don't wait for completion -- we'll be killed by "stop" phase
    return nil
}
```

### Pattern 4: GitHub API Client (No Token)
**What:** Simple HTTP GET to `/repos/{owner}/{repo}/releases/latest` with JSON parsing.
**When to use:** For SUPD-01 and SUPD-04 (check for updates).
**Example:**
```go
const (
    githubRepo = "mewbing/XKeen-UI-Xmeow"
    githubAPI  = "https://api.github.com/repos/" + githubRepo + "/releases/latest"
)

type githubRelease struct {
    TagName     string        `json:"tag_name"`
    Body        string        `json:"body"`
    Prerelease  bool          `json:"prerelease"`
    PublishedAt time.Time     `json:"published_at"`
    Assets      []githubAsset `json:"assets"`
}

type githubAsset struct {
    Name               string `json:"name"`
    Size               int64  `json:"size"`
    BrowserDownloadURL string `json:"browser_download_url"`
}

func (u *Updater) fetchLatestRelease(ctx context.Context) (*ReleaseInfo, error) {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, githubAPI, nil)
    if err != nil {
        return nil, err
    }
    req.Header.Set("Accept", "application/vnd.github.v3+json")
    req.Header.Set("User-Agent", "XMeow-UI/"+u.cfg.Version)

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("github API request failed: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("github API returned %d", resp.StatusCode)
    }

    var release githubRelease
    if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
        return nil, fmt.Errorf("failed to parse release: %w", err)
    }

    // Find matching assets
    suffix := runtime.GOOS + "_" + runtime.GOARCH
    // ...asset matching logic...
}
```

### Anti-Patterns to Avoid
- **Don't use `syscall.Exec` for restart:** It replaces the process in-place which breaks PID tracking in init.d. Use `exec.Command` to call init.d restart instead -- the init.d script properly stops the old PID and starts fresh.
- **Don't download directly to target location:** Always download to a temp file first. If download fails midway, you don't corrupt the current binary.
- **Don't hold write lock during download:** The HTTP download can take minutes on slow connections. Use atomic bool flag for update-in-progress, not a long-held mutex.
- **Don't compare versions as strings:** `"1.9.0" > "1.10.0"` is true lexicographically but wrong semantically. Parse semver components as integers.
- **Don't skip `filepath.EvalSymlinks`:** `os.Executable()` may return a symlink path. `os.Rename` across different filesystems fails. Always resolve symlinks first.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Semver comparison | Custom string comparison | Parse into `[major, minor, patch]` ints, compare numerically | Edge cases: `1.9.0` vs `1.10.0`, pre-release tags like `1.0.0-beta.1` |
| Tar extraction | Manual tar reader loop | Standard `archive/tar` + `compress/gzip` | Handles all tar formats, symlink security, path traversal |
| Checksum file parsing | Regex | `strings.Fields` on each line (BSD-style: `{hash}  {filename}`) | Format is standardized by `sha256sum` tool used in CI |

**Key insight:** While there are libraries like `go-selfupdate` that handle the entire flow, the custom requirements (version in filename, dist.tar.gz for external-ui, specific init.d restart, rollback API) mean we'd spend more time configuring/working around the library than writing ~200 lines of straightforward Go.

## Common Pitfalls

### Pitfall 1: Running Binary Replacement on Linux
**What goes wrong:** On Linux, you CAN rename a running binary because the OS uses inode-based file references. The old process continues running from the old inode until it exits. The new file gets a new inode at the same path.
**Why it happens:** People worry about replacing a running binary, but Linux handles it gracefully.
**How to avoid:** This is actually safe -- just `os.Rename` works. The tricky part is that the OLD binary (still running) must NOT try to re-read itself from disk after the rename. Our binary doesn't do this, so we're safe.
**Warning signs:** Problems only occur on Windows (which isn't our target) or if the binary tries to re-read itself.

### Pitfall 2: GitHub API Rate Limiting (60 req/hour unauthenticated)
**What goes wrong:** Without caching, multiple users or frequent checks exhaust the rate limit, causing 403 responses.
**Why it happens:** Unauthenticated GitHub API is limited to 60 requests/hour per IP. On a home router, this is shared across all dashboard tabs/users.
**How to avoid:** 1-hour TTL cache (SUPD-04). After a successful check, serve from cache. After apply, invalidate cache so next check fetches fresh data.
**Warning signs:** HTTP 403 from GitHub API, `X-RateLimit-Remaining: 0` header.

### Pitfall 3: Cross-Filesystem Rename Failure
**What goes wrong:** `os.Rename` fails with `EXDEV` error when source and destination are on different filesystems. `/tmp` is often a different filesystem (tmpfs) than `/opt` (flash/disk).
**Why it happens:** POSIX `rename(2)` only works within the same filesystem.
**How to avoid:** Create temp file in the SAME directory as the target binary (e.g., `/opt/etc/xmeow-ui/.xmeow-server.tmp`) instead of `/tmp`. Alternatively: download to `/tmp`, then copy to target dir, then rename within target dir.
**Warning signs:** Error contains "invalid cross-device link" or `syscall.EXDEV`.

### Pitfall 4: Tar Path Traversal (Zip Slip)
**What goes wrong:** Malicious tar archive contains entries like `../../etc/passwd` that extract outside the target directory.
**Why it happens:** tar entries can contain relative paths with `..` components.
**How to avoid:** Validate that every extracted path, after joining with target directory, is still within the target directory: `if !strings.HasPrefix(filepath.Clean(target), destDir) { return error }`.
**Warning signs:** Paths containing `..` in tar entries.

### Pitfall 5: Concurrent Update Requests
**What goes wrong:** Two simultaneous POST /api/update/apply cause race condition -- two downloads, two renames, corrupted state.
**Why it happens:** User clicks "Update" twice, or multiple browser tabs.
**How to avoid:** Use `atomic.Bool` flag (`updating`) with `CompareAndSwap`. Return 409 Conflict if update already in progress.
**Warning signs:** Multiple download processes running simultaneously.

### Pitfall 6: Restart Timing and Response
**What goes wrong:** The HTTP response for POST /api/update/apply never reaches the client because the server shuts down before sending it.
**Why it happens:** If restart is triggered synchronously, the process dies before the HTTP response is flushed.
**How to avoid:** Send 200 response FIRST with `{"status": "restarting"}`, then trigger restart after a small delay (`time.AfterFunc(1*time.Second, restart)`). The client polls `/api/health` + `/api/versions` to detect when the new version is up.
**Warning signs:** Client gets connection reset / network error instead of response.

### Pitfall 7: MIPS/mipsle Asset Name Mismatch
**What goes wrong:** `runtime.GOARCH` returns `mipsle` but the asset might be named with `mips` or vice versa.
**Why it happens:** GOMIPS (softfloat/hardfloat) is a build-time setting that doesn't affect `runtime.GOARCH`. But GOOS/GOARCH values must exactly match asset naming.
**How to avoid:** CI uses exact GOARCH values in archive names (`linux_mipsle`, `linux_mips`). Backend uses `runtime.GOOS + "_" + runtime.GOARCH` for matching. These are guaranteed to match since both use Go's arch naming.
**Warning signs:** "Asset not found" errors on MIPS devices.

## Code Examples

### GitHub API Response Parsing
```go
// Source: GitHub REST API docs (https://docs.github.com/en/rest/releases/releases)
// Response structure for GET /repos/{owner}/{repo}/releases/latest:
// {
//   "tag_name": "v1.2.0",
//   "body": "## Changelog\n- Fix bug ...",
//   "prerelease": false,
//   "published_at": "2026-03-01T12:00:00Z",
//   "assets": [
//     {
//       "name": "xmeow-server_1.2.0_linux_arm64.tar.gz",
//       "size": 4521984,
//       "browser_download_url": "https://github.com/.../xmeow-server_1.2.0_linux_arm64.tar.gz"
//     },
//     {
//       "name": "checksums.txt",
//       "size": 512,
//       "browser_download_url": "https://github.com/.../checksums.txt"
//     },
//     {
//       "name": "dist.tar.gz",
//       "size": 1048576,
//       "browser_download_url": "https://github.com/.../dist.tar.gz"
//     }
//   ]
// }
```

### Asset Matching Logic
```go
// Source: project CI release.yml (archive naming convention)
func findAssets(assets []githubAsset) (binaryAsset, checksumAsset, distAsset *githubAsset) {
    suffix := runtime.GOOS + "_" + runtime.GOARCH
    for i := range assets {
        a := &assets[i]
        switch {
        case strings.Contains(a.Name, suffix) && strings.HasSuffix(a.Name, ".tar.gz"):
            binaryAsset = a
        case a.Name == "checksums.txt":
            checksumAsset = a
        case a.Name == "dist.tar.gz":
            distAsset = a
        }
    }
    return
}
```

### Semver Comparison
```go
// Source: standard semver parsing pattern
func compareVersions(current, latest string) int {
    // Strip leading "v"
    current = strings.TrimPrefix(current, "v")
    latest = strings.TrimPrefix(latest, "v")

    // Split by "-" to separate prerelease
    currentParts := strings.SplitN(current, "-", 2)
    latestParts := strings.SplitN(latest, "-", 2)

    // Parse major.minor.patch
    cv := parseVersion(currentParts[0])
    lv := parseVersion(latestParts[0])

    for i := 0; i < 3; i++ {
        if cv[i] < lv[i] { return -1 }
        if cv[i] > lv[i] { return 1 }
    }
    return 0 // equal (ignoring prerelease for simplicity)
}

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
```

### Disk Space Check
```go
// Source: golang.org/x/sys/unix package
import "golang.org/x/sys/unix"

func checkDiskSpace(path string, requiredBytes int64) error {
    var stat unix.Statfs_t
    if err := unix.Statfs(path, &stat); err != nil {
        return fmt.Errorf("cannot check disk space: %w", err)
    }
    // Bavail = blocks available to unprivileged users (like df "available")
    available := int64(stat.Bavail) * stat.Bsize
    if available < requiredBytes {
        return fmt.Errorf("insufficient disk space: need %d MB, have %d MB",
            requiredBytes/1024/1024, available/1024/1024)
    }
    return nil
}
```

### Tar.gz Extraction with Security
```go
// Source: Go stdlib archive/tar + security best practices
func extractFromTarGz(archivePath, targetName, destDir string) (string, error) {
    f, err := os.Open(archivePath)
    if err != nil {
        return "", err
    }
    defer f.Close()

    gz, err := gzip.NewReader(f)
    if err != nil {
        return "", err
    }
    defer gz.Close()

    tr := tar.NewReader(gz)
    for {
        hdr, err := tr.Next()
        if err == io.EOF {
            break
        }
        if err != nil {
            return "", err
        }

        // Only extract the target file (e.g., "xmeow-server")
        cleanName := filepath.Base(hdr.Name) // strip directory prefix
        if cleanName != targetName {
            continue
        }

        // Write to temp file in destination directory (same FS for rename)
        tmpPath := filepath.Join(destDir, "."+targetName+".new")
        out, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
        if err != nil {
            return "", err
        }

        // Limit copy size to prevent decompression bomb (100MB max)
        if _, err := io.Copy(out, io.LimitReader(tr, 100*1024*1024)); err != nil {
            out.Close()
            os.Remove(tmpPath)
            return "", err
        }
        out.Close()
        return tmpPath, nil
    }

    return "", fmt.Errorf("file %q not found in archive", targetName)
}
```

### SHA256 Verification
```go
// Source: Go stdlib crypto/sha256
func verifyChecksum(archivePath, checksumFilePath, archiveName string) error {
    // Parse checksums.txt (format: "{hash}  {filename}" per line)
    data, err := os.ReadFile(checksumFilePath)
    if err != nil {
        return fmt.Errorf("read checksums: %w", err)
    }

    var expectedHash string
    for _, line := range strings.Split(string(data), "\n") {
        fields := strings.Fields(line)
        if len(fields) == 2 && fields[1] == archiveName {
            expectedHash = fields[0]
            break
        }
    }
    if expectedHash == "" {
        return fmt.Errorf("checksum for %s not found in checksums.txt", archiveName)
    }

    // Compute actual hash
    f, err := os.Open(archivePath)
    if err != nil {
        return err
    }
    defer f.Close()

    h := sha256.New()
    if _, err := io.Copy(h, f); err != nil {
        return err
    }
    actualHash := hex.EncodeToString(h.Sum(nil))

    if actualHash != expectedHash {
        return fmt.Errorf("checksum mismatch: expected %s, got %s", expectedHash, actualHash)
    }
    return nil
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `syscall.Statfs` | `golang.org/x/sys/unix.Statfs` | Go 1.4+ (syscall deprecated) | Should use x/sys for new code |
| `go-github-selfupdate` (rhysd) | `go-selfupdate` (creativeprojects) | ~2022 fork | Active maintainer, more features, but both alive |
| Full YAML parse for config fields | Line-scan `readMihomoField` | Phase 12 decision | Keeps deps minimal, sufficient for top-level keys |

**Deprecated/outdated:**
- `syscall` package: Use `golang.org/x/sys/unix` for Statfs. However, `syscall.SIGTERM` etc. are still fine.
- `rhysd/go-github-selfupdate`: Still maintained but less active than `creativeprojects/go-selfupdate`.

## Discretion Recommendations

### Restart Mechanism: init.d restart (recommended)
**Recommendation:** Use `exec.Command("/opt/etc/init.d/S99xmeow-ui", "restart")`.

**Why not `syscall.Exec`:** While `syscall.Exec` replaces the current process in-place (preserving PID), it has problems:
- The init.d PID file becomes stale (PID stays same but binary path changed)
- If init.d script's "stop" checks the PID file, it may get confused
- The PIDFILE-based tracking in init.d assumes start/stop lifecycle

**Why init.d restart:** The existing init.d script (`setup.sh` Phase 14) already implements proper stop (kill PID + remove pidfile) -> sleep 1 -> start (new binary + new pidfile). This is the canonical Entware service management pattern. The existing `service.go` handler already uses `exec.CommandContext` for service actions -- same pattern.

**Implementation:** Send HTTP 200 first, then `time.AfterFunc(500*time.Millisecond, func() { exec.Command(initdScript, "restart").Start() })`. The restart kills the current process, but the response already left.

### UI Update Detection: Poll health + version (recommended)
**Recommendation:** Client polls `GET /api/health` every 2 seconds after triggering update. When health returns 200, fetch `GET /api/versions` and compare dashboard version. If version changed, update complete. Timeout after 30 seconds.

**Why not SSE:** SSE adds complexity (EventSource connection management, reconnection logic) for a one-time event. The server is restarting, so any SSE connection will be broken. Polling is simpler and already proven in the health check pattern.

### Response Format for GET /api/update/check
**Recommendation:**
```json
{
    "current_version": "1.0.0",
    "latest_version": "1.2.0",
    "has_update": true,
    "release_notes": "## Changelog\n- Fix ...",
    "published_at": "2026-03-01T12:00:00Z",
    "asset_name": "xmeow-server_1.2.0_linux_arm64.tar.gz",
    "asset_size": 4521984,
    "dist_size": 1048576,
    "is_prerelease": false
}
```
Include asset size so UI can show download size to user. Include `dist_size` for external-ui mode awareness.

### Minimum Disk Space Threshold
**Recommendation:** `asset_size * 3` (archive + extracted binary + safety margin). Minimum absolute: 20 MB. The binary is typically 4-10 MB compressed, 10-20 MB uncompressed. 3x compressed size covers: archive download + extracted file + overhead.

### Error Handling for tar.gz Extraction
**Recommendation:**
- `io.LimitReader` to 100 MB (prevents decompression bomb)
- Extract only the expected filename (`xmeow-server`), skip everything else
- Validate with `filepath.Base()` to prevent path traversal
- Clean up temp files on any error (`defer os.Remove`)

## Open Questions

1. **Asset naming discrepancy**
   - CONTEXT.md says: `xmeow-server-{os}-{arch}.tar.gz` (hyphen separator)
   - CI release.yml actually produces: `xmeow-server_{version}_{os}_{arch}.tar.gz` (underscore, with version)
   - What we know: CI is the source of truth. The `_` separator and version in name are established.
   - What's unclear: Should asset matching use `Contains(suffix)` or a more precise regex?
   - Recommendation: Use `strings.Contains(a.Name, suffix) && strings.HasSuffix(a.Name, ".tar.gz") && a.Name != "dist.tar.gz"` -- this matches regardless of version prefix. Keep it simple.

2. **External-ui mode detection**
   - What we know: In embedded mode, the binary serves SPA from `embed.FS`. In external-ui mode, mihomo serves SPA.
   - What's unclear: What's the most reliable detection method? Options:
     a. Check if `external-ui` field exists in mihomo config.yaml
     b. Check if `/opt/etc/mihomo/ui/index.html` exists
     c. Environment variable / config setting
   - Recommendation: Read mihomo config.yaml for `external-ui` field (using existing `readMihomoField` pattern). If set, we're in external-ui mode. This is authoritative since mihomo itself uses this field.

3. **Restart response race condition**
   - What we know: We need to send HTTP response before triggering restart.
   - What's unclear: Is 500ms delay sufficient? What if the response doesn't flush?
   - Recommendation: Use `w.(http.Flusher).Flush()` after writing response, then `time.AfterFunc(1*time.Second, ...)`. The init.d "stop" sends SIGTERM which triggers graceful shutdown (5s timeout in main.go), so there's a clean shutdown window.

## Sources

### Primary (HIGH confidence)
- Context7 `/creativeprojects/go-selfupdate` - library API, config options, validators, naming conventions
- GitHub REST API docs (https://docs.github.com/en/rest/releases/releases) - release endpoint structure
- Project codebase: `release.yml`, `setup.sh`, `main.go`, `config.go`, `service.go`, `routes.go` - existing patterns

### Secondary (MEDIUM confidence)
- GitHub rate limits docs (https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) - 60 req/hour unauthenticated
- GitHub blog (https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/) - rate limit changes
- pkg.go.dev go-selfupdate v1.5.2 (https://pkg.go.dev/github.com/creativeprojects/go-selfupdate) - library version
- minio/selfupdate (https://github.com/minio/selfupdate) - apply pattern reference

### Tertiary (LOW confidence)
- Go Forum self-update discussion (https://forum.golangbridge.org/t/auto-restart-after-self-update/34792) - restart patterns
- Go self-upgrade gist (https://gist.github.com/fenollp/7e31e6462b10c96aef443351bce6aea7) - binary replacement patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - using Go stdlib for almost everything, well-established patterns
- Architecture: HIGH - follows existing project patterns (handler struct, config DI, exec.CommandContext)
- Pitfalls: HIGH - verified with official docs, cross-referenced with multiple sources (filesystem semantics, GitHub rate limits, tar security)

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable domain, no rapidly changing deps)
