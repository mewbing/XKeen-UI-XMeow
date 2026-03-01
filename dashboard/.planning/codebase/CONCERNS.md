# Codebase Concerns

**Analysis Date:** 2026-03-01

## Tech Debt

**Duplicate YAML libraries:**
- Issue: Two separate YAML libraries used for different purposes -- `yaml` (eemeli/yaml v2) for rules parser (comment-preserving round-trip), and `js-yaml` for config editor validation.
- Files: `src/lib/rules-parser.ts` (uses `yaml`), `src/components/config-editor/ConfigEditor.tsx` (uses `js-yaml`), `src/components/config-editor/EditorToolbar.tsx` (uses `js-yaml`)
- Impact: ~60KB extra bundle size. Two different YAML parsing behaviors may produce subtly different validation results.
- Fix approach: Evaluate whether `yaml` (eemeli) can replace `js-yaml` for validation in ConfigEditor. The `yaml` package already supports streaming and error reporting with line/column info.

**Placeholder pages (4 stub routes):**
- Issue: Four pages are routed but render only a `PlaceholderPage` stub: Groups (phase 7), Providers (phase 8), Geodata (phase 9), Updates (phase 10).
- Files: `src/pages/GroupsPage.tsx`, `src/pages/ProvidersPage.tsx`, `src/pages/GeodataPage.tsx`, `src/pages/UpdatesPage.tsx`, `src/pages/PlaceholderPage.tsx`
- Impact: Dead navigation items visible to users. Settings page lists these as start-page options in `src/pages/SettingsPage.tsx` (lines 31-36). No functional benefit until implemented.
- Fix approach: Hide or badge unimplemented pages in sidebar/settings. Implement in priority order.

**Module-level mutable state in rules-editor store:**
- Issue: Four module-level `let` variables (`storedDoc`, `originalRuleRaws`, `skipTemporalSave`, `temporalTimer`) live outside Zustand state to work around zundo serialization limits.
- Files: `src/stores/rules-editor.ts` (lines 24-33)
- Impact: These survive component unmount/remount but can get stale if the page is never revisited. Not testable in isolation. The `skipTemporalSave` flag is a fragile guard -- any missed reset causes silent undo/redo corruption.
- Fix approach: Acceptable short-term tradeoff given zundo's design constraints. Add integration tests to verify undo/redo correctness through flag transitions.

**Legacy settings cleanup in persist merge:**
- Issue: Three stale property names (`rulesGrouping`, `rulesLayout`, `rulesNewBlockMode`) are manually deleted during hydration merge via `as any` casts.
- Files: `src/stores/settings.ts` (lines 157-163)
- Impact: Minor -- will exist in localStorage of early adopters. The `as any` casts bypass TypeScript safety.
- Fix approach: Add a version field to settings store. Run migrations by version number instead of ad-hoc deletions.

**`nul` file committed to repo:**
- Issue: A file named `nul` (118 bytes) exists at project root -- likely an accidental Windows NUL device redirect artifact.
- Files: `nul` (project root)
- Impact: Confusing artifact. May cause issues on Windows where `nul` is a reserved device name.
- Fix approach: Delete the file and add `nul` to `.gitignore`.

## Known Bugs

**eslint-disable comments suppress legitimate warnings:**
- Symptoms: Four `eslint-disable` or `eslint-disable-line` comments suppress `react-hooks/exhaustive-deps` warnings in places where the dep arrays are intentionally incomplete.
- Files: `src/components/config-editor/ConfigEditor.tsx` (line 172), `src/pages/RulesPage.tsx` (line 49), `src/components/overview/NetworkInfo.tsx` (line 225), `src/components/config-editor/EditorLogPanel.tsx` (line 32, line 72)
- Trigger: The suppressed deps mean effects don't re-run when certain values change. For example, `RulesPage` line 49 depends on `health.loading` and `health.configApiOk` but not `loadRules` -- if `loadRules` identity changes without health changing, rules won't reload.
- Workaround: Current behavior is intentional (avoid re-fetching), but the approach is fragile.

