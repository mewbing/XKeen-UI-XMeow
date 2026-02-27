---
phase: 03-proxies-page
plan: 01
subsystem: ui, api
tags: [zustand, sonner, popover, scroll-area, collapsible, mihomo-api, proxy, delay-cache]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: project scaffolding, shadcn/ui, zustand, mihomo-api base
  - phase: 02-overview-service-management
    provides: settings store, mihomo-api patterns, format.ts
provides:
  - fetchProxies, selectProxy, fetchProxyDelay, fetchGroupDelay API functions
  - Proxy/ProxyHistory TypeScript types
  - useProxiesStore volatile store (data, delay cache, UI state, actions)
  - Settings store extended with proxies page preferences (grid, density, sort, typeStyle, showAutoInfo)
  - formatDelay utility
  - Toaster (sonner) in App.tsx for toast notifications
  - shadcn/ui components: sonner, popover, scroll-area, collapsible
affects: [03-proxies-page]

# Tech tracking
tech-stack:
  added: [sonner]
  patterns: [volatile-zustand-store, delay-cache-ttl, optimistic-update-with-rollback, sequential-group-testing]

key-files:
  created:
    - src/stores/proxies.ts
    - src/components/ui/sonner.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/scroll-area.tsx
    - src/components/ui/collapsible.tsx
  modified:
    - src/lib/mihomo-api.ts
    - src/lib/format.ts
    - src/stores/settings.ts
    - src/App.tsx

key-decisions:
  - "Sonner component fixed to use hardcoded dark theme instead of next-themes (not available in Vite project)"
  - "Proxies store is volatile (no persist) -- proxy data is real-time, not session-persistent"
  - "Delay cache TTL 15 seconds to prevent router overload on repeated expand/collapse"
  - "testAllGroups runs sequentially (for..of) to avoid overloading router with concurrent requests"
  - "Optimistic proxy switching with rollback on API error"

patterns-established:
  - "Volatile Zustand store pattern: Set<string> for UI state tracking (expandedGroups, testingGroups, testingProxies)"
  - "Delay cache with TTL: { delay, testedAt } records with Date.now() comparison"
  - "Optimistic update with rollback: update state immediately, revert on catch"
  - "Toast notifications via sonner: toast.success/toast.error in store actions"

requirements-completed: [PROX-01, PROX-02, PROX-03]

# Metrics
duration: 4min
completed: 2026-02-27
---

# Phase 03 Plan 01: Proxies Infrastructure Summary

**Proxy API client (4 endpoints), volatile proxies store with delay cache, settings extension for proxies page, sonner/popover/scroll-area/collapsible components, Toaster in App.tsx**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-27T02:12:03Z
- **Completed:** 2026-02-27T02:16:19Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Proxy API client with fetchProxies, selectProxy, fetchProxyDelay, fetchGroupDelay (all with proper URL encoding)
- Volatile proxies store with complete action set: fetch, expand, select (optimistic), delay test (cached 15s), group test, test all (sequential)
- Settings store extended with 5 persisted proxies page preferences (grid columns, density, sort, type style, show auto info)
- 4 shadcn/ui components installed (sonner, popover, scroll-area, collapsible) and Toaster integrated in App.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: shadcn/ui + Toaster + API client + formatDelay** - `ba2d407` (feat)
2. **Task 2: Proxies store + Settings store extension** - `06178cb` (feat)

## Files Created/Modified
- `src/components/ui/sonner.tsx` - Toaster component (fixed for Vite, no next-themes)
- `src/components/ui/popover.tsx` - Popover for settings panel
- `src/components/ui/scroll-area.tsx` - Styled scroll area for proxy lists
- `src/components/ui/collapsible.tsx` - Collapsible for card expand/collapse
- `src/lib/mihomo-api.ts` - Extended with 4 proxy API functions + Proxy/ProxyHistory types
- `src/lib/format.ts` - Added formatDelay utility
- `src/stores/proxies.ts` - New volatile store for proxy data, delay cache, UI state
- `src/stores/settings.ts` - Extended with 5 proxies page settings + 5 setters
- `src/App.tsx` - Added Toaster component inside BrowserRouter
- `package.json` - sonner dependency added
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Sonner component uses hardcoded `theme="dark"` instead of `next-themes` useTheme hook -- project is Vite + React, not Next.js
- Proxies store is volatile (no zustand persist) -- proxy data is fetched fresh on page visit
- Delay cache TTL is 15 seconds as specified in context decisions
- testAllGroups uses sequential execution (for..of, not Promise.all) to avoid router overload
- Optimistic update pattern for proxy switching: instant UI feedback, rollback on API error

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed sonner component next-themes dependency**
- **Found during:** Task 1 (shadcn/ui installation)
- **Issue:** shadcn/ui generates sonner.tsx with `import { useTheme } from "next-themes"` which is Next.js-specific; project uses Vite + React
- **Fix:** Removed next-themes import, hardcoded `theme="dark"` instead of dynamic theme detection
- **Files modified:** src/components/ui/sonner.tsx
- **Verification:** `npx tsc --noEmit` passes, `npm run build` succeeds
- **Committed in:** ba2d407 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary fix for project compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All data-layer and UI primitives ready for Plan 02 (proxies page components)
- API client exports: fetchProxies, selectProxy, fetchProxyDelay, fetchGroupDelay
- Proxies store exports: useProxiesStore with full action set
- Settings store has all proxies page preferences persisted
- Toaster is rendering in App.tsx for toast notifications
- shadcn/ui popover, scroll-area, collapsible ready for UI composition

## Self-Check: PASSED

All 10 files verified present. Both commit hashes (ba2d407, 06178cb) found in git log.

---
*Phase: 03-proxies-page*
*Completed: 2026-02-27*
