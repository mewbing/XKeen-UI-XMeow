---
phase: 12-go-backend-core
plan: 01
subsystem: api
tags: [go, chi, embed, cors, auth, spa, graceful-shutdown]

# Dependency graph
requires: []
provides:
  - Go module with chi v5 router and SPA embed
  - AppConfig with env var loading (Flask-identical defaults)
  - Auth middleware (Bearer/X-API-Key, reads mihomo secret)
  - CORS middleware (dev mode only)
  - Health check endpoint GET /api/health
  - Backup utility with timestamped copies
  - SPA fallback handler for client-side routing
  - Graceful shutdown with SIGINT/SIGTERM handling
affects: [12-go-backend-core, 13-ci-cd-packaging]

# Tech tracking
tech-stack:
  added: [go-chi/chi/v5@5.2.5, gorilla/websocket@1.5.3, goccy/go-yaml@1.19.2, fsnotify/fsnotify@1.9.0, go-chi/cors@1.2.2]
  patterns: [chi-middleware-chain, spa-embed-fallback, env-config-loading, auth-middleware-factory]

key-files:
  created:
    - go.mod
    - go.sum
    - embed.go
    - cmd/antigravity/main.go
    - internal/config/config.go
    - internal/server/server.go
    - internal/server/routes.go
    - internal/server/middleware.go
    - internal/handler/health.go
    - internal/handler/helpers.go
    - internal/backup/backup.go
    - internal/spa/spa.go
  modified: []

key-decisions:
  - "Simple line-scan for mihomo config fields instead of full YAML parser import in config package"
  - "Auth middleware as factory function accepting getSecret closure for lazy secret reading"
  - "SPA handler pre-reads index.html at init time for zero-alloc fallback serving"

patterns-established:
  - "Chi middleware chain: Logger -> Recoverer -> RealIP -> CORS (dev) -> Auth (per group)"
  - "SPA embed: root embed.go + fs.Sub('dist') + NotFound fallback"
  - "Config from env: getEnv/getEnvInt helpers with Flask-identical defaults"
  - "JSON response helpers: writeJSON(w, status, data) for all handlers"

requirements-completed: [GOBK-03, GOBK-07, GOBK-08]

# Metrics
duration: 24min
completed: 2026-03-02
---

# Phase 12 Plan 01: Go Project Scaffold Summary

**Go chi v5 server with embedded SPA, CORS/auth middleware, health endpoint, and graceful shutdown on :5000**

## Performance

- **Duration:** 24 min
- **Started:** 2026-03-01T18:54:03Z
- **Completed:** 2026-03-01T19:18:28Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Go module initialized with 5 external dependencies (chi, gorilla/websocket, goccy/yaml, fsnotify, chi/cors)
- Config loading reads all 7 env vars with Flask-identical defaults
- Chi v5 router with SPA fallback, CORS (dev mode), auth middleware
- GET /api/health returns {"status": "ok"} (verified with curl)
- Binary compiles and runs on Windows (go1.26.0)
- Graceful shutdown on SIGINT/SIGTERM with 5-second timeout

## Task Commits

Each task was committed atomically:

1. **Task 1: Go module init, dependencies, config, backup utility** - `3084a6b` (feat)
2. **Task 2: Chi router, SPA embed, CORS, auth middleware, health endpoint, main.go** - `b3fe4df` (feat)

## Files Created/Modified
- `go.mod` - Go module definition with 5 external dependencies
- `go.sum` - Dependency checksums
- `embed.go` - Root-level embed.FS with //go:embed all:dist
- `cmd/antigravity/main.go` - Entry point with graceful shutdown, ldflags version
- `internal/config/config.go` - AppConfig struct, LoadConfig(), GetMihomoSecret/ExternalController
- `internal/server/server.go` - HTTP server wrapper with Start/Shutdown
- `internal/server/routes.go` - Chi router with API groups, SPA fallback, CORS
- `internal/server/middleware.go` - Auth middleware (Bearer/X-API-Key validation)
- `internal/handler/health.go` - GET /api/health handler
- `internal/handler/helpers.go` - writeJSON, readJSONBody helpers
- `internal/backup/backup.go` - Timestamped backup creation utility
- `internal/spa/spa.go` - SPA handler with fs.Sub + index.html fallback

## Decisions Made
- Used simple line-by-line scanner for reading mihomo config fields (secret, external-controller) instead of importing full YAML parser in config package -- keeps config package dependency-free
- Auth middleware implemented as factory function accepting `getSecret func() string` closure -- reads secret lazily on each request so config changes are picked up immediately
- SPA handler pre-reads index.html bytes at init time and serves from memory -- zero allocation on fallback path
- HEAD method returns 405 for chi routes registered with `r.Get()` -- this is standard chi behavior, not a bug

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Go not installed on development machine**
- **Found during:** Task 1 (Go module init)
- **Issue:** Go compiler was not available on the Windows machine
- **Fix:** Downloaded Go 1.26.0 zip from go.dev, extracted to C:/go
- **Files modified:** None (system-level install)
- **Verification:** `go version` returns `go1.26.0 windows/amd64`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary prerequisite install. No scope creep.

## Issues Encountered
- Winget MSI installer for Go was extremely slow (hung for 10+ minutes). Resolved by downloading Go zip archive directly and extracting manually.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Go project scaffold complete with all infrastructure for plans 02-04
- Plan 02 can implement all 14 remaining REST endpoints using the handler helpers and router structure
- Plan 03 can add WebSocket handler using gorilla/websocket (already in go.mod)
- Plan 04 can add mihomo reverse proxy using httputil.ReverseProxy

## Self-Check: PASSED

All 12 created files verified on disk. Both task commits (3084a6b, b3fe4df) verified in git log.

---
*Phase: 12-go-backend-core*
*Completed: 2026-03-02*
