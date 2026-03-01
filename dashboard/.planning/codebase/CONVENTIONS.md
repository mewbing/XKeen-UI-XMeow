# Coding Conventions

**Analysis Date:** 2026-03-01

## Naming Patterns

**Files:**
- Components: PascalCase with `.tsx` extension — `ProxyNodeItem.tsx`, `MetricsCards.tsx`, `ConnectionsTable.tsx`
- Pages: PascalCase with `Page` suffix — `OverviewPage.tsx`, `ProxiesPage.tsx`, `RulesPage.tsx`
- Stores: kebab-case `.ts` — `rules-editor.ts`, `config-editor.ts`, `connections.ts`
- Hooks: two conventions coexist:
  - kebab-case with `use-` prefix — `use-mihomo-ws.ts`, `use-theme.ts`, `use-service-status.ts`
  - camelCase with `use` prefix — `useHealthCheck.ts`, `useLogWebSocket.ts`, `useMediaQuery.ts`
  - **Prefer kebab-case** for new hooks (matches stores pattern)
- Lib utilities: kebab-case `.ts` — `config-api.ts`, `mihomo-api.ts`, `rules-parser.ts`
- UI primitives: kebab-case `.tsx` — `button.tsx`, `scroll-text.tsx`, `split-toggle-button.tsx`

**Functions:**
- Use camelCase for all functions: `formatBytes`, `getBaseUrl`, `handleDragEnd`
- React components use PascalCase: `MetricCard`, `ProxyNodeItem`, `SetupGuide`
- Store selectors are inline arrow functions: `(s) => s.uploadSpeed`
- Event handlers: `handle` + Action — `handleAction`, `handleConfirm`, `handleMenuSelect`
- Callbacks passed as props: `on` + Event — `onSelect`, `onTest`, `onRetry`, `onSearchChange`

**Variables:**
- camelCase for all local/state variables: `searchQuery`, `typeFilter`, `effectiveCols`
- Constants: UPPER_SNAKE_CASE for module-level — `HISTORY_LENGTH`, `DEFAULT_COLUMNS`, `CACHE_TTL_MS`, `GROUP_COLORS`
- Boolean state: use `is`/`has` prefix or plain adjective — `isActive`, `isDragging`, `loading`, `paused`, `dirty`
- Internal/private state in stores: underscore prefix — `_prevSnapshot`, `_prevTime`

**Types:**
- Interfaces: PascalCase, descriptive noun — `ConnectionWithSpeed`, `RulesEditorState`, `ProxiesState`
- Props interfaces: Component + `Props` suffix — `ProxyNodeItemProps`, `RulesListProps`, `SetupGuideProps`
- Type aliases: PascalCase — `TabId`, `ServiceAction`, `ResolvedTheme`
- No `I` prefix for interfaces

## Code Style

**Formatting:**
- No Prettier/formatter config detected — formatting is manual/editor-based
- Single quotes for strings: `'string'` (consistent throughout)
- 2-space indentation
- Semicolons are omitted (no-semi style) in most files
- Trailing commas used consistently in multi-line structures
- Max line length: ~120 characters (soft limit, no enforcement)

**Linting:**
- ESLint 9 with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- No root `eslint.config.*` file detected — ESLint config may be missing or uses defaults via `pnpm lint`
- TypeScript strict mode enabled in `tsconfig.app.json`:
  - `strict: true`
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - `noFallthroughCasesInSwitch: true`
  - `erasableSyntaxOnly: true`

## Import Organization

**Order:**
1. React imports (`import { useState, useEffect } from 'react'`)
2. Third-party libraries (`react-router`, `lucide-react`, `@dnd-kit/*`, `sonner`, `yaml`)
3. Internal UI components (`@/components/ui/*`)
4. Internal feature components (`@/components/proxies/*`, `@/components/shared/*`)
5. Stores (`@/stores/*`)
6. Hooks (`@/hooks/*`)
7. Lib utilities (`@/lib/*`)
8. Types (inline or from same module)

**Path Aliases:**
- `@/*` maps to `./src/*` — use exclusively for all internal imports
- Never use relative `../` paths across feature boundaries
- Relative `./` paths only within the same component directory (e.g., `./RuleRow` from `RuleBlockList.tsx`)

**Import Style:**
- Named imports for everything: `import { formatBytes, formatSpeed } from '@/lib/format'`
- `type` keyword for type-only imports: `import type { Connection } from '@/lib/mihomo-api'`
- Default exports only for pages and `App.tsx`
- Named exports for all other components, hooks, stores, and utilities

## Error Handling

**API calls (lib/):**
- All fetch calls include `AbortSignal.timeout(N)` — 5000ms default, longer for heavy ops
- Check `res.ok`, throw `new Error(data.error || 'fallback message')` on failure
- Return structured result objects (`{ ok: boolean; error?: string }`) for connection tests

