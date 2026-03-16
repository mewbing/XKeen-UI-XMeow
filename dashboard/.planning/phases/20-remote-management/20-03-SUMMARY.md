---
phase: 20-remote-management
plan: 03
subsystem: api
tags: [rest-api, websocket, reverse-proxy, ssh-tunnel, chi-router, gorilla-websocket, golang]

# Dependency graph
requires:
  - phase: 20-remote-management
    plan: 01
    provides: "SSH server, token store, AgentConn/AgentInfo types"
  - phase: 12-go-backend
    provides: "Server lifecycle, chi router, handler DI pattern, httputil.ReverseProxy convention"
provides:
  - "REST API at /api/remote/* for agent and token management"
  - "HTTP reverse proxy through SSH tunnel to remote agent XMeow API and mihomo API"
  - "WebSocket /ws/remote/status for real-time agent online/offline updates"
  - "SSH server integrated into main server lifecycle (start/shutdown)"
  - "AppConfig extended with SSHPort, SSHHostKeyPath, AgentsFilePath, RemoteEnabled"
affects: [20-04, 20-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["RemoteHandler with merged token store + SSH state for agent list", "WebSocket broadcast via sync.Mutex + slice of *websocket.Conn", "Conditional route registration based on RemoteEnabled config", "httputil.ReverseProxy with Rewrite through SSH tunnel local ports"]

key-files:
  created:
    - internal/remote/proxy.go
    - internal/handler/remote.go
  modified:
    - internal/config/config.go
    - internal/server/routes.go
    - internal/server/server.go
    - cmd/xmeow-server/main.go

key-decisions:
  - "Remote handler created at router top level for WS route access outside /api group"
  - "WebSocket broadcast uses simple slice + mutex pattern (not channels) for small client count"
  - "Proxy creates new httputil.ReverseProxy per request (stateless, no caching) for simplicity"
  - "Remote routes inside /api/remote sub-router to avoid chi route conflicts with /api/mihomo/* proxy"
  - "getEnvBool helper added to config package for REMOTE_ENABLED parsing"
  - "SSH server shutdown before LogHub/termHub in graceful shutdown order"

patterns-established:
  - "Conditional feature registration: nil-check handler before route registration"
  - "Merged view pattern: combine token store (persistence) with SSH server (runtime) for agent list"
  - "WebSocket ping heartbeat every 30s to keep connections alive"

requirements-completed: [RMT-06, RMT-07, RMT-08]

# Metrics
duration: 6min
completed: 2026-03-17
---

# Phase 20 Plan 03: HTTP API & Server Integration Summary

**REST API for remote agent management with HTTP reverse proxy through SSH tunnels, WebSocket status broadcast, and SSH server lifecycle wired into main server**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T20:21:39Z
- **Completed:** 2026-03-16T20:28:12Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- REST API endpoints for agent listing (merged online/offline status), token CRUD (create with full token, list masked, revoke, delete)
- HTTP reverse proxy forwarding requests through SSH tunnel to remote agent's XMeow API (port 5000) and mihomo API (port 9090)
- WebSocket /ws/remote/status with real-time broadcast on agent connect/disconnect via SSH server's onAgentChange callback
- SSH server fully integrated into main server lifecycle: starts in goroutine alongside HTTP, shuts down gracefully before other components
- Config extended with SSHPort, SSHHostKeyPath, AgentsFilePath, RemoteEnabled with env var overrides

## Task Commits

Each task was committed atomically:

1. **Task 1: HTTP proxy through SSH tunnel + config extension** - `1948c97` (feat)
2. **Task 2: Remote API handlers, WebSocket status, server integration** - `fbf6f8d` (feat)

## Files Created/Modified
- `internal/remote/proxy.go` - HTTP reverse proxy through SSH tunnel to agent XMeow API (5000) and mihomo API (9090)
- `internal/handler/remote.go` - REST handlers for /api/remote/*, WebSocket /ws/remote/status with broadcast
- `internal/config/config.go` - SSHPort, SSHHostKeyPath, AgentsFilePath, RemoteEnabled fields + getEnvBool helper
- `internal/server/routes.go` - /api/remote/* route group + /ws/remote/status registration
- `internal/server/server.go` - SSH server + token store initialization in New(), lifecycle in Start()/Shutdown()
- `cmd/xmeow-server/main.go` - Remote management enabled log line

## Decisions Made
- Remote handler created at router top level so WS route can be registered outside /api auth group
- WebSocket broadcast uses simple sync.Mutex + slice pattern (sufficient for small client count)
- Proxy creates new httputil.ReverseProxy per request for simplicity (no connection pooling needed)
- Remote routes placed inside /api/remote sub-router to avoid chi route conflict with /api/mihomo/* proxy
- SSH server shuts down first in graceful shutdown order (before LogHub and termHub)
- getEnvBool recognizes true/1/yes and false/0/no (case-insensitive)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All /api/remote/* endpoints ready for frontend consumption (Plan 04: UI)
- WebSocket /ws/remote/status ready for real-time status display
- HTTP proxy enables frontend to interact with remote agent services transparently
- Full server binary compiles and passes go vet

## Self-Check: PASSED

- [x] internal/remote/proxy.go - FOUND
- [x] internal/handler/remote.go - FOUND
- [x] internal/config/config.go - MODIFIED
- [x] internal/server/routes.go - MODIFIED
- [x] internal/server/server.go - MODIFIED
- [x] cmd/xmeow-server/main.go - MODIFIED
- [x] Commit 1948c97 - FOUND
- [x] Commit fbf6f8d - FOUND
- [x] go build ./cmd/xmeow-server/ - OK
- [x] go vet ./... - OK

---
*Phase: 20-remote-management*
*Completed: 2026-03-17*
