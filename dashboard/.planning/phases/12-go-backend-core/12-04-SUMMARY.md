---
phase: 12-go-backend-core
plan: 04
subsystem: api
tags: [go, reverse-proxy, httputil, mihomo, vite, auth-injection]

# Dependency graph
requires:
  - phase: 12-go-backend-core/01
    provides: "Go project scaffold with chi router, config loading (GetMihomoSecret, GetMihomoExternalController)"
  - phase: 12-go-backend-core/02
    provides: "REST API handlers and route registration framework"
  - phase: 12-go-backend-core/03
    provides: "WebSocket log streaming, completing all 14 REST endpoints"
provides:
  - Mihomo reverse proxy /api/mihomo/* with Bearer auth injection
  - Auto-detection of mihomo address from config.yaml external-controller field
  - Vite dev config with Go backend mode documentation
  - Complete Go backend binary (14 REST + 1 WS + SPA embed + reverse proxy)
  - User-verified binary: compiles, starts, serves health endpoint, auth works
affects: [13-ci-cd-pipeline, 14-installer, 15-self-update-backend]

# Tech tracking
tech-stack:
  added: []
  patterns: [reverse-proxy-rewrite, auth-header-injection, dual-dev-mode-vite]

key-files:
  created:
    - internal/proxy/mihomo.go
  modified:
    - internal/server/routes.go
    - vite.config.ts

key-decisions:
  - "httputil.ReverseProxy with Rewrite (not Director) per Go best practices"
  - "503 JSON fallback when mihomo not configured instead of panic"
  - "Vite config keeps Flask mode active, Go backend mode as commented-out alternative"

patterns-established:
  - "Reverse proxy pattern: Rewrite strips prefix + injects auth header, no StripPrefix wrapper needed"
  - "Dual dev mode: Flask+mihomo vs Go backend via commented proxy config blocks"

requirements-completed: [GOBK-04]

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 12 Plan 04: Mihomo Reverse Proxy + Integration Verification Summary

**httputil.ReverseProxy for /api/mihomo/* with auto-detected address and Bearer auth injection, completing the Go backend binary**

## Performance

- **Duration:** 5 min (automated), + checkpoint wait for user verification
- **Started:** 2026-03-01T19:37:17Z
- **Completed:** 2026-03-02T07:19:28Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Mihomo reverse proxy strips /api/mihomo prefix and forwards to mihomo external-controller with Bearer auth injection
- Mihomo address and secret auto-detected from config.yaml (no extra configuration needed)
- Graceful 503 JSON error when mihomo not configured (no crash)
- Vite config documented with two dev modes (Flask+mihomo vs Go backend) for developer flexibility
- User-verified complete Go backend: 14 MB binary, health endpoint, auth middleware, SPA serving all confirmed working

## Task Commits

Each task was committed atomically:

1. **Task 1: Mihomo reverse proxy + Vite dev config update** - `61c0d1d` (feat)
2. **Task 2: Verify complete Go backend** - checkpoint:human-verify (approved by user)

## Files Created/Modified
- `internal/proxy/mihomo.go` - Reverse proxy handler with Rewrite function, auth injection, 503 fallback
- `internal/server/routes.go` - Added proxy import, registered /api/mihomo/* route inside auth group
- `vite.config.ts` - Two-mode documentation, commented-out Go backend proxy config

## Decisions Made
- Used `httputil.ReverseProxy` with `Rewrite` function (not deprecated `Director`) per Go RESEARCH anti-pattern guidance
- Return 503 with JSON error `{"error": "Mihomo not configured"}` when mihomo address empty or config not found, instead of panicking
- Kept Flask proxy config active in vite.config.ts with Go backend mode as commented alternative -- allows gradual transition during development
- Mihomo proxy route placed inside auth-protected group (Go backend auth protects mihomo access)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Go binary not on PATH in bash environment; resolved by finding it at `/c/Go/bin/go.exe` and using explicit PATH export
- User verification confirmed auth returns 404 (not 401) when no mihomo secret configured -- this is correct behavior: middleware passes through when no secret, then endpoint returns 404 for missing config file

## User Setup Required
None - no external service configuration required.

## Verification Results (User-Confirmed)

1. Build: 14.4 MB binary compiled successfully
2. Startup: Logs "Antigravity Dashboard vdev", "Running in development mode (CORS enabled)", "Mihomo reverse proxy -> http://127.0.0.1:9090", "listening on :5000"
3. Health check: GET /api/health returns `{"status":"ok"}` with 200
4. SPA fallback: GET / returns 200 with 1257B (index.html)
5. Auth: Passes through correctly when no secret configured
6. go vet: Passes clean with no issues

## Next Phase Readiness
- Phase 12 (Go Backend Core) is fully complete: all 4 plans executed
- Go binary ready for cross-compilation in Phase 13 (CI/CD Pipeline)
- Complete feature set: 14 REST endpoints + 1 WebSocket + SPA embed + mihomo reverse proxy + auth + CORS + graceful shutdown
- Project structure: 22 Go files in standard layout (cmd/ + internal/)

---
*Phase: 12-go-backend-core*
*Completed: 2026-03-02*
