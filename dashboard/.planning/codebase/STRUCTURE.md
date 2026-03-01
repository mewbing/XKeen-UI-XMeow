# Codebase Structure

**Analysis Date:** 2026-03-01

## Directory Layout

```
dashboard/
├── backend/
│   └── server.py              # Flask backend (runs on router)
├── config/                    # Local dev config files
├── public/                    # Static assets (vite.svg)
├── src/
│   ├── components/
│   │   ├── config-editor/     # Monaco editor page components
│   │   ├── connections/       # Active connections tab components
│   │   ├── layout/            # App shell: sidebar, header, layout
│   │   ├── logs/              # Log viewer tab components
│   │   ├── overview/          # Dashboard overview cards & charts
│   │   ├── proxies/           # Proxy groups & nodes components
│   │   ├── rules/             # Visual rules editor components
│   │   ├── shared/            # Cross-feature shared components
│   │   ├── ui/                # shadcn/ui design system primitives
│   │   └── wizard/            # Initial setup wizard steps
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # API clients, utilities, parsers
│   ├── pages/                 # Route-level page components
│   └── stores/                # Zustand state management stores
│   ├── main.tsx               # React root mount
│   ├── App.tsx                # Route definitions, wizard gate
│   ├── index.css              # Tailwind config, oklch theme vars
│   └── vite-env.d.ts          # Vite type declarations
├── index.html                 # HTML entry with inline theme script
├── package.json               # Dependencies and scripts
├── pnpm-lock.yaml             # Lockfile
├── pnpm-workspace.yaml        # PNPM workspace config
├── vite.config.ts             # Vite config with proxy rules
├── tsconfig.json              # Root TS config
├── tsconfig.app.json          # App TS config (strict, @/* alias)
├── tsconfig.node.json         # Node TS config (for vite.config)
└── components.json            # shadcn/ui configuration
```

## Directory Purposes

**`src/pages/`:**
- Purpose: One file per route, serves as the orchestration layer
- Contains: Page components that fetch data, subscribe to WS streams, compose feature components
- Key files:
  - `OverviewPage.tsx`: Dashboard with metrics, charts, network info, topology
  - `ProxiesPage.tsx`: Proxy group cards with masonry layout
  - `ConnectionsLogsPage.tsx`: Split-view connections + logs with WS streams
  - `ConfigEditorPage.tsx`: Monaco editor with resizable panels
  - `RulesPage.tsx`: Visual rules editor with DnD blocks
  - `SettingsPage.tsx`: Settings sheet (exported as `SettingsSheet` component, not a standalone page)
  - `GroupsPage.tsx`, `ProvidersPage.tsx`, `GeodataPage.tsx`, `UpdatesPage.tsx`: Placeholder pages (not yet implemented)
  - `PlaceholderPage.tsx`: Generic placeholder template used by unimplemented pages

**`src/stores/`:**
- Purpose: All application state lives here (Zustand stores)
- Contains: Typed store definitions with state, actions, and computed selectors
- Key files:
  - `settings.ts`: Persisted user preferences (theme, layout, API URLs, display options)
  - `overview.ts`: Volatile real-time metrics (traffic, memory, CPU, connections history)
  - `proxies.ts`: Proxy data, delay cache, expanded groups, testing state
  - `connections.ts`: Live connections with speed calculation from snapshot deltas
  - `logs.ts`: Mihomo structured log entries with ring buffer
  - `config-editor.ts`: Multi-tab editor state (4 tabs: config + 3 xkeen files), dirty tracking
  - `rules-editor.ts`: Rules blocks with undo/redo (zundo temporal middleware)

**`src/hooks/`:**
- Purpose: Reusable React hooks for data fetching, WebSocket, and UI concerns
- Contains: Custom hooks that bridge stores and browser APIs
- Key files:
  - `use-mihomo-ws.ts`: Generic WebSocket hook for mihomo streaming endpoints
  - `useLogWebSocket.ts`: WebSocket hook for Flask log streaming with bidirectional protocol
  - `use-service-status.ts`: Polling hook for xkeen service running state
  - `useHealthCheck.ts`: API availability checker with sessionStorage caching
  - `use-theme.ts`: Resolved theme hook + Monaco theme registration
  - `use-mobile.ts`: Mobile viewport detection
  - `useMediaQuery.ts`: Generic media query hook

**`src/lib/`:**
- Purpose: Pure utility functions and typed API clients
- Contains: No React dependencies (except store imports for URL/auth)
- Key files:
  - `mihomo-api.ts`: REST client for mihomo core (proxies, connections, config, upgrade)
  - `config-api.ts`: REST client for Flask backend (service control, config I/O, system metrics, xkeen files, logs)
  - `api.ts`: Connection testing utilities (used by wizard and health checks)
  - `rules-parser.ts`: YAML rules parser/serializer with comment preservation
  - `format.ts`: Pure formatters (bytes, speed, uptime, delay)
  - `flags.ts`: Country flag extraction from proxy names
  - `utils.ts`: `cn()` utility (clsx + tailwind-merge)

