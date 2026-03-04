---
phase: 16-update-frontend
plan: 01
subsystem: ui
tags: [zustand, react, update-api, sidebar-badge, auto-check]

# Dependency graph
requires:
  - phase: 15-self-update-backend
    provides: "Go update HTTP API endpoints (/api/update/check, apply, rollback, apply-dist, health)"
provides:
  - "Update API client (src/lib/update-api.ts) with typed ReleaseInfo and all endpoint functions"
  - "Zustand update store (src/stores/update.ts) with check/apply/rollback actions"
  - "Sidebar green dot badge for update notification"
  - "Auto-check polling (on load + every 6 hours)"
  - "Settings toggle for auto-check control"
  - "Backend is_external_ui field in ReleaseInfo struct"
affects: [16-02-PLAN]

# Tech tracking
tech-stack:
  added: [react-markdown, remark-gfm]
  patterns: [volatile-zustand-store, auto-check-interval, sidebar-badge-notification]

key-files:
  created:
    - src/lib/update-api.ts
    - src/stores/update.ts
  modified:
    - internal/updater/updater.go
    - src/stores/settings.ts
    - src/components/layout/AppSidebar.tsx
    - src/App.tsx
    - src/pages/SettingsPage.tsx
    - package.json

key-decisions:
  - "Volatile (non-persisted) Zustand store for update state -- no stale data across reloads"
  - "6-hour auto-check interval controlled by settings toggle"
  - "Green dot notification on sidebar only -- no toast popups"

patterns-established:
  - "Update API client pattern: separate update-api.ts following config-api.ts conventions"
  - "Auto-check pattern: useEffect with isConfigured + autoCheckUpdates deps, getState() in setInterval"

requirements-completed: [UPUI-04, UPUI-05]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 16 Plan 01: Update Foundation Summary

**Update API client, Zustand store, sidebar green dot badge, 6-hour auto-check polling, and settings toggle for auto-update control**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T04:17:52Z
- **Completed:** 2026-03-04T04:21:48Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Backend ReleaseInfo struct extended with IsExternalUI field (propagated in JSON automatically)
- Full update API client with checkUpdate, applyUpdate, applyDist, rollbackUpdate, checkHealth
- Zustand store with all update actions (check, apply, dist, rollback, clearError)
- Sidebar shows green dot next to "Obnovleniya" when update available
- App auto-checks on load and every 6 hours (controlled by settings toggle)
- Settings page has "Avtooobnovleniya" toggle with persistent state

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend is_external_ui + npm deps + API client + Zustand store + settings extension** - `45ad6ec` (feat)
2. **Task 2: Sidebar badge + auto-check initialization + settings toggle** - `434646e` (feat)

## Files Created/Modified
- `internal/updater/updater.go` - Added IsExternalUI field to ReleaseInfo struct and populated in Check()
- `src/lib/update-api.ts` - API client with ReleaseInfo type and 5 endpoint functions
- `src/stores/update.ts` - Volatile Zustand store with check/apply/rollback actions
- `src/stores/settings.ts` - Added autoCheckUpdates boolean with setter
- `src/components/layout/AppSidebar.tsx` - Green dot badge on Updates menu item
- `src/App.tsx` - Auto-check useEffect with 6-hour interval
- `src/pages/SettingsPage.tsx` - Avtooobnovleniya toggle section
- `package.json` - Added react-markdown, remark-gfm dependencies

## Decisions Made
- Volatile (non-persisted) Zustand store for update state -- avoids stale data after browser restart
- 6-hour auto-check interval with isConfigured guard -- no checks before setup wizard completes
- Green dot notification pattern matches existing VersionLine green dot pattern in sidebar

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- API client and store ready for Plan 02 to build the update page UI
- react-markdown + remark-gfm installed for changelog rendering
- is_external_ui field ready for external-ui mode detection in UI

## Self-Check: PASSED

- All created files exist (src/lib/update-api.ts, src/stores/update.ts)
- All commits found (45ad6ec, 434646e)
- TypeScript compiles without errors
- Vite build succeeds

---
*Phase: 16-update-frontend*
*Completed: 2026-03-04*
