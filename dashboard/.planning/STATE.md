# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Users can visually edit mihomo configuration without manually editing YAML files
**Current focus:** Phase 2 -- Overview + Service Management

## Current Position

Phase: 2 of 11 (Overview + Service Management)
Plan: 2 of 3 in current phase
Status: Plan 02-02 complete, continuing Phase 2
Last activity: 2026-02-27 -- Plan 02-02 executed

Progress: [######░░░░] 22% (12/55 requirements)

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 5 min
- Total execution time: 0.47 hours

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | 9min | 2 | 16 |
| 01 | 02 | 5min | 2 | 27 |
| 01 | 03 | 3min | 1 | 1 |
| 01 | 04 | 4min | 2 | 8 |
| 02 | 01 | 3min | 2 | 11 |
| 02 | 02 | 4min | 2 | 5 |

## Accumulated Context

### Decisions

- Used Vite 7.3 (latest) instead of 6.x from research -- fully compatible
- shadcn/ui default init uses neutral base color and new-york style
- shadcn/ui latest version adds `@import "shadcn/tailwind.css"` alongside tw-animate-css
- Backup extension included in filename at creation time (not via rename) to avoid race conditions
- Xkeen file not found returns 200 with empty content (not 404) for graceful handling
- _create_backup helper extracted as reusable function for config and xkeen backups
- Settings page uses shadcn/ui Select instead of RadioGroup for start page -- cleaner with 11+ options
- Wizard gate renders null during Zustand hydration to prevent flash of wrong UI
- LocationTracker as separate component inside BrowserRouter for proper useLocation hook usage
- Kept existing Zustand hydration pattern (onFinishHydration + hasHydrated) instead of custom _hasHydrated field
- Mihomo 401 fallback: try without secret first, then retry with 'admin' as default
- 5-second AbortSignal.timeout for all API calls
- Auto-advance to success step after 1.5s delay when both tests pass
- XKEEN_INIT_SCRIPT configurable via environment variable (default /opt/etc/init.d/S24xray)
- Dashboard version hardcoded as 0.1.0 (will be dynamic in Phase 10)
- formatBytes uses clamped index to prevent UNITS array overflow on very large values
- useRef for onMessage callback in WebSocket hook to avoid stale closures and prevent WS re-creation
- Connections polled every 5s via REST instead of WebSocket to avoid heavy data on overview
- Client-side uptime tracking (Date.now on mount) since mihomo has no uptime endpoint

### Pending Todos

- None

### Blockers/Concerns

None currently.

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed 02-02-PLAN.md
Resume file: .planning/phases/02-overview-service-management/02-02-SUMMARY.md
