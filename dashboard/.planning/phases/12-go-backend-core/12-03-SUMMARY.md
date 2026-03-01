---
phase: 12-go-backend-core
plan: 03
subsystem: api
tags: [go, websocket, fsnotify, log-streaming, gorilla-websocket, chi]

# Dependency graph
requires:
  - phase: 12-go-backend-core/01
    provides: "Go project scaffold with chi router, config, handler helpers"
  - phase: 12-go-backend-core/02
    provides: "Handlers struct pattern, route registration framework"
provides:
  - WebSocket /ws/logs endpoint with real-time log streaming
  - logwatch package (parse, client, hub, watcher) for canonical log handling
  - 3 REST log endpoints (GET raw, GET parsed, POST clear)
  - LogHub with lazy watcher lifecycle (fsnotify + polling fallback)
  - All 14 REST endpoints now registered
affects: [12-go-backend-core, 13-ci-cd-packaging]

# Tech tracking
tech-stack:
  added: [gorilla/websocket@1.5.3, fsnotify/fsnotify@1.9.0]
  patterns: [logwatch-hub-pattern, lazy-watcher-lifecycle, ws-upgrade-handler, polling-fallback]

key-files:
  created:
    - internal/logwatch/parse.go
    - internal/logwatch/client.go
    - internal/logwatch/hub.go
    - internal/logwatch/watcher.go
    - internal/handler/ws_logs.go
    - internal/handler/logs.go
  modified:
    - internal/server/server.go
    - internal/server/routes.go
    - go.mod
    - go.sum

key-decisions:
  - "Canonical log parsing in logwatch package, imported by both WS and REST handlers -- no duplication"
  - "LogHub lazy watcher: 0 clients = 0 file watchers, starts on first WS connect"
  - "WS endpoint outside /api auth group -- no auth on WebSocket upgrade (matches Flask)"

patterns-established:
  - "LogHub pattern: client registry + lazy resource lifecycle (start on first, stop on last)"
  - "Watcher fallback: try fsnotify, fall back to 500ms polling ticker if unavailable"
  - "WS handler as separate struct (WsLogHandler) with its own ServeHTTP method"
  - "All log parsing through logwatch.ParseLogLine -- single source of truth"

requirements-completed: [GOBK-01, GOBK-02]

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 12 Plan 03: WebSocket Log Streaming + REST Log Endpoints Summary

**WebSocket /ws/logs real-time log streaming with fsnotify lazy watcher + 3 REST log endpoints, completing all 14 API routes**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-01T19:29:04Z
- **Completed:** 2026-03-01T19:33:35Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- logwatch package with canonical log parsing (2 regex formats matching Flask exactly), file reading, and clearing
- WebSocket handler with full protocol support: initial/append/clear/switchFile/reload/ping/pong
- LogHub manages WS clients with lazy watcher lifecycle (fsnotify with polling fallback)
- 3 REST log endpoints (GET raw, GET parsed, POST clear) using shared logwatch package
- All 14 REST endpoints + 1 WebSocket endpoint registered in routes.go
- gorilla/websocket and fsnotify added to go.mod

## Task Commits

Each task was committed atomically:

1. **Task 1: Logwatch package (parse, client, hub, watcher)** - `959a63e` (feat)
2. **Task 2: WS handler, REST log handlers, route registration** - `25309f2` (feat)

## Files Created/Modified
- `internal/logwatch/parse.go` - LogLine struct, ParseLogLine, ReadLogTail, ReadFromOffset, ClearLog, ReadLogRaw
- `internal/logwatch/client.go` - WS client struct with thread-safe SendJSON via mutex
- `internal/logwatch/hub.go` - LogHub: client registry, lazy watcher lifecycle, broadcast
- `internal/logwatch/watcher.go` - File watcher with fsnotify + 500ms polling fallback
- `internal/handler/ws_logs.go` - WebSocket upgrade handler with read loop and command dispatch
- `internal/handler/logs.go` - REST log handlers (GetLogFile, GetParsedLog, ClearLog)
- `internal/server/server.go` - Added LogHub field, creation in New(), shutdown in Shutdown()
- `internal/server/routes.go` - Registered 3 log REST endpoints + /ws/logs WebSocket route
- `go.mod` - Added gorilla/websocket v1.5.3, fsnotify v1.9.0
- `go.sum` - Updated checksums

## Decisions Made
- Canonical log parsing lives in logwatch package only -- REST handlers import logwatch.ReadLogTail/ClearLog instead of reimplementing. Single source of truth for log parsing logic.
- WebSocket route is outside the /api auth group (no auth on WS upgrade) -- matches Flask behavior where /ws/logs has no authentication.
- LogHub uses lazy watcher pattern: watcher starts on first WS client, stops when last client disconnects. Zero overhead when no clients connected.
- Watcher tries fsnotify first; if inotify unavailable (Entware limitation), automatically falls back to 500ms polling ticker.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] gorilla/websocket and fsnotify not in go.mod**
- **Found during:** Task 1 (logwatch package creation)
- **Issue:** Despite 12-01 summary mentioning these as dependencies, they were not present in go.mod/go.sum
- **Fix:** Ran `go get github.com/gorilla/websocket@v1.5.3` and `go get github.com/fsnotify/fsnotify@v1.9.0`
- **Files modified:** go.mod, go.sum
- **Verification:** Package compiles successfully
- **Committed in:** 959a63e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary dependency installation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 14 REST endpoints + 1 WebSocket endpoint implemented and registered
- Plan 04 can add mihomo reverse proxy as the final piece
- Binary compiles and passes go vet on Windows (go1.26.0), ready for cross-compilation

## Self-Check: PASSED

All 6 created files verified on disk. Both task commits (959a63e, 25309f2) verified in git log.

---
*Phase: 12-go-backend-core*
*Completed: 2026-03-02*
