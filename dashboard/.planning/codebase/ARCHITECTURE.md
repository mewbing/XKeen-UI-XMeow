# Architecture

**Analysis Date:** 2026-03-01

## Pattern Overview

**Overall:** Client-side SPA with external API gateway pattern

The dashboard is a React 19 SPA that communicates with two separate backend services via HTTP REST and WebSocket. No server-side rendering. The Flask backend (`backend/server.py`) acts as a management API for the router system, while the mihomo proxy core exposes its own REST+WS API directly.

**Key Characteristics:**
- Two separate API backends: mihomo core (port 9090) and Flask Config API (port 5000)
- Zustand stores as the single source of truth for all state (no React Context)
- WebSocket streaming for real-time data (traffic, memory, connections, logs)
- Setup wizard gate before main app access
- Health check pattern on every page to gracefully handle API unavailability
- All UI text in Russian

## Layers

**Entry / Bootstrap:**
- Purpose: Application initialization, routing, theme hydration
- Location: `src/main.tsx`, `src/App.tsx`, `index.html`
- Contains: React root mount, BrowserRouter, route definitions, wizard gate, theme sync
- Depends on: stores/settings, pages/*, components/layout/*
- Used by: Browser (direct entry)

**Pages:**
- Purpose: Top-level route components, orchestrate data loading and compose feature components
- Location: `src/pages/`
- Contains: Page-level state management, WebSocket subscriptions, keyboard shortcuts, data fetching on mount
- Depends on: stores/*, hooks/*, components/*, lib/*
- Used by: App.tsx router

**Feature Components:**
- Purpose: Domain-specific UI elements grouped by feature area
- Location: `src/components/{feature}/` (overview, proxies, connections, logs, config-editor, rules, wizard)
- Contains: Visual components, toolbar components, dialog components
- Depends on: stores/*, hooks/*, lib/*, components/ui/*
- Used by: Pages

**UI Components:**
- Purpose: Reusable design system primitives (shadcn/ui)
- Location: `src/components/ui/`
- Contains: Button, Card, Input, Select, Dialog, Sheet, Sidebar, Tabs, etc.
- Depends on: Radix UI primitives, class-variance-authority, tailwind-merge
- Used by: All feature components and pages

**Layout Components:**
- Purpose: App shell with sidebar navigation and header
- Location: `src/components/layout/`
- Contains: `AppLayout.tsx` (sidebar + header + Outlet), `AppSidebar.tsx` (navigation), `Header.tsx` (page title + actions)
- Depends on: stores/settings, stores/overview, components/ui/sidebar
- Used by: App.tsx (wraps all routes via React Router Outlet)

**Shared Components:**
- Purpose: Cross-cutting UI elements used across multiple features
- Location: `src/components/shared/`
- Contains: `SetupGuide.tsx` (displayed when API health checks fail)
- Depends on: stores/settings, components/ui/*
- Used by: Multiple pages (OverviewPage, ProxiesPage, ConnectionsLogsPage, etc.)

**Stores:**
- Purpose: Global state management via Zustand (replaces Context + useReducer)
- Location: `src/stores/`
- Contains: Typed Zustand stores with actions, computed selectors, persistence
- Depends on: lib/* (API clients)
- Used by: Pages, components, hooks

**Hooks:**
- Purpose: Reusable React hooks for WebSocket connections, polling, health checks, theme
- Location: `src/hooks/`
- Contains: WebSocket hooks, polling hooks, media query hooks, theme hooks
- Depends on: stores/settings, lib/api
- Used by: Pages, components

**API Clients (Lib):**
- Purpose: HTTP/WS communication with both backends, pure utility functions
- Location: `src/lib/`
- Contains: API clients, formatters, parsers, utilities
- Depends on: stores/settings (for base URLs and auth)
- Used by: Stores, pages, hooks

**Flask Backend:**
- Purpose: Service management API for the Keenetic router (xkeen control, config file I/O, system metrics)
- Location: `backend/server.py`
- Contains: Flask routes for service control, config read/write, log streaming, system metrics
- Depends on: Linux system tools (pidof, curl, /proc/stat), filesystem
- Used by: Frontend via HTTP and WebSocket

## Data Flow

**Real-time Metrics (Overview Page):**

1. `OverviewPage` mounts and calls `useMihomoWs('/traffic', ...)` and `useMihomoWs('/memory', ...)`
2. `useMihomoWs` hook establishes WebSocket to mihomo core (`ws://{host}:9090/traffic`)
3. On each WS message, hook calls `useOverviewStore.updateTraffic()` / `updateMemory()`
4. Store appends to rolling 60-point history arrays (ring buffer pattern)
5. Chart components (`SpeedChart`, `MemoryChart`) subscribe to specific store slices and re-render
6. CPU and connections are polled via `setInterval` every 2 seconds from Flask backend

**Connections + Logs (ConnectionsLogsPage):**

1. Page mounts two `useMihomoWs` streams simultaneously: `/connections` (1s interval) and `/logs`
2. Connection snapshots flow to `useConnectionsStore.updateSnapshot()` which calculates per-connection speed from deltas
3. Log messages flow to `useLogsStore.addEntry()` which maintains a ring buffer (configurable max)
4. Both stores expose `filteredX()` computed getters for search/filter UI
5. Split view mode displays both tabs side-by-side with optional synchronized scrolling

**Config Editing:**

1. `ConfigEditorPage` mounts, fetches config YAML from Flask: `GET /api/config`
2. Content loaded into `useConfigEditorStore` with original/current tracking for dirty detection
3. Monaco Editor renders with custom `antigravity-dark` theme
4. On Apply: optional diff preview -> save to Flask (`PUT /api/config`) -> `serviceAction('restart')`
5. Flask validates YAML, creates timestamped backup, writes file, returns success

**Rules Editing:**

1. `RulesPage` fetches full config YAML from Flask: `GET /api/config`
2. `rules-parser.ts` parses YAML using `eemeli/yaml` (comment-preserving), extracts rules
3. Rules grouped into `RuleBlock[]` by consecutive target proxy-group
4. `useRulesEditorStore` (with zundo temporal middleware) enables undo/redo
5. User edits mutate blocks; `currentYaml` marked as `STALE` (lazy serialization)
6. On Save: blocks serialized back into YAML doc, sent to Flask `PUT /api/config`

**Proxy Selection:**

1. `ProxiesPage` calls `useProxiesStore.fetchAllProxies()` on mount
2. Store fetches `GET /proxies` from mihomo, extracts groups in GLOBAL config order
3. User clicks proxy node -> optimistic update in store -> `PUT /proxies/{group}` to mihomo
4. On API error, store rolls back the optimistic update
5. Delay testing: individual via `GET /proxies/{name}/delay`, batch via `GET /group/{name}/delay`

**State Management:**
- Zustand stores with `get()`/`set()` pattern (no Redux boilerplate)
- `settings` store: persisted to localStorage via `zustand/persist`
- `rules-editor` store: uses `zundo` temporal middleware for undo/redo with 400ms debounced snapshots
- All other stores: volatile (reset on page reload), fed by real-time data

## Key Abstractions

**WebSocket Hook (`useMihomoWs`):**
- Purpose: Generic WebSocket connection to mihomo streaming endpoints
- Location: `src/hooks/use-mihomo-ws.ts`
- Pattern: Auto-reconnect on close (3s delay), ref-based callback to prevent stale closures
- Used for: `/traffic`, `/memory`, `/connections`, `/logs` streams

**Log WebSocket Hook (`useLogWebSocket`):**
- Purpose: WebSocket connection to Flask backend for log file streaming
- Location: `src/hooks/useLogWebSocket.ts`
- Pattern: Bidirectional protocol (switchFile, reload, clear commands), ping/pong keepalive, Strict Mode-safe startup delay
- Used for: Config editor log panel, log file viewers

**Health Check Hook (`useHealthCheck`):**
- Purpose: Verify API availability before rendering page content
- Location: `src/hooks/useHealthCheck.ts`
- Pattern: Checks cached in sessionStorage (30s TTL), shows `SetupGuide` on failure
- Used by: Every page that needs API access

**Rules Parser:**
- Purpose: Parse/serialize mihomo rules from/to YAML config while preserving comments
- Location: `src/lib/rules-parser.ts`
- Pattern: Uses `eemeli/yaml` Document API for comment-preserving round-trip
- Provides: `parseRulesFromConfig()`, `groupBySections()`, `serializeRulesToConfig()`, `buildRuleRaw()`

**API Client Pattern:**
- Purpose: Typed HTTP clients that read base URL and auth from settings store
- Location: `src/lib/mihomo-api.ts` (mihomo core), `src/lib/config-api.ts` (Flask backend), `src/lib/api.ts` (connection testing)
- Pattern: `getBaseUrl()` and `getHeaders()` read from `useSettingsStore.getState()` at call time; `AbortSignal.timeout()` for request timeouts

## Entry Points

**Browser Entry:**
- Location: `index.html` -> `src/main.tsx` -> `src/App.tsx`
- Triggers: Page load in browser
- Responsibilities: Mount React root in StrictMode, inline theme script prevents FOUC

**App Component (Route Gate):**
- Location: `src/App.tsx`
- Triggers: After Zustand persist hydration
- Responsibilities: Wizard gate (shows `SetupWizard` if `!isConfigured`), BrowserRouter with all routes, theme class sync, location tracking

**Flask Backend:**
- Location: `backend/server.py`
- Triggers: `python3 server.py` (gevent WSGIServer or werkzeug fallback)
- Responsibilities: REST API for config/xkeen/service management, WebSocket log streaming, system metrics

## Error Handling

**Strategy:** Optimistic UI with toast notifications for errors

**Patterns:**
- API calls wrapped in try/catch at the store action level; errors shown via `toast.error()` from `sonner`
- Optimistic updates with rollback (e.g., proxy selection in `useProxiesStore.selectProxyInGroup`)
- Health check gate: pages that need API access show `SetupGuide` component with setup instructions and retry button when APIs are unreachable
- Navigation guards: `beforeunload` event listener on pages with dirty state (ConfigEditor, Rules)
- WebSocket auto-reconnect: `useMihomoWs` reconnects after 3s on close; `useLogWebSocket` reconnects after 1s
- Flask backend returns JSON error responses with `{error: "message"}` pattern; HTTP status codes 400/404/500

## Cross-Cutting Concerns

**Logging:** `console.log`/`console.warn` for WebSocket connection events only; no structured client-side logging framework

**Validation:** YAML validation in Flask backend via `ruamel.yaml` before saving config; Monaco editor shows inline YAML errors via `js-yaml` parsing in config editor store

**Authentication:** Bearer token auth for mihomo API (secret stored in settings store, sent as `Authorization: Bearer {secret}` header); Flask backend has no authentication

**Theming:** Custom oklch-based color system in `src/index.css` with light/dark variants; theme toggle syncs `.dark` class on `<html>`; Monaco Editor gets custom `antigravity-dark` theme registered at runtime via `src/hooks/use-theme.ts`

**Internationalization:** All user-facing strings hardcoded in Russian; no i18n framework

---

*Architecture analysis: 2026-03-01*
