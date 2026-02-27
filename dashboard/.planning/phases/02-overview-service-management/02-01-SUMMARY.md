---
phase: 02-overview-service-management
plan: 01
subsystem: api
tags: [flask, subprocess, typescript, recharts, shadcn-ui, mihomo-api, service-management]

# Dependency graph
requires:
  - phase: 01-scaffold-config-api-setup-wizard
    provides: Flask server.py with health/config/xkeen endpoints, settings store with API URLs
provides:
  - Flask service management endpoints (POST /api/service/{action}, GET /api/service/status, GET /api/versions)
  - mihomo-api.ts client (fetchMihomoVersion, upgradeCore, restartMihomo, fetchConnectionsSnapshot)
  - config-api.ts client (serviceAction, fetchServiceStatus, fetchVersions)
  - format.ts utilities (formatBytes, formatSpeed, formatUptime)
  - shadcn/ui components (alert-dialog, dropdown-menu, dialog, toggle-group)
  - recharts library installed
affects: [02-02, 02-03, overview-page, service-control-ui, sidebar-versions]

# Tech tracking
tech-stack:
  added: [recharts 3.7.0, shadcn/ui alert-dialog, shadcn/ui dropdown-menu, shadcn/ui dialog, shadcn/ui toggle-group]
  patterns: [subprocess with timeout for system commands, typed API clients using settings store, pure formatting utilities]

key-files:
  created:
    - src/lib/mihomo-api.ts
    - src/lib/config-api.ts
    - src/lib/format.ts
    - src/components/ui/alert-dialog.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/dialog.tsx
    - src/components/ui/toggle-group.tsx
    - src/components/ui/toggle.tsx
  modified:
    - backend/server.py
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "XKEEN_INIT_SCRIPT configurable via environment variable (default /opt/etc/init.d/S24xray)"
  - "Dashboard version hardcoded as 0.1.0 (will be dynamic in Phase 10)"
  - "formatBytes uses clamped index to prevent UNITS array overflow on very large values"

patterns-established:
  - "API client pattern: getBaseUrl() + getHeaders() from settings store for all fetch calls"
  - "Subprocess timeout pattern: all subprocess.run calls wrapped with timeout and try/except"

requirements-completed: [API-05, API-06]

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 2 Plan 1: API Foundation Summary

**Flask service management endpoints (start/stop/restart/status/versions) + typed TypeScript API clients for mihomo and Config API + formatting utilities + recharts and shadcn/ui components**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T00:15:04Z
- **Completed:** 2026-02-27T00:18:08Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Extended Flask backend with 4 new service management endpoints with subprocess timeout protection
- Created typed TypeScript API clients for both mihomo REST API and Config API service management
- Added pure formatting utilities (bytes, speed, uptime) for overview metrics display
- Installed recharts 3.7.0 and 4 new shadcn/ui components for Phase 2 UI needs

## Task Commits

Each task was committed atomically:

1. **Task 1: Flask backend -- service management + versions endpoints** - `4510de1` (feat)
2. **Task 2: Frontend API clients, format utilities, and shadcn/ui components** - `3ddbaef` (feat)

## Files Created/Modified
- `backend/server.py` - Added subprocess import, XKEEN_INIT config, service action/status/versions endpoints
- `src/lib/mihomo-api.ts` - Mihomo REST API client (version, upgrade, restart, connections)
- `src/lib/config-api.ts` - Config API client for service management (action, status, versions)
- `src/lib/format.ts` - Formatting utilities (formatBytes, formatSpeed, formatUptime)
- `src/components/ui/alert-dialog.tsx` - shadcn/ui AlertDialog for confirmations
- `src/components/ui/dropdown-menu.tsx` - shadcn/ui DropdownMenu for service control
- `src/components/ui/dialog.tsx` - shadcn/ui Dialog for update details
- `src/components/ui/toggle-group.tsx` - shadcn/ui ToggleGroup for metrics view switching
- `src/components/ui/toggle.tsx` - shadcn/ui Toggle (dependency of toggle-group)
- `package.json` - Added recharts dependency
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- XKEEN_INIT_SCRIPT configurable via environment variable (default /opt/etc/init.d/S24xray) -- allows different init script names per installation
- Dashboard version hardcoded as "0.1.0" -- will be made dynamic in Phase 10 self-update
- formatBytes uses clamped index to prevent UNITS array overflow on very large values (>1 PB)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- API clients ready for WebSocket hooks and overview page (Plan 02)
- Format utilities ready for metrics display
- shadcn/ui components ready for service control UI and metrics view toggle (Plans 02-03)
- All backend endpoints available for service management integration

## Self-Check: PASSED

All 8 created/modified source files verified present. Both task commits (4510de1, 3ddbaef) verified in git log.

---
*Phase: 02-overview-service-management*
*Completed: 2026-02-27*
