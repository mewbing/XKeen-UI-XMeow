---
phase: 17-web-terminal
plan: 02
subsystem: ui
tags: [xterm.js, websocket, zustand, terminal, ssh]

# Dependency graph
requires:
  - phase: 17-web-terminal/01
    provides: "Go backend SSH/PTY WebSocket bridge at /ws/terminal"
provides:
  - "useTerminalStore Zustand store for terminal connection state and UI"
  - "useTerminalWs WebSocket hook with binary+JSON hybrid protocol"
  - "SSH settings (host/port/user) persisted in settings store"
  - "xterm.js npm packages installed"
  - "Vite dev proxy for /ws/terminal"
affects: [17-web-terminal/03]

# Tech tracking
tech-stack:
  added: ["@xterm/xterm 6.0.0", "@xterm/addon-fit 0.11.0", "@xterm/addon-search 0.16.0", "@xterm/addon-web-links 0.12.0"]
  patterns: ["Volatile Zustand store (no persist) for transient connection state", "Binary ArrayBuffer WS for terminal I/O + JSON text frames for control"]

key-files:
  created:
    - "src/stores/terminal.ts"
    - "src/hooks/useTerminalWs.ts"
  modified:
    - "src/stores/settings.ts"
    - "vite.config.ts"
    - "package.json"
    - "pnpm-lock.yaml"

key-decisions:
  - "Volatile (non-persisted) terminal store -- connection state must not survive reloads"
  - "ArrayBuffer binaryType instead of Blob for simpler sync terminal data handling"
  - "Auth token as WS query parameter (token=SECRET) matching existing backend pattern"

patterns-established:
  - "Binary+JSON hybrid WS protocol: ArrayBuffer for stream data, JSON string for control messages"
  - "reset() preserves UI preferences (fontSize, isFullscreen) but clears connection state"

requirements-completed: [TERM-06, TERM-07, TERM-08]

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 17 Plan 02: Frontend Infrastructure Summary

**xterm.js packages, volatile Zustand terminal store, and binary+JSON WebSocket hook with auth for SSH bridge**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T12:12:17Z
- **Completed:** 2026-03-04T12:14:42Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Installed 4 xterm.js packages (@xterm/xterm, addon-fit, addon-search, addon-web-links)
- Created volatile Zustand terminal store with connection state + UI preferences
- Added sshHost/sshPort/sshUser persisted settings with defaults (localhost:22/root)
- Built useTerminalWs hook: binary ArrayBuffer for terminal I/O, JSON for control messages
- Configured Vite dev proxy for /ws/terminal before generic /ws entry

## Task Commits

Each task was committed atomically:

1. **Task 1: Install xterm.js packages and create terminal store** - `37e26a4` (feat)
2. **Task 2: WebSocket hook and Vite proxy config** - `2ff74f9` (feat)

## Files Created/Modified
- `src/stores/terminal.ts` - Volatile Zustand store for terminal connection state and UI
- `src/hooks/useTerminalWs.ts` - WebSocket hook with binary+JSON hybrid protocol, auth, auto-reconnect
- `src/stores/settings.ts` - Added sshHost, sshPort, sshUser persisted fields
- `vite.config.ts` - Added /ws/terminal proxy entry for dev server
- `package.json` - Added @xterm/xterm and 3 addon packages
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Volatile (non-persisted) terminal store -- connection state should not survive page reloads (same pattern as Phase 16 update store)
- Used ArrayBuffer binaryType instead of Blob for synchronous terminal data handling (avoids async Blob.arrayBuffer() call)
- Auth token passed as WS query parameter matching existing backend convention

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Terminal store and WS hook ready for consumption by UI components in Plan 03
- xterm.js packages available for Terminal component rendering
- Settings store has SSH fields for connection dialog

## Self-Check: PASSED

- [x] src/stores/terminal.ts exists
- [x] src/hooks/useTerminalWs.ts exists
- [x] Commit 37e26a4 found (Task 1)
- [x] Commit 2ff74f9 found (Task 2)

---
*Phase: 17-web-terminal*
*Completed: 2026-03-04*
