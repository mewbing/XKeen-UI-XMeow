---
phase: 20-remote-management
plan: 04
subsystem: ui
tags: [react, zustand, websocket, remote-management, agent-ui, token-management]

# Dependency graph
requires:
  - phase: 20-remote-management
    plan: 03
    provides: "REST API at /api/remote/* for agents and tokens, WebSocket /ws/remote/status"
  - phase: 12-go-backend
    provides: "Settings store with configApiUrl, mihomoSecret, API client patterns"
provides:
  - "Remote Management page with agent list and real-time status"
  - "Token generation and management dialog"
  - "API client for /api/remote/* endpoints"
  - "Zustand store with WebSocket connection for live agent updates"
  - "Sidebar navigation entry for Remote page"
affects: [20-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Volatile Zustand store with external WebSocket instance for cleanup", "CopyButton with navigator.clipboard + execCommand fallback for HTTP context", "Auto-reconnect WebSocket pattern with 5s delay and guard against redundant connections"]

key-files:
  created:
    - src/lib/remote-api.ts
    - src/stores/remote.ts
    - src/pages/RemotePage.tsx
    - src/components/remote/AgentCard.tsx
    - src/components/remote/AgentList.tsx
    - src/components/remote/TokenManager.tsx
  modified:
    - src/App.tsx
    - src/components/layout/AppSidebar.tsx

key-decisions:
  - "WebSocket instance stored outside Zustand (module-level let) for proper cleanup, same pattern as update store"
  - "Empty state includes step-by-step setup instructions with curl command and copy button"
  - "Token one-time view pattern: newly created token shown in warning card, dismissed with 'Gotovo' button"
  - "Radio icon for Remote sidebar item (satellite/broadcast metaphor)"
  - "Agent delete and token revoke use separate AlertDialog confirmations"

patterns-established:
  - "CopyButton reusable pattern: navigator.clipboard with textarea fallback for HTTP"
  - "WebSocket auto-reconnect with clearReconnectTimer guard and onclose=null on intentional disconnect"
  - "Remote API client follows config-api.ts pattern: getBaseUrl + authHeaders helpers"

requirements-completed: [RMT-04, RMT-07]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 20 Plan 04: Frontend Remote Page Summary

**Remote management UI with agent cards, real-time WebSocket status, token generation dialog, and empty state onboarding instructions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T20:33:30Z
- **Completed:** 2026-03-16T20:38:33Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- API client for all /api/remote/* endpoints (fetchAgents, createToken, listTokens, revokeToken, deleteAgent)
- Zustand store with agent list, WebSocket connection for real-time status updates, and auto-reconnect
- RemotePage with AgentList (grid layout) and empty state (setup instructions + copy button)
- AgentCard with online/offline status dot, device info (arch, mihomo version, IP, uptime), connect/delete actions
- TokenManager dialog: create tokens with one-time view warning, list existing tokens with revoke functionality
- Route and sidebar navigation added for /remote path

## Task Commits

Each task was committed atomically:

1. **Task 1: Remote API client and Zustand store with WebSocket** - `7d37fa0` (feat)
2. **Task 2: Remote page with agent cards, empty state, and token manager** - `f8f3920` (feat)

## Files Created/Modified
- `src/lib/remote-api.ts` - API client for /api/remote/* endpoints with AgentInfo and AgentToken types
- `src/stores/remote.ts` - Volatile Zustand store with agent list, WebSocket connection, auto-reconnect
- `src/pages/RemotePage.tsx` - Remote management page with header, agent list, delete confirmation
- `src/components/remote/AgentCard.tsx` - Agent card with status dot, device info, uptime, actions
- `src/components/remote/AgentList.tsx` - Agent grid with empty state showing setup instructions
- `src/components/remote/TokenManager.tsx` - Token creation dialog with one-time view and revoke
- `src/App.tsx` - Added /remote route with RemotePage import
- `src/components/layout/AppSidebar.tsx` - Added Radio icon menu item for remote page

## Decisions Made
- WebSocket instance stored outside Zustand at module level for proper cleanup (same pattern as update check interval)
- Empty state includes numbered steps with curl command and HTTP-safe copy button
- Token one-time view uses amber warning card with explicit "Gotovo" dismiss
- Agent uptime formatted in Russian: days + hours or hours + minutes
- Relative time for last heartbeat: "X min nazad", "X ch nazad" etc.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Remote page fully functional with all UI components
- WebSocket connection provides real-time agent status updates
- Ready for Plan 05: Context switching (using activeAgentId from store)
- setActiveAgent action already in place, navigation to overview pending Plan 05

## Self-Check: PASSED

- [x] src/lib/remote-api.ts - FOUND
- [x] src/stores/remote.ts - FOUND
- [x] src/pages/RemotePage.tsx - FOUND
- [x] src/components/remote/AgentCard.tsx - FOUND
- [x] src/components/remote/AgentList.tsx - FOUND
- [x] src/components/remote/TokenManager.tsx - FOUND
- [x] src/App.tsx - MODIFIED
- [x] src/components/layout/AppSidebar.tsx - MODIFIED
- [x] Commit 7d37fa0 - FOUND
- [x] Commit f8f3920 - FOUND
- [x] npx tsc --noEmit - PASSED

---
*Phase: 20-remote-management*
*Completed: 2026-03-17*
