# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Users can visually edit mihomo configuration without manually editing YAML files
**Current focus:** Phase 5 -- Config Raw Editor

## Current Position

Phase: 5 of 11 (Config Raw Editor)
Plan: 3 of 3 in current phase (PHASE COMPLETE)
Status: Phase 05 complete -- config raw editor fully functional
Last activity: 2026-02-28 -- Plan 05-03 executed

Progress: [██████████] 56% (31/55 requirements)

## Performance Metrics

**Velocity:**
- Total plans completed: 17
- Average duration: 4 min
- Total execution time: 0.96 hours

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | 9min | 2 | 16 |
| 01 | 02 | 5min | 2 | 27 |
| 01 | 03 | 3min | 1 | 1 |
| 01 | 04 | 4min | 2 | 8 |
| 02 | 01 | 3min | 2 | 11 |
| 02 | 02 | 4min | 2 | 5 |
| 02 | 03 | 6min | 2 | 5 |
| 02 | 04 | 3min | 2 | 4 |
| 02 | 05 | 2min | 2 | 3 |
| 03 | 01 | 4min | 2 | 11 |
| 03 | 02 | 3min | 2 | 6 |
| 04 | 01 | 5min | 2 | 8 |
| 04 | 02 | 8min | 2 | 6 |
| 04 | 03 | 15min | 2 | 4 |
| 05 | 01 | 3min | 2 | 5 |
| 05 | 02 | 4min | 2 | 5 |
| 05 | 03 | 4min | 2 | 4 |

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
- ServiceControl is self-contained (uses useServiceStatus + serviceAction internally, no required props)
- Stop/Restart require AlertDialog confirmation; Start does not (non-destructive)
- VersionLine adds 'v' prefix if missing, shows '--' when version not loaded
- Version info hidden in sidebar collapsed (icon) mode
- Sonner component uses hardcoded dark theme instead of next-themes (Vite project, not Next.js)
- Proxies store is volatile (no persist) -- proxy data fetched fresh on page visit
- Delay cache TTL 15 seconds to prevent router overload
- testAllGroups runs sequentially to avoid concurrent request overload
- Optimistic proxy switching with rollback on API error
- ProxyGroupCard receives settings as props from ProxiesPage, not reading settings store directly
- Toggle component used for auto-info on/off instead of checkbox (no checkbox component installed)
- Expanded card gets col-span-full to occupy full grid width
- Pre-existing TS errors from Phase 03 do not block Phase 02 gap closure plans (out of scope)
- [Phase 02]: Removed key={location.pathname} from AppLayout -- page-enter animation not worth losing component state on remount
- [Phase 02]: Tailwind v4 color pattern: use var(--color) directly, never wrap in hsl() -- CSS vars contain complete oklch() values
- [Phase 02]: Zustand guard pattern: setStartTime only sets if null to prevent overwrite on remount
- [Phase 04]: Fixed pre-existing TS errors from Phase 03 (unused cn imports, missing isDelayCacheValid) that blocked tsc -b build
- [Phase 05]: Config editor store is volatile (no persist) -- content loaded fresh on page visit
- [Phase 05]: Log ring buffer max 500 entries for apply-time streaming (separate from logs page 1000 limit)
- [Phase 05]: monaco-editor added as dev dependency for TypeScript types (CDN loads at runtime)
- [Phase 05]: Format shows warning toast before applying (comment loss) rather than confirmation dialog
- [Phase 05]: useRef for onSave callback to avoid stale closures in Monaco addCommand
- [Phase 05]: Zustand-driven WS lifecycle: EditorLogPanel subscribes to logStreaming flag for connect/disconnect
- [Phase 05]: react-resizable-panels v4 uses orientation prop (not direction) and PanelSize object (not number)

### Pending Todos

- None

### Blockers/Concerns

None currently.

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 05-03-PLAN.md (Phase 05 complete -- Config Raw Editor)
Resume file: .planning/phases/05-config-raw-editor/05-03-SUMMARY.md