**`src/components/ui/`:**
- Purpose: shadcn/ui design system primitives
- Contains: Radix-based components customized for the Antigravity theme
- Key files: `button.tsx`, `card.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`, `sheet.tsx`, `sidebar.tsx`, `tabs.tsx`, `popover.tsx`, `dropdown-menu.tsx`, `toggle.tsx`, `toggle-group.tsx`, `badge.tsx`, `separator.tsx`, `tooltip.tsx`, `skeleton.tsx`, `scroll-area.tsx`, `collapsible.tsx`, `alert-dialog.tsx`, `resizable.tsx`, `sonner.tsx`, `switch.tsx`, `scroll-text.tsx`, `split-toggle-button.tsx`, `label.tsx`, `radio-group.tsx`

**`src/components/layout/`:**
- Purpose: App shell structure
- Contains: Layout wrapper, sidebar navigation, header with actions
- Key files:
  - `AppLayout.tsx`: SidebarProvider + Header + Outlet, auto-collapse on narrow viewports, page transition animation
  - `AppSidebar.tsx`: Navigation menu (10 items), version info footer, update overlay trigger
  - `Header.tsx`: Page title, split-view toggle (connections/logs only), service control, settings button

**`src/components/overview/`:**
- Purpose: Dashboard overview page components
- Key files: `MetricsCards.tsx`, `TrafficChart.tsx`, `ServiceControl.tsx`, `NetworkInfo.tsx`, `ConnectionStats.tsx`, `ConnectionTopology.tsx`, `DnsStats.tsx`, `TopDomains.tsx`, `QuickActions.tsx`, `UpdateOverlay.tsx`

**`src/components/proxies/`:**
- Purpose: Proxy management UI
- Key files: `ProxyGroupCard.tsx`, `ProxyNodeItem.tsx`, `ProxiesToolbar.tsx`, `ProxiesSettingsPopover.tsx`, `ProxyLatencyBadge.tsx`, `ProxyFlag.tsx`

**`src/components/connections/`:**
- Purpose: Active connections table and detail views
- Key files: `ConnectionsTab.tsx`, `ConnectionsTable.tsx`, `ConnectionRow.tsx`, `ConnectionDetail.tsx`, `ConnectionsToolbar.tsx`, `ColumnSelector.tsx`

**`src/components/logs/`:**
- Purpose: Log streaming viewer
- Key files: `LogsTab.tsx`, `LogStream.tsx`, `LogCard.tsx`, `LogsToolbar.tsx`

**`src/components/config-editor/`:**
- Purpose: Monaco-based config file editor
- Key files: `ConfigEditor.tsx`, `EditorToolbar.tsx`, `EditorLogPanel.tsx`, `DiffPreview.tsx`, `ApplyConfirmDialog.tsx`, `TabSwitchDialog.tsx`

**`src/components/rules/`:**
- Purpose: Visual rules editor with drag-and-drop
- Key files: `RuleBlockList.tsx`, `RuleRow.tsx`, `RulesToolbar.tsx`, `AddRuleDialog.tsx`, `RulesDiffPreview.tsx`

**`src/components/wizard/`:**
- Purpose: Initial setup wizard (shown before first use)
- Key files: `SetupWizard.tsx`, `StepSelectType.tsx`, `StepTestConnection.tsx`, `StepSuccess.tsx`

**`src/components/shared/`:**
- Purpose: Components used across multiple feature areas
- Key files: `SetupGuide.tsx` (API unavailability instructions with setup steps)

**`backend/`:**
- Purpose: Flask server for router management (runs on Keenetic router hardware)
- Contains: Single-file Flask app with REST routes and WebSocket log streaming
- Key file: `server.py` (health, service control, config I/O, xkeen files, system metrics, log streaming)

## Key File Locations

**Entry Points:**
- `index.html`: HTML shell with inline theme script (prevents FOUC)
- `src/main.tsx`: React 19 root mount in StrictMode
- `src/App.tsx`: Routing, wizard gate, theme sync, location tracking

**Configuration:**
- `vite.config.ts`: Build config, `@/` path alias, dev proxy rules (Flask on :5000, mihomo on :9090)
- `tsconfig.app.json`: Strict TypeScript with `@/*` path alias
- `components.json`: shadcn/ui config (new-york style, lucide icons)
- `src/index.css`: Tailwind v4 imports, oklch color theme variables (light + dark)
- `package.json`: Dependencies, build scripts (`dev`, `build`, `lint`, `preview`)

