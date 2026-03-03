---
phase: 14-installer-setup-sh
plan: 01
subsystem: infra
tags: [go, ci, github-actions, binary-rename, version-flag]

# Dependency graph
requires:
  - phase: 13-ci-cd-pipeline
    provides: "Release workflow and CI workflow with Go binary build"
  - phase: 12-go-backend
    provides: "Go entrypoint in cmd/ with Version ldflags"
provides:
  - "Binary named xmeow-server (not xmeow-ui) in all CI workflows"
  - "Go entrypoint with --version/-v flag for installer update detection"
  - "Release artifacts named xmeow-server_VERSION_ARCH.tar.gz"
affects: [14-installer-setup-sh, 15-self-update]

# Tech tracking
tech-stack:
  added: []
  patterns: ["--version flag prints bare version string (no prefix) for machine parsing"]

key-files:
  created:
    - cmd/xmeow-server/main.go
  modified:
    - .github/workflows/release.yml
    - .github/workflows/ci.yml

key-decisions:
  - "Bare version output (e.g. '1.2.3') without prefix for easy installer parsing"

patterns-established:
  - "--version flag: os.Args check before any config loading for fast exit"

requirements-completed: [INST-01, INST-02]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 14 Plan 01: Binary Rename & Version Flag Summary

**Renamed CI binary from xmeow-ui to xmeow-server and added --version flag for installer update detection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T08:33:09Z
- **Completed:** 2026-03-03T08:36:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Binary renamed from xmeow-ui to xmeow-server across all CI/CD workflows and Go source
- Added --version/-v flag that prints bare version string (e.g. "1.2.3" or "dev") for installer
- Release artifacts now named xmeow-server_VERSION_ARCH.tar.gz

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename cmd/xmeow-ui to cmd/xmeow-server and add --version flag** - `0b5ede0` (feat)
2. **Task 2: Update release.yml to use xmeow-server binary name** - `fffadff` (feat)

**Auto-fix:** `77c25a6` (fix: update ci.yml build path)

## Files Created/Modified
- `cmd/xmeow-server/main.go` - Go entrypoint renamed from cmd/xmeow-ui, with --version flag added
- `.github/workflows/release.yml` - Binary build, UPX, packaging all use xmeow-server name
- `.github/workflows/ci.yml` - Build path updated to ./cmd/xmeow-server/

## Decisions Made
- Bare version output without prefix (e.g. "1.2.3" not "v1.2.3" or "XMeow v1.2.3") -- installer parses stdout directly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ci.yml build path referencing deleted directory**
- **Found during:** Overall verification (after Task 2)
- **Issue:** ci.yml still referenced `./cmd/xmeow-ui/` which no longer exists, would break CI builds
- **Fix:** Updated build path to `./cmd/xmeow-server/`
- **Files modified:** .github/workflows/ci.yml
- **Verification:** grep confirmed zero references to xmeow-ui in .github/ and cmd/
- **Committed in:** `77c25a6`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix -- ci.yml would fail without it. No scope creep.

## Issues Encountered
- cmd/xmeow-ui/ was untracked in git (previously renamed from cmd/antigravity/ outside git). Handled by creating cmd/xmeow-server/ directly and staging the rename from antigravity.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Binary is named xmeow-server everywhere in CI and Go source
- --version flag ready for installer update detection logic
- Ready for 14-02: installer setup.sh script implementation

---
*Phase: 14-installer-setup-sh*
*Completed: 2026-03-03*
