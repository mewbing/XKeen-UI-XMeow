---
phase: 15-self-update-backend
plan: 01
subsystem: updater
tags: [github-api, self-update, sha256, tar-gz, atomic-rename, semver]

# Dependency graph
requires:
  - phase: 13-ci-github-release
    provides: "tar.gz archive naming convention and checksums.txt format"
  - phase: 12-go-backend
    provides: "config.AppConfig struct, ReadMihomoField for YAML parsing"
provides:
  - "Updater struct with Check/Apply/Rollback methods"
  - "ReleaseInfo struct for JSON serialization in HTTP handlers"
  - "GitHub API client for releases (fetchLatestRelease, findAssets)"
  - "Archive utilities (extractBinaryFromTarGz, verifyChecksum, extractDistTarGz)"
  - "Platform-specific disk space check (unix.Statfs on Linux)"
  - "Exported ReadMihomoField in config package"
affects: [15-02-PLAN, 16-update-frontend-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [atomic-binary-replacement, in-memory-cache-with-rwmutex, platform-specific-build-tags]

key-files:
  created:
    - internal/updater/updater.go
    - internal/updater/github.go
    - internal/updater/archive.go
    - internal/updater/disk_linux.go
    - internal/updater/disk_other.go
  modified:
    - internal/config/config.go

key-decisions:
  - "Hand-rolled GitHub API client instead of go-selfupdate library (simpler, custom archive naming)"
  - "Platform-specific disk check via build tags (disk_linux.go + disk_other.go no-op stub)"
  - "Download to same directory as binary (not /tmp) to avoid cross-filesystem rename failure"
  - "Exported ReadMihomoField for cross-package access instead of duplicating logic"

patterns-established:
  - "Atomic binary replacement: download -> SHA256 verify -> backup .bak -> rename"
  - "In-memory cache: RWMutex + cached pointer + TTL check pattern"
  - "Concurrent operation guard: atomic.Bool with CompareAndSwap"
  - "Build tags for platform-specific code: disk_linux.go + disk_other.go"

requirements-completed: [SUPD-01, SUPD-02, SUPD-04, SUPD-05]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 15 Plan 01: Updater Core Package Summary

**Go updater package with GitHub releases API client, SHA256-verified atomic binary replacement, in-memory 1h cache, and rollback support**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T10:32:15Z
- **Completed:** 2026-03-03T10:35:28Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Complete `internal/updater/` package: GitHub API client, archive utilities, Updater struct
- Check() with 1-hour in-memory cache to avoid GitHub API rate limits (60 req/hour)
- Apply() full cycle: download -> SHA256 verify -> atomic rename with .bak backup and rollback
- Exported ReadMihomoField in config package for external-ui mode detection

## Task Commits

Each task was committed atomically:

1. **Task 1: GitHub API client + archive utilities** - `62269e3` (feat)
2. **Task 2: Updater struct with Check/Apply/Rollback** - `13fec1d` (feat)

## Files Created/Modified
- `internal/updater/github.go` - GitHub API client: fetchLatestRelease, findAssets, compareVersions, downloadFile
- `internal/updater/archive.go` - tar.gz extraction, SHA256 verification, dist extraction with zip-slip protection
- `internal/updater/disk_linux.go` - Disk space check via unix.Statfs with 20MB minimum
- `internal/updater/disk_other.go` - No-op stub for non-Linux platforms (dev builds)
- `internal/updater/updater.go` - Updater struct: NewUpdater, Check, Apply, Rollback, IsExternalUI, InvalidateCache
- `internal/config/config.go` - Exported ReadMihomoField (was readMihomoField) for cross-package access

## Decisions Made
- Hand-rolled GitHub API client instead of go-selfupdate: our archive naming (version in filename) doesn't match library conventions, and the entire flow is ~200 lines of straightforward stdlib code
- Platform-specific disk check with build tags: `disk_linux.go` uses unix.Statfs, `disk_other.go` is no-op for Windows dev builds
- Downloads go to same directory as binary (not /tmp) to avoid EXDEV cross-filesystem rename failures
- ReadMihomoField exported by capitalizing the function name, updating 2 internal callers automatically

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added platform-specific build files for checkDiskSpace**
- **Found during:** Task 1 (archive.go / disk space check)
- **Issue:** Plan specified checkDiskSpace in archive.go using unix.Statfs, but this won't compile on Windows (development machine)
- **Fix:** Split into disk_linux.go (real implementation) and disk_other.go (no-op stub with build tag `!linux`)
- **Files modified:** internal/updater/disk_linux.go, internal/updater/disk_other.go
- **Verification:** `go build ./internal/updater/` succeeds on Windows, `go vet` passes
- **Committed in:** 62269e3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Build tag split was necessary for cross-platform compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Updater package ready for HTTP handler wiring in Plan 02
- ReleaseInfo struct has JSON tags ready for API serialization
- Internal fields (assetURL, checksumURL, distURL) available via Apply() method
- IsExternalUI() method ready for mode-aware update handlers

## Self-Check: PASSED

- All 7 files verified present on disk
- Both task commits verified in git log (62269e3, 13fec1d)
- `go build ./internal/updater/` succeeds
- `go vet ./internal/...` passes clean

---
*Phase: 15-self-update-backend*
*Completed: 2026-03-03*
