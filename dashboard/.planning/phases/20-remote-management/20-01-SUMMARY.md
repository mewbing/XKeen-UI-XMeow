---
phase: 20-remote-management
plan: 01
subsystem: infra
tags: [ssh, reverse-tunnel, ed25519, token-auth, golang, crypto]

# Dependency graph
requires:
  - phase: 12-go-backend
    provides: "Go server infrastructure, AppConfig pattern, module structure"
provides:
  - "SSH server package (internal/sshserver/) for accepting agent reverse tunnels"
  - "Token store package (internal/remote/) for agent token CRUD and validation"
  - "AgentConn/AgentInfo types for agent state tracking"
  - "Ed25519 host key generation and persistence"
  - "Reverse tunnel port forwarding with dynamic port allocation"
  - "Heartbeat processing via custom SSH global request"
affects: [20-02, 20-03, 20-04, 20-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["SSH server with PasswordCallback token auth", "Reverse tunnel via tcpip-forward + forwarded-tcpip channels", "JSON file persistence for token store with 0600 permissions", "AgentConn lifecycle with listener cleanup on disconnect"]

key-files:
  created:
    - internal/remote/store.go
    - internal/sshserver/server.go
    - internal/sshserver/tunnel.go
    - internal/sshserver/agent.go
  modified: []

key-decisions:
  - "Token format: 64 hex chars from crypto/rand (256-bit entropy)"
  - "Agent ID format: 8 hex chars (sufficient uniqueness for small agent sets)"
  - "Host key: ed25519 via PKCS8+PEM, persisted to disk on first generation"
  - "Heartbeat: custom SSH global request 'heartbeat' with JSON payload"
  - "Dynamic port allocation: net.Listen 127.0.0.1:0 to avoid port conflicts"
  - "Token masking in List: show only first 8 chars to prevent full token exposure"

patterns-established:
  - "SSH PasswordCallback: token as password, username as device_name (informational)"
  - "Agent permissions via ssh.Permissions.Extensions['agent-id']"
  - "onAgentChange callback pattern for WebSocket notification integration"
  - "Store save() as unexported method — callers hold lock"

requirements-completed: [RMT-01, RMT-03, RMT-07]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 20 Plan 01: SSH Server & Token Store Summary

**Embedded SSH server with ed25519 host key, token-based agent auth, reverse tunnel port forwarding, heartbeat processing, and JSON-persisted token store**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T20:08:53Z
- **Completed:** 2026-03-16T20:14:17Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- Token store with full CRUD operations (Create, List, Get, Revoke, Delete, ValidateToken) and JSON file persistence at 0600 permissions
- SSH server accepting agent connections with token-as-password authentication via PasswordCallback
- Reverse tunnel handling via tcpip-forward with dynamic 127.0.0.1:0 port allocation and bidirectional io.Copy forwarding
- Heartbeat processing via custom SSH global request type, updating agent state (name, arch, mihomo_ver, uptime, ip)
- Ed25519 host key generation on first run with disk persistence (never regenerates)
- Clean agent lifecycle: registerAgent/unregisterAgent with full listener cleanup on disconnect

## Task Commits

Each task was committed atomically:

1. **Task 1: Token store with JSON file persistence** - `80cdcb9` (feat)
2. **Task 2: SSH server with reverse tunnel and heartbeat support** - `84134cb` (feat)

## Files Created/Modified
- `internal/remote/store.go` - Agent token CRUD, JSON persistence, token generation/validation
- `internal/sshserver/agent.go` - AgentConn, AgentInfo, HeartbeatData types; agent state management
- `internal/sshserver/server.go` - SSH server lifecycle, host key management, connection handling
- `internal/sshserver/tunnel.go` - Reverse tunnel (tcpip-forward), heartbeat handling, bidirectional forwarding

## Decisions Made
- Token format: 64 hex chars from crypto/rand (256-bit entropy) — URL-safe, log-safe, copy-paste friendly
- Agent ID: 8 hex chars — sufficient uniqueness for typical agent count (<100)
- Host key: ed25519 via PKCS8 DER + PEM encoding — smaller and faster than RSA, ideal for embedded
- Heartbeat via custom SSH global request "heartbeat" — avoids opening SSH channels, lightweight
- Dynamic port allocation (127.0.0.1:0) for all forwarded ports — prevents port conflicts between agents
- Store save() unexported — write lock must be held by caller, prevents double-lock bugs
- Token masking in List() — first 8 chars + "..." to prevent full token exposure in API responses

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both packages compile and pass go vet
- SSH server ready to be wired into main server lifecycle (Plan 02: agent binary, Plan 03: HTTP handlers)
- Token store ValidateToken ready for SSH PasswordCallback integration
- onAgentChange callback ready for WebSocket notification wiring

## Self-Check: PASSED

- [x] internal/remote/store.go - FOUND
- [x] internal/sshserver/agent.go - FOUND
- [x] internal/sshserver/server.go - FOUND
- [x] internal/sshserver/tunnel.go - FOUND
- [x] Commit 80cdcb9 - FOUND
- [x] Commit 84134cb - FOUND
- [x] go build ./internal/remote/... ./internal/sshserver/... - OK
- [x] go vet ./internal/remote/... ./internal/sshserver/... - OK

---
*Phase: 20-remote-management*
*Completed: 2026-03-17*