## Security Considerations

**Backend CORS: wide-open, no authentication:**
- Risk: `CORS(app)` with no arguments allows all origins. Combined with zero authentication on any endpoint, any website can make requests to the Flask backend when the user's browser is on the same network.
- Files: `backend/server.py` (line 23)
- Current mitigation: Backend runs on a private LAN (Keenetic router). No public exposure expected.
- Recommendations: Add origin whitelisting. Consider a simple shared-secret header for write operations (PUT, POST, DELETE). At minimum, restrict CORS to the dashboard's origin.

**Backend `shell=True` in subprocess call:**
- Risk: `subprocess.Popen(cmd, shell=True, ...)` for service actions. The `action` parameter is validated against a whitelist (`start`, `stop`, `restart`), so direct injection is blocked. However, `shell=True` is a code smell.
- Files: `backend/server.py` (line 126)
- Current mitigation: Whitelist check at line 114 (`if action not in ('start', 'stop', 'restart')`).
- Recommendations: Replace with `subprocess.Popen(['xkeen', f'-{action}'], shell=False, ...)` for defense-in-depth.

**Vite proxy config contains hardcoded auth token:**
- Risk: The dev proxy config includes `'Authorization': 'Bearer admin'` as a hardcoded header.
- Files: `vite.config.ts` (lines 53-56)
- Current mitigation: Only used in development mode. Not shipped in production builds.
- Recommendations: Move to an environment variable or `.env.development` file.

**Mihomo secret stored in localStorage (settings store):**
- Risk: `mihomoSecret` is persisted to localStorage via zustand persist middleware. Any XSS vulnerability could exfiltrate it.
- Files: `src/stores/settings.ts` (line 9, persisted via `mihomo-dashboard-settings` key)
- Current mitigation: Single-user dashboard on private LAN.
- Recommendations: For broader deployment, consider sessionStorage or in-memory only for secrets.

**Backend backup files accumulate without cleanup:**
- Risk: Every PUT to `/api/config` or `/api/xkeen/<file>` creates a timestamped backup. No rotation or cleanup mechanism exists.
- Files: `backend/server.py` (lines 58-74, `_create_backup` function)
- Current mitigation: None. Disk space on Keenetic router is limited.
- Recommendations: Add backup rotation (keep last N backups per file) or max-age cleanup.

## Performance Bottlenecks

**Overview page polling creates constant GC pressure:**
- Problem: Two `setInterval` polling loops every 2 seconds (`fetchConnectionsSnapshot` + `fetchCpuUsage`), each creating new arrays and objects that immediately become garbage.
- Files: `src/pages/OverviewPage.tsx` (lines 77-92)
- Cause: `fetchConnectionsSnapshot` returns a full connections array on every tick. `updateConnections` and `setConnections` create new state objects each time.
- Improvement path: Use WebSocket for connections data (mihomo already provides `/connections` WS endpoint). Move CPU polling to a longer interval or backend-side push.

**ConnectionTopology Sankey diagram recomputes on every connections change:**
- Problem: `buildSankeyData()` processes all connections on every 2-second poll update. For 200+ connections, this involves multiple Map aggregations and sorts.
- Files: `src/components/overview/ConnectionTopology.tsx` (lines 160-351, `buildSankeyData`)
- Cause: `useMemo` depends on `connections` array, which changes identity every 2 seconds from polling.
- Improvement path: Debounce or throttle Sankey recomputation. Consider only recomputing when connection count changes significantly (>5% delta).

**Connections store `filteredConnections()` is a method, not a selector:**
- Problem: `filteredConnections` is called as a method (`get().filteredConnections()`), which means it reruns the filter on every call without memoization. Every component calling this gets a fresh filter pass.
- Files: `src/stores/connections.ts` (lines 90-124)
- Cause: Zustand methods don't have built-in memoization. The function closes over `get()` so it always reads latest state.
- Improvement path: Use `useMemo` in consuming components, or compute filtered connections as derived state using a selector with shallow equality.

