---
phase: 17-web-terminal
plan: 01
subsystem: api
tags: [ssh, websocket, terminal, pty, golang-x-crypto]

# Dependency graph
requires:
  - phase: 12-go-backend
    provides: Go backend with chi router, handler pattern, WebSocket upgrader, config package
provides:
  - SSH terminal session with PTY (connect, read, write, resize, close)
  - Single-session hub with 30-minute inactivity timeout
  - WebSocket terminal handler with Bearer token auth at /ws/terminal
  - Terminal hub lifecycle integrated into server start/shutdown
affects: [17-web-terminal]

# Tech tracking
tech-stack:
  added: [golang.org/x/crypto/ssh]
  patterns: [channel-based output reader with context cancellation, session-survives-WS-disconnect pattern]

key-files:
  created:
    - internal/terminal/session.go
    - internal/terminal/hub.go
    - internal/handler/ws_terminal.go
  modified:
    - internal/server/routes.go
    - internal/server/server.go
    - go.mod
    - go.sum

key-decisions:
  - "ssh.InsecureIgnoreHostKey for home router local network connection"
  - "Channel-based output reader wrapping blocking session.Read() for context-cancellable select"
  - "Auth check before WS upgrade (unlike /ws/logs) with token query param fallback"
  - "Session.Shell() uses default login shell from /etc/passwd -- no explicit shell detection"

patterns-established:
  - "Terminal session survives WS disconnect -- hub keeps session alive within timeout window"
  - "Output reader goroutine with context cancel + WaitGroup for clean shutdown"

requirements-completed: [TERM-01, TERM-02, TERM-03, TERM-04, TERM-05]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 17 Plan 01: Go Backend SSH Terminal Summary

**SSH terminal package with PTY session management, inactivity timeout hub, and authenticated WebSocket handler at /ws/terminal**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T12:12:28Z
- **Completed:** 2026-03-04T12:15:28Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- SSH client session with xterm-256color PTY, stdin/stdout pipes, window resize, and idempotent close
- Single-session hub with 1-minute ticker checking 30-minute inactivity timeout
- WebSocket handler with Bearer token auth (query param + header fallback) validated before upgrade
- Binary frames bridge SSH stdout to WS client; text frames carry JSON control messages (connect/resize/disconnect/ping)
- Session survives WS disconnect -- hub keeps it alive for reconnection within timeout window
- Terminal hub created on server start, shut down gracefully alongside LogHub

## Task Commits

Each task was committed atomically:

1. **Task 1: SSH terminal session and hub packages** - `5329718` (feat)
2. **Task 2: WebSocket terminal handler and route registration** - `df87329` (feat)

## Files Created/Modified
- `internal/terminal/session.go` - SSH client session with PTY, stdin/stdout pipes, resize, inactivity tracking
- `internal/terminal/hub.go` - Single-session manager with 30-min inactivity timeout checker goroutine
- `internal/handler/ws_terminal.go` - WebSocket handler with auth, binary/JSON routing, output reader goroutine
- `internal/server/routes.go` - Added termHub parameter and /ws/terminal route registration
- `internal/server/server.go` - Added terminal.Hub creation (30min timeout) and shutdown
- `go.mod` - Added golang.org/x/crypto dependency
- `go.sum` - Updated checksums

## Decisions Made
- Used `ssh.InsecureIgnoreHostKey()` -- acceptable for home router on local network
- Auth check before WS upgrade (unlike /ws/logs which has no auth) using token query param with Authorization header fallback
- Channel-based output reader wrapping blocking `session.Read()` to enable `select` with context cancellation
- `session.Shell()` uses default login shell from /etc/passwd -- no explicit shell detection needed
- Default PTY size 80x24 if client doesn't specify cols/rows

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Go backend terminal infrastructure complete and ready for frontend integration
- Plan 02 (xterm.js frontend) can connect to /ws/terminal endpoint
- Plan 03 (toolbar and settings) can extend the established WS protocol

## Self-Check: PASSED

- All 7 files verified present
- Commit 5329718 verified
- Commit df87329 verified

---
*Phase: 17-web-terminal*
*Completed: 2026-03-04*
