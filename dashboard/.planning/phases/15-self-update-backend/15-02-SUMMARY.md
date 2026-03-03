---
phase: 15-self-update-backend
plan: 02
subsystem: updater
tags: [http-handlers, chi-router, init-d-restart, external-ui, self-update-api]

# Dependency graph
requires:
  - phase: 15-self-update-backend
    plan: 01
    provides: "Updater struct with Check/Apply/Rollback/ApplyDist methods"
  - phase: 12-go-backend
    provides: "chi router, handler pattern, auth middleware, writeJSON helper"
  - phase: 14-installer-setup-sh
    provides: "S99xmeow-ui init.d script for restart mechanism"
provides:
  - "HTTP handlers: CheckUpdate, ApplyUpdate, RollbackUpdate, ApplyDist"
  - "Route registration at /api/update/{check,apply,rollback,apply-dist} under auth middleware"
  - "Service restart via init.d with 1s delay after HTTP response flush"
  - "Complete self-update REST API ready for frontend consumption (Phase 16)"
affects: [16-update-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget-restart, flush-before-exit, update-handler-struct]

key-files:
  created:
    - internal/handler/update.go
  modified:
    - internal/server/routes.go
    - internal/server/server.go
    - internal/updater/updater.go

key-decisions:
  - "Separate UpdateHandler struct (not merged into existing Handlers) due to Updater dependency"
  - "ApplyDist method added to Updater struct to encapsulate download+verify+extract pipeline"
  - "HTTP Flush + time.AfterFunc(1s) pattern for sending response before init.d restart kills process"

patterns-established:
  - "Fire-and-forget restart: flush HTTP response, then exec init.d script after delay"
  - "UpdateHandler struct with updater dependency injection, separate from main Handlers"
  - "IsUpdating() guard with HTTP 409 Conflict for concurrent update prevention"

requirements-completed: [SUPD-01, SUPD-02, SUPD-03, SUPD-04, SUPD-05, SUPD-06]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 15 Plan 02: Update HTTP API Summary

**HTTP handlers for self-update REST API with init.d restart, external-ui dist update, and auth-protected route registration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T10:41:00Z
- **Completed:** 2026-03-03T10:44:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint)
- **Files modified:** 4

## Accomplishments
- Complete REST API for self-update: check, apply, rollback, apply-dist endpoints
- Service restart via init.d S99xmeow-ui with 1s delay after HTTP response flush
- ApplyDist handler for external-ui mode SPA updates (downloads dist.tar.gz, verifies SHA256, extracts)
- All update endpoints protected by auth middleware in chi router

## Task Commits

Each task was committed atomically:

1. **Task 1: Create handler/update.go + wire routes and Updater** - `d42ac26` (feat)
2. **Task 2: Checkpoint verification** - approved (no commit, human-verify)

## Files Created/Modified
- `internal/handler/update.go` - 4 HTTP handlers: CheckUpdate (GET), ApplyUpdate (POST), RollbackUpdate (POST), ApplyDist (POST)
- `internal/server/routes.go` - Route registration for /api/update/* under auth group, updated NewRouter signature
- `internal/server/server.go` - Updater creation via updater.NewUpdater(cfg) and wiring into NewRouter
- `internal/updater/updater.go` - Added ApplyDist(ctx, destDir) method for external-ui dist.tar.gz updates

## Decisions Made
- Separate UpdateHandler struct with Updater dependency rather than adding to existing Handlers (cleaner separation of concerns)
- ApplyDist method added to Updater struct instead of exporting internal functions (encapsulates download+verify+extract pipeline)
- HTTP Flush + time.AfterFunc(1s, restartService) pattern: ensures HTTP response reaches client before init.d kills the process

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All self-update backend API endpoints ready for frontend consumption
- Phase 16 (Update Frontend) can call GET /api/update/check, POST /api/update/apply, POST /api/update/rollback, POST /api/update/apply-dist
- ReleaseInfo JSON structure stable for UI rendering (current_version, latest_version, has_update, release_notes)
- IsExternalUI() mode detection enables dual-mode UI in Phase 16

## Self-Check: PASSED

- All 4 files verified present on disk (handler/update.go, routes.go, server.go, updater.go)
- Task 1 commit verified in git log (d42ac26)
- Task 2 checkpoint approved by user

---
*Phase: 15-self-update-backend*
*Completed: 2026-03-03*