**Log store creates new array on every entry:**
- Problem: `addEntry` spreads the entire entries array on every new log line: `[...state.entries, entry]`. With 1000 entries and frequent log messages, this is O(n) allocation per message.
- Files: `src/stores/logs.ts` (lines 74-101)
- Cause: Immutable state pattern with array spread.
- Improvement path: Use a ring buffer with fixed-size array and index pointer. Only copy on read (snapshot) rather than on every write.

## Fragile Areas

**Rules editor undo/redo timing:**
- Files: `src/stores/rules-editor.ts` (lines 29-33, 356-397, 434-443)
- Why fragile: The `skipTemporalSave` flag and debounced `temporalTimer` interact across multiple async flows (loadRules, syncAfterUndoRedo, resetChanges). A race condition between the 400ms debounce timer and a rapid undo/redo could push stale state. The cancel-before-undo pattern (lines 357-361) was added specifically to fix such a race.
- Safe modification: Never add `set()` calls inside the temporal middleware's tracked actions without wrapping in `skipTemporalSave = true/false`. Always cancel `temporalTimer` before any undo/redo call.
- Test coverage: Zero automated tests.

**Cross-block drag-and-drop in RuleBlockList:**
- Files: `src/components/rules/RuleBlockList.tsx` (lines 75-96, 231-332)
- Why fragile: Custom collision detection (`typedCollisionDetection`) filters droppable containers by data type. The `handleDragEnd` handler has a complex two-branch flow (same-block reorder vs. cross-block move) with direct store mutations. Drop indicator state uses both refs and React state (`dropTargetRef` + `dropTarget`) to prevent re-render storms.
- Safe modification: Test drag flows manually after any change. The ref-based guard (line 267) prevents setState spam but means state and ref can diverge if the guard logic has a bug.
- Test coverage: Zero automated tests.

**WebSocket reconnection loops:**
- Files: `src/hooks/use-mihomo-ws.ts` (lines 55-62), `src/hooks/useLogWebSocket.ts` (lines 115-125)
- Why fragile: Both hooks have auto-reconnect on close. If the server is unreachable, `use-mihomo-ws` retries every 3 seconds indefinitely, and `useLogWebSocket` retries every 1 second. No exponential backoff, no max-retry limit.
- Safe modification: Add exponential backoff with a cap (e.g., 3s -> 6s -> 12s -> 30s max). Add a max-retries counter and surface connection state to the UI.
- Test coverage: Zero automated tests.

**Config editor tab content loading:**
- Files: `src/components/config-editor/ConfigEditor.tsx` (lines 48-76)
- Why fragile: `loadedTabsRef` tracks which tabs have been fetched. If the server returns stale content after a save, the ref prevents re-fetching. There's no invalidation mechanism -- once a tab is marked loaded, it never re-fetches until the component remounts.
- Safe modification: Add a `forceReload(tabId)` method that clears the ref and re-fetches. Call it after save operations.
- Test coverage: Zero automated tests.

## Scaling Limits

**Log buffer ring buffer is O(n) per write:**
- Current capacity: 1000 entries default, configurable up to 10,000.
- Limit: At 10,000 entries with rapid log output, each `addEntry` call allocates a new 10,000-element array.
- Scaling path: Implement a true ring buffer (fixed array + head/tail index). Only materialize the sorted array when rendering.

**Overview page connection polling:**
- Current capacity: Works well with <200 active connections.
- Limit: With 500+ connections, the 2-second full-snapshot poll creates significant JSON parsing and object allocation overhead.
- Scaling path: Use mihomo's WebSocket `/connections` endpoint with interval parameter. Process deltas rather than full snapshots.

**Backup directory grows unbounded:**
- Current capacity: ~100 backups before noticeable impact.
- Limit: Router filesystem is typically 256MB-1GB. Each YAML config backup is ~10-50KB.
- Scaling path: Add backup rotation in `_create_backup()`: keep last 10 per file type.

