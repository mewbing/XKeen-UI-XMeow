---
phase: 20-remote-management
plan: 02
subsystem: agent
tags: [ssh, reverse-tunnel, heartbeat, auto-reconnect, agent, installer]

# Dependency graph
requires:
  - phase: 20-remote-management (plan 01)
    provides: SSH server that accepts agent connections with token auth
provides:
  - xmeow-agent binary with SSH tunnel, heartbeat, auto-reconnect
  - setup.sh --agent flag for one-liner agent installation on remote routers
affects: [20-remote-management plans 03-05, CI/CD release pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone agent binary with minimal dependencies (only golang.org/x/crypto/ssh + stdlib)"
    - "SSH reverse tunnel via tcpip-forward global request + forwarded-tcpip channel handling"
    - "Heartbeat via custom SSH global request type"
    - "Exponential backoff with jitter for auto-reconnect"

key-files:
  created:
    - cmd/xmeow-agent/main.go
  modified:
    - setup.sh

key-decisions:
  - "Agent is a single-file Go binary with no internal/ imports for minimal binary size"
  - "Heartbeat sends device_name, arch, mihomo_ver, uptime, IP every 30 seconds"
  - "Backoff: 1s initial, 5min max, 30% jitter to prevent thundering herd"
  - "agent.conf uses JSON format with 0600 permissions for security"
  - "Setup.sh agent config preserved on reinstall (never overwritten)"

patterns-established:
  - "Agent connects with DeviceName as SSH user, token as password"
  - "forwardedTCPPayload struct for parsing forwarded-tcpip channel data"
  - "Agent artifact naming: xmeow-agent-linux-{arch}.tar.gz"
  - "Interactive config prompts with fallback to template when piped"

requirements-completed: [RMT-02, RMT-03, RMT-08, RMT-09]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 20 Plan 02: Agent Binary & Installer Summary

**xmeow-agent binary with SSH reverse tunnel (ports 5000/9090/22), 30s heartbeat, exponential backoff reconnect, and setup.sh --agent one-liner installation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T20:09:14Z
- **Completed:** 2026-03-16T20:13:56Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Standalone xmeow-agent binary that connects to master SSH server with token auth, establishes reverse tunnels for 3 ports, sends heartbeat with device info, and auto-reconnects on disconnection
- Extended setup.sh with --agent flag: downloads agent binary, interactive config prompts, creates init.d service script, starts agent

## Task Commits

Each task was committed atomically:

1. **Task 1: xmeow-agent binary with SSH tunnel, heartbeat, and auto-reconnect** - `56f04b9` (feat)
2. **Task 2: Extend setup.sh with --agent installation mode** - `89afd48` (feat)

## Files Created/Modified
- `cmd/xmeow-agent/main.go` - Agent binary: SSH client, reverse tunnel, heartbeat loop, auto-reconnect, config loading, signal handling (288 lines)
- `setup.sh` - Extended with --agent flag, install_agent() function, agent init.d script, interactive config prompts

## Decisions Made
- Agent binary is a single file with no imports from internal/ server packages — keeps binary small for MIPS routers
- JSON config format (not YAML) — simpler parsing with stdlib, only 4 fields
- Heartbeat sent immediately on connect + every 30s — server gets status faster
- forwardResponse parsed via binary.BigEndian.Uint32 instead of ssh.Unmarshal — simpler for single uint32 field
- Agent checksum verification is non-fatal — warns and continues if checksum entry not found (agent artifacts may not be in checksums.txt initially)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Agent binary ready for cross-compilation (arm64, armv7, mipsle) in CI pipeline
- Wire protocol compatible with SSH server from Plan 01 (shared heartbeat/tunnel types)
- setup.sh --agent ready for deployment to remote routers
- Plan 03 (master-side SSH server) can accept connections from this agent

## Self-Check: PASSED

- FOUND: cmd/xmeow-agent/main.go
- FOUND: 56f04b9 (Task 1 commit)
- FOUND: 89afd48 (Task 2 commit)
- FOUND: 20-02-SUMMARY.md

---
*Phase: 20-remote-management*
*Completed: 2026-03-17*