```typescript
// Pattern from src/lib/mihomo-api.ts
export async function selectProxy(groupName: string, proxyName: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/proxies/${encodeURIComponent(groupName)}`, {
    method: 'PUT',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: proxyName }),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to select proxy')
  }
}
```

**Store actions:**
- Wrap API calls in try/catch
- Show `toast.error(message)` on failure
- Extract message: `error instanceof Error ? error.message : 'Fallback message'`
- Optimistic updates with rollback on error (see `selectProxyInGroup` in `src/stores/proxies.ts`)

```typescript
// Pattern from src/stores/proxies.ts
selectProxyInGroup: async (groupName, proxyName) => {
  const prevNow = get().proxyMap[groupName]?.now
  // Optimistic update
  set((state) => ({ proxyMap: { ...state.proxyMap, [groupName]: { ...state.proxyMap[groupName], now: proxyName } } }))
  try {
    await selectProxy(groupName, proxyName)
    toast.success(`Switched to ${proxyName}`)
  } catch (error) {
    // Rollback on error
    set((state) => ({ proxyMap: { ...state.proxyMap, [groupName]: { ...state.proxyMap[groupName], now: prevNow } } }))
    toast.error(error instanceof Error ? error.message : 'Failed to switch proxy')
  }
}
```

**Page-level data loading:**
- Fire-and-forget with `.catch(() => {})` for non-critical fetches (e.g., versions, CPU)
- Health checks gate page rendering — show `<SetupGuide>` when APIs unreachable

**WebSocket connections:**
- Auto-reconnect on close (1-3 second delay)
- Silent `ws.onerror` → just close, let `onclose` handle reconnect
- Ignore JSON parse errors in `onmessage`

## Logging

**Framework:** `console` (no logging library)

**Patterns:**
- `console.log('[WS] Connected')` for WebSocket lifecycle
- `console.warn('Failed to register Monaco theme:', e)` for non-critical failures
- `console.error(\`Service ${action} failed:\`, err)` for operation failures
- Minimal logging overall — most errors go to `toast` not console

## Comments

**When to Comment:**
- File-level JSDoc block explaining module purpose (present on all stores, lib files, hooks)
- Section dividers using Unicode box-drawing: `// ── Section Name ──────────────────────`
- Inline comments for non-obvious logic (why, not what)
- `@example` JSDoc tags for utility functions in `src/lib/format.ts`

**JSDoc/TSDoc:**
- `/** ... */` on exported functions in lib files
- Parameters documented inline via TypeScript types, not JSDoc `@param`
- `@example` tags for formatting/parsing utilities
- No JSDoc on component props (TypeScript interfaces serve this purpose)

```typescript
// Pattern from src/lib/format.ts
/**
 * Format proxy delay in milliseconds to display string.
 * undefined = not tested, 0 = timeout/unreachable.
 *
 * @example formatDelay(120)       -> "120ms"
 * @example formatDelay(0)         -> "timeout"
 * @example formatDelay(undefined) -> "--"
 */
export function formatDelay(delay: number | undefined): string { ... }
```

## Function Design

**Size:** Keep components and functions focused. Complex components split into sub-components within the same file (e.g., `MetricCard` and `MetricPairCard` inside `MetricsCards.tsx`).

**Parameters:**
- Destructured props objects for components:
  ```typescript
  function ProxyNodeItem({ name, isActive, canSelect, delay, testing, onSelect, onTest }: ProxyNodeItemProps) { ... }
  ```
- Explicit parameters for utility functions (not option objects)
- Store action parameters are positional, not objects

**Return Values:**
- Components return JSX
- API functions return typed Promises
- Hooks return objects with named fields: `{ running, pid, loading, error, refresh }`
- Store computed properties are functions called at render time: `filteredConnections()`

## Module Design

**Exports:**
- Pages: `export default function PageName()` — one per file
- Components: `export function ComponentName()` — named export, one primary per file
- Stores: `export const useXxxStore = create<XxxState>()(...)` — one per file
- Hooks: `export function useXxx(...)` — one primary hook per file, may have helper exports
- Lib: Multiple named exports per file grouped by domain

**Barrel Files:** Not used. All imports reference specific files directly.

## UI Language

- All user-facing strings are in **Russian**: `'Запустить'`, `'Остановить'`, `'Подключения'`
- Error messages in API clients use English (developer-facing): `'Failed to select proxy'`
- User-facing error messages use Russian: `'Не удалось подключиться'`, `'Превышено время ожидания'`
- Comments in code are in English

## Component Patterns

**Zustand selector pattern:** Use individual selectors to minimize re-renders:
```typescript
// CORRECT — each selector returns a primitive, component re-renders only when that value changes
const uploadSpeed = useOverviewStore((s) => s.uploadSpeed)
const downloadSpeed = useOverviewStore((s) => s.downloadSpeed)

// AVOID — returns new object every time, causes unnecessary re-renders
const { uploadSpeed, downloadSpeed } = useOverviewStore((s) => ({ uploadSpeed: s.uploadSpeed, downloadSpeed: s.downloadSpeed }))
```

**Store access outside React:** Use `useXxxStore.getState()` for imperative access:
```typescript
// Pattern from src/pages/ProxiesPage.tsx
useEffect(() => {
  useProxiesStore.getState().fetchAllProxies()
}, [])
```

**`cn()` for conditional classes:** Always use `cn()` from `@/lib/utils` for combining Tailwind classes:
```typescript
<div className={cn(
  'flex items-center gap-2 px-3 h-9 rounded-sm transition-colors',
  isActive && 'bg-primary/10 border-l-2 border-primary',
  canSelect && 'cursor-pointer hover:bg-accent/50',
)} />
```

**Callback stability:** Use `useCallback` for event handlers passed to child components. Use `useRef` for WebSocket callbacks to prevent stale closures:
```typescript
const onMessageRef = useRef(onMessage)
onMessageRef.current = onMessage  // Keep fresh on every render
```

**Memoization:** Use `useMemo` for filtered/computed lists. Use `memo()` for list item components in virtualized/DnD contexts (see `SortableGroupSection` in `src/components/rules/RuleBlockList.tsx`).

---

*Convention analysis: 2026-03-01*