**Core Logic:**
- `src/lib/mihomo-api.ts`: All mihomo REST API calls
- `src/lib/config-api.ts`: All Flask backend API calls
- `src/lib/rules-parser.ts`: YAML rules parsing/serialization engine
- `src/stores/settings.ts`: Persisted settings (the only persisted store)
- `src/stores/rules-editor.ts`: Rules editor with undo/redo (most complex store)

**Testing:**
- No test files exist in the codebase. No test framework configured.

## Naming Conventions

**Files:**
- Pages: `PascalCase.tsx` (e.g., `OverviewPage.tsx`, `ProxiesPage.tsx`)
- Components: `PascalCase.tsx` (e.g., `ProxyGroupCard.tsx`, `MetricsCards.tsx`)
- UI primitives: `kebab-case.tsx` (shadcn convention, e.g., `button.tsx`, `scroll-area.tsx`)
- Hooks: `use-kebab-case.ts` or `useCamelCase.ts` (mixed, see note below)
- Stores: `kebab-case.ts` (e.g., `rules-editor.ts`, `config-editor.ts`)
- Lib utilities: `kebab-case.ts` (e.g., `mihomo-api.ts`, `rules-parser.ts`)

**Hook naming inconsistency:** The codebase has two conventions:
- Older hooks: `use-kebab-case.ts` (e.g., `use-mihomo-ws.ts`, `use-theme.ts`, `use-mobile.ts`)
- Newer hooks: `useCamelCase.ts` (e.g., `useHealthCheck.ts`, `useLogWebSocket.ts`, `useMediaQuery.ts`)
- **For new hooks, use `useCamelCase.ts`** (this is the more recent pattern)

**Directories:**
- Feature groups: `kebab-case` (e.g., `config-editor/`, `scroll-area/`)
- Single-word: lowercase (e.g., `layout/`, `hooks/`, `stores/`)

**Exports:**
- Components: named exports (e.g., `export function ProxyGroupCard()`)
- Pages: default exports (e.g., `export default function OverviewPage()`)
- Stores: named exports of hooks (e.g., `export const useSettingsStore = create(...)`)
- UI primitives: named exports (shadcn pattern)

## Where to Add New Code

**New Page:**
1. Create page component: `src/pages/{Name}Page.tsx` (default export)
2. Add route in `src/App.tsx` inside the `<Route element={<AppLayout />}>` block
3. Add sidebar menu item in `src/components/layout/AppSidebar.tsx` (`mainMenuItems` array)
4. Add page title in `src/components/layout/Header.tsx` (`pageTitles` record)
5. If page needs API data, add health check: `const health = useHealthCheck({ requireMihomo: true })`

**New Feature Component:**
- Place in `src/components/{feature-name}/` directory
- Use named export: `export function ComponentName()`
- Import UI primitives from `@/components/ui/`
- Read state via store hooks: `const value = useXxxStore((s) => s.field)`

**New Store:**
- Create at `src/stores/{name}.ts`
- Use `create<StateType>()(...)` pattern from Zustand
- For persisted stores, wrap with `persist()` middleware
- For undo/redo, wrap with `temporal()` from zundo
- Export as `export const useXxxStore = create<...>()(...)`

**New Hook:**
- Create at `src/hooks/use{Name}.ts`
- Export as named: `export function use{Name}(): ReturnType`
- For WebSocket hooks, follow `useMihomoWs` pattern (ref-based callbacks, auto-reconnect)
- For polling hooks, follow `useServiceStatus` pattern (useEffect + setInterval)

**New API Client Function:**
- Add to `src/lib/mihomo-api.ts` for mihomo core endpoints
- Add to `src/lib/config-api.ts` for Flask backend endpoints
- Follow existing pattern: `getBaseUrl()` + `getHeaders()` + `AbortSignal.timeout()`
- Always return typed Promise, throw Error on non-ok responses

**New UI Primitive:**
- Use `npx shadcn add {component}` to add shadcn components
- Or create custom in `src/components/ui/{name}.tsx`

**New Utility:**
- Add to `src/lib/format.ts` for formatting functions
- Add to `src/lib/flags.ts` for proxy name utilities
- Create new file at `src/lib/{name}.ts` for distinct utility domains

## Special Directories

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (pnpm install)
- Committed: No (.gitignore)

**`dist/`:**
- Purpose: Production build output
- Generated: Yes (vite build)
- Committed: No (.gitignore)

**`.planning/`:**
- Purpose: Project planning documents, phase summaries, codebase analysis
- Generated: No (manually maintained)
- Committed: Yes

**`config/`:**
- Purpose: Local development configuration files
- Generated: No
- Committed: Untracked

**`backend/`:**
- Purpose: Flask server deployed on router
- Generated: No
- Committed: Yes (single server.py file)

**`public/`:**
- Purpose: Static assets served by Vite
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-01*
