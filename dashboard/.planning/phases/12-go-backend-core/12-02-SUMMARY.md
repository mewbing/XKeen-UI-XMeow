---
phase: 12-go-backend-core
plan: 02
subsystem: api
tags: [go, chi, rest, yaml-validation, proc-stat, curl, backup, exec]

# Dependency graph
requires:
  - phase: 12-go-backend-core/01
    provides: "Go project scaffold with chi router, config, backup, handler helpers"
provides:
  - 11 REST API handlers (config, xkeen, service, versions, system, proxies)
  - Handlers struct pattern with shared AppConfig
  - Route registration for all endpoints except logs (deferred to plan 03)
  - CPU delta calculation from /proc/stat with sync.Mutex
  - External IP lookup with curl fallback chain
affects: [12-go-backend-core, 13-ci-cd-packaging]

# Tech tracking
tech-stack:
  added: [goccy/go-yaml@1.19.2]
  patterns: [handlers-struct-pattern, cpu-delta-mutex, curl-fallback-chain, exec-with-timeout]

key-files:
  created:
    - internal/handler/handlers.go
    - internal/handler/config.go
    - internal/handler/xkeen.go
    - internal/handler/service.go
    - internal/handler/versions.go
    - internal/handler/system.go
    - internal/handler/proxies.go
  modified:
    - internal/server/routes.go
    - go.mod
    - go.sum

key-decisions:
  - "Handlers struct pattern with *config.AppConfig for all handler methods"
  - "Pointer *string for JSON body content field to distinguish missing vs empty"
  - "Package-level cpuPrev with sync.Mutex for thread-safe CPU delta calculation"
  - "context.WithTimeout on all exec.Command calls (60s service, 5s versions, 3s curl)"

patterns-established:
  - "Handlers struct: all handlers are methods on *Handlers with cfg dependency"
  - "Backup before write: CreateBackup called before every config/xkeen file save"
  - "Full path exec: h.cfg.XkeenBin used for all xkeen commands, never bare 'xkeen'"
  - "JSON null via nil: use map[string]interface{} with nil values for JSON null fields"

requirements-completed: [GOBK-01, GOBK-05, GOBK-06]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 12 Plan 02: REST API Handlers Summary

**11 REST handlers ported from Flask with identical JSON contracts: config CRUD, xkeen files, service control, system metrics, proxy extraction**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-01T19:22:18Z
- **Completed:** 2026-03-01T19:26:03Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- All 11 REST API handlers implemented matching Flask server.py contracts exactly
- YAML validation on PUT /api/config using goccy/go-yaml
- CPU usage delta calculation from /proc/stat with thread-safe mutex
- External IP lookup with 4-service curl fallback chain (ifconfig.me, icanhazip.com, api.ipify.org, ip.sb)
- Service start/stop/restart with 60-second timeout and log trimming
- Full binary compiles and passes go vet

## Task Commits

Each task was committed atomically:

1. **Task 1: Config, Xkeen, Service, Versions handlers** - `852d0ef` (feat)
2. **Task 2: System, Proxies handlers + route registration** - `0ce4146` (feat)

## Files Created/Modified
- `internal/handler/handlers.go` - Handlers struct with NewHandlers constructor
- `internal/handler/config.go` - GET/PUT /api/config with YAML validation and backup
- `internal/handler/xkeen.go` - GET/PUT /api/xkeen/{filename} with whitelist and backup
- `internal/handler/service.go` - POST /api/service/{action} and GET /api/service/status
- `internal/handler/versions.go` - GET /api/versions (xkeen -v + dashboard version)
- `internal/handler/system.go` - GET /api/system/cpu (delta) and GET /api/system/network (curl chain)
- `internal/handler/proxies.go` - GET /api/proxies/servers (YAML proxy extraction)
- `internal/server/routes.go` - 11 endpoints registered with auth middleware
- `go.mod` - Added goccy/go-yaml dependency
- `go.sum` - Updated checksums

## Decisions Made
- Used Handlers struct pattern instead of closures -- cleaner when many handlers share the same config dependency
- Pointer `*string` for JSON body `content` field to distinguish between `null`/missing and `""` -- prevents silent data loss
- Package-level `cpuPrev` with `sync.Mutex` for CPU delta state -- matches Flask's module-level `_prev_cpu` dict pattern but thread-safe
- All `exec.Command` calls use `h.cfg.XkeenBin` full path per RESEARCH pitfall #6 (Entware PATH may not include /opt/sbin)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 11 of 14 REST endpoints complete
- Plan 03 will add 3 log endpoints + WebSocket log streaming
- Plan 04 will add mihomo reverse proxy
- Binary compiles on Windows (go1.26.0), ready for cross-compilation in CI phase

## Self-Check: PASSED

All 7 created files verified on disk. Both task commits (852d0ef, 0ce4146) verified in git log.

---
*Phase: 12-go-backend-core*
*Completed: 2026-03-02*