## Dependencies at Risk

**`@dnd-kit` package ecosystem:**
- Risk: Project uses multiple `@dnd-kit` packages across different major versions (`@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^10.0.0, `@dnd-kit/modifiers` ^9.0.0, `@dnd-kit/utilities` ^3.2.2). Version skew between packages can cause subtle behavioral differences.
- Impact: dnd-kit has shifted focus to a new architecture. Cross-package version mismatches may cause type incompatibilities or runtime issues during updates.
- Migration plan: Pin all dnd-kit packages to compatible versions. When upgrading, upgrade all together. Monitor for dnd-kit v2 (unified package) release.

**`recharts` v3 (major version):**
- Risk: recharts 3.x is relatively new. The Sankey component used in `ConnectionTopology` has quirky typing (passing props via spread to custom node/link components).
- Impact: Custom SankeyNode component relies on undocumented prop injection (`x`, `y`, `width`, `height`, `payload`).
- Files: `src/components/overview/ConnectionTopology.tsx` (lines 25-94, 421-430)
- Migration plan: Pin recharts version. Wrap Sankey usage in a facade component to isolate from API changes.

**`next-themes` used outside Next.js:**
- Risk: `next-themes` is designed for Next.js. The dashboard uses React Router, not Next.js.
- Files: `package.json` (dependency), but the codebase appears to use a custom `src/hooks/use-theme.ts` instead.
- Impact: Unused dependency adding to bundle. May conflict with custom theme implementation.
- Migration plan: Verify if `next-themes` is actually imported anywhere. If not, remove it from `package.json`.

## Missing Critical Features

**Zero automated tests:**
- Problem: No test files exist in `src/`. No test framework configured (no jest, vitest, or playwright config). No test scripts in `package.json` (only `dev`, `build`, `lint`, `preview`).
- Blocks: Cannot safely refactor rules editor, stores, or parser logic. Every change requires manual testing.

**No error boundaries:**
- Problem: No React ErrorBoundary components anywhere in the app. A runtime error in any component crashes the entire dashboard.
- Files: `src/App.tsx` -- no ErrorBoundary wrapping routes.
- Blocks: A single bad connection data payload or recharts rendering error takes down the whole UI.

**No code splitting / lazy loading:**
- Problem: All pages are eagerly imported in `src/App.tsx`. Monaco Editor is loaded on app start even if the user never visits the config editor page.
- Files: `src/App.tsx` (lines 7-16, all direct imports)
- Blocks: Initial bundle is larger than necessary. Monaco Editor alone is ~2MB.

**No backend authentication:**
- Problem: Flask backend has zero authentication. Any device on the LAN can execute service actions, read/write config files, and read logs.
- Blocks: Unsafe for multi-user or semi-public networks.

## Test Coverage Gaps

**Entire codebase is untested:**
- What's not tested: Everything -- stores (5 stores), hooks (5 hooks), lib utilities (4 modules), parser logic, API clients, all 10+ pages and 30+ components.
- Files: All files in `src/`
- Risk: Rules parser (`src/lib/rules-parser.ts`) handles complex compound rule syntax (AND/OR/NOT with balanced parens) that is easy to break. Store mutations in `src/stores/rules-editor.ts` involve subtle timing with undo/redo that manual testing cannot reliably cover. Format utilities in `src/lib/format.ts` handle byte formatting and delay display.
- Priority: High. Start with unit tests for:
  1. `src/lib/rules-parser.ts` -- parseRuleString, groupBySections, serializeRulesToConfig
  2. `src/stores/rules-editor.ts` -- mutation operations, dirty detection, undo/redo flow
  3. `src/lib/format.ts` -- formatBytes, formatDelay
  4. `src/hooks/use-mihomo-ws.ts` -- reconnection behavior

---

*Concerns audit: 2026-03-01*
