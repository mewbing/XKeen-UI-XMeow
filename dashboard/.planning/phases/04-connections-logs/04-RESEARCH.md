# Phase 4: Connections + Logs - Research

**Researched:** 2026-02-27
**Domain:** Real-time WebSocket data streaming, virtualized tables, log viewer
**Confidence:** HIGH

## Summary

Phase 4 implements two real-time monitoring features on a single tabbed page: a connections table showing active mihomo connections via WebSocket with filtering/search/close capabilities, and a log stream viewer showing structured log entries with level filtering. Both features rely on mihomo's WebSocket API endpoints (`/connections` and `/logs`) which the project already has an established pattern for via the `useMihomoWs` hook.

The core technical challenge is handling high-volume data (1000+ concurrent connections, continuous log stream) without degrading UI performance. This requires virtualization for the connections table (using `@tanstack/react-virtual`) and a bounded ring buffer for log entries. The existing codebase already defines `Connection` and `ConnectionMetadata` TypeScript interfaces in `mihomo-api.ts`, and the `useMihomoWs` hook handles WebSocket lifecycle with auto-reconnect.

**Primary recommendation:** Use the existing `useMihomoWs` hook for both WebSocket streams, add `@tanstack/react-virtual` for table virtualization, use shadcn Tabs for page layout, and implement a Zustand store for connections/logs state management following the established volatile store pattern (like `proxies.ts`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Компактная таблица (мелкий шрифт, максимум информации на экране, стиль yacd/metacubexd)
- Колонки настраиваемые пользователем (показ/скрытие колонок)
- Данные обновляются через WebSocket (`/connections`)
- Клик по строке раскрывает дополнительные детали (expandable row) -- process, chain, sniffHost и другие поля
- Кнопка "Закрыть все" в тулбаре с подтверждением через AlertDialog
- Структурированные мини-карточки для логов (не терминальный вид): каждый лог -- отдельная карточка с цветным уровнем и полями
- Экспорт в обоих форматах: TXT (простой текст) и JSON (структурированный)
- Автопауза при прокрутке вверх, кнопка "Вниз" возобновляет автоскролл
- Кнопка очистки лога
- Live-фильтр (фильтрация при вводе, без submit) для подключений
- Текстовый поиск + дропдауны-селекторы (network TCP/UDP, rule, proxy группа) для подключений
- Кликабельные бейджи уровней (debug/info/warning/error) для логов + текстовый поиск
- Одна страница, два таба: "Подключения" и "Логи"
- Тулбар фиксирован сверху над контентом (поиск, фильтры, действия)
- Каждый таб имеет свой тулбар с релевантными фильтрами

### Claude's Discretion
- Размер буфера логов (оптимальный для роутера)
- Виртуализация таблицы для 1000+ строк
- Цветовая схема уровней логов
- Дефолтные видимые колонки таблицы
- Анимации переключения табов

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONN-01 | Real-time table of active connections with source, destination, rule, proxy, speed | WebSocket `/connections` endpoint streams snapshots; `Connection` type already defined in mihomo-api.ts; `@tanstack/react-virtual` for virtualization |
| CONN-02 | User can search and filter connections | Live-filter pattern from ProxiesToolbar; filter by network/rule/proxy via Select dropdowns |
| CONN-03 | User can close individual connections | `DELETE /connections/:id` returns 204; close-all via `DELETE /connections` |
| LOGS-01 | Real-time log stream via WebSocket | WebSocket `/logs?level=X&format=structured` endpoint; structured format provides time/level/message/fields |
| LOGS-02 | User can filter logs by level (info/warning/error) | Clickable badge toggles; server-side level param filters at source; client-side toggling for already-buffered entries |
| LOGS-03 | User can search within logs | Client-side text filter on message + fields, live-filter pattern |
| LOGS-04 | Auto-scroll toggle, clear, export functionality | Scroll detection via scrollTop comparison; Blob download for TXT/JSON export; ring buffer clear resets array |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-virtual | ^3.13 | Virtualized rendering for 1000+ connection rows | Industry standard for headless virtualization in React; 60fps scrolling; works with React 19 |
| zustand | ^5.0.11 | Volatile state for connections and logs | Already in project; established pattern for real-time stores (overview, proxies) |
| useMihomoWs hook | (existing) | WebSocket lifecycle for /connections and /logs | Already handles auth, reconnect, ref-stable callbacks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Tabs | (radix-ui) | Tab switching between Connections and Logs | Already available via radix-ui dependency; needs `npx shadcn@latest add tabs` |
| shadcn/ui AlertDialog | (existing) | Confirmation for "Close all connections" | Already installed in project |
| shadcn/ui Badge | (existing) | Log level badges, network type badges | Already installed |
| shadcn/ui Select | (existing) | Network/rule/proxy filter dropdowns | Already installed; proven pattern in ProxiesToolbar |
| lucide-react | (existing) | Icons for toolbar actions | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @tanstack/react-virtual | Native rendering | Freezes UI at 500+ rows; unacceptable for router with 1000+ connections |
| @tanstack/react-virtual | @tanstack/react-table + virtual | Overkill -- we need simple row virtualization, not full table headless logic |
| File-saver library | Native Blob + anchor click | No library needed; modern browsers support `URL.createObjectURL` + `<a download>` natively |

**Installation:**
```bash
pnpm add @tanstack/react-virtual
npx shadcn@latest add tabs
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  pages/
    ConnectionsLogsPage.tsx      # Single page with Tabs, replaces both placeholder pages
  components/
    connections/
      ConnectionsTab.tsx          # Connections tab content (toolbar + virtualized table)
      ConnectionsToolbar.tsx      # Search, filters, close-all, pause
      ConnectionsTable.tsx        # Virtualized table with expandable rows
      ConnectionRow.tsx           # Single connection row (compact + expanded detail)
      ConnectionDetail.tsx        # Expanded detail panel (process, chain, sniffHost)
      ColumnSelector.tsx          # Popover for toggling visible columns
    logs/
      LogsTab.tsx                 # Logs tab content (toolbar + log stream)
      LogsToolbar.tsx             # Level badges, search, clear, export
      LogStream.tsx               # Virtualized log list with auto-scroll
      LogCard.tsx                 # Single log entry as mini-card
  stores/
    connections.ts                # Zustand volatile store for connections state
    logs.ts                       # Zustand volatile store for logs state
  lib/
    mihomo-api.ts                 # Add closeConnection, closeAllConnections functions
```

### Pattern 1: WebSocket Connections Store (volatile, no persist)
**What:** Zustand store receives connection snapshots from WebSocket, processes diffs, exposes filtered views.
**When to use:** For the connections tab real-time data.
**Example:**
```typescript
// Source: project pattern from stores/proxies.ts + stores/overview.ts
interface ConnectionsState {
  connections: Connection[]
  closedIds: Set<string>  // Track manually closed for visual feedback
  paused: boolean
  searchQuery: string
  networkFilter: string   // 'all' | 'tcp' | 'udp'
  ruleFilter: string
  proxyFilter: string
  visibleColumns: string[]
  expandedId: string | null

  // Derived
  filteredConnections: () => Connection[]

  // Actions
  updateSnapshot: (snapshot: ConnectionsSnapshot) => void
  closeConnection: (id: string) => Promise<void>
  closeAllConnections: () => Promise<void>
  setPaused: (paused: boolean) => void
  setSearchQuery: (q: string) => void
  setNetworkFilter: (f: string) => void
  setVisibleColumns: (cols: string[]) => void
  toggleExpanded: (id: string) => void
}
```

### Pattern 2: Log Ring Buffer with Auto-Pause
**What:** Fixed-size array stores log entries; auto-scroll pauses when user scrolls up; resumes on "scroll to bottom" click.
**When to use:** For log stream with bounded memory usage.
**Example:**
```typescript
// Log buffer store
const MAX_LOG_ENTRIES = 1000  // ~1KB per entry = ~1MB max

interface LogEntry {
  id: number              // Auto-increment counter
  time: string            // From structured format
  level: string           // debug | info | warning | error
  message: string
  fields: { key: string; value: string }[]
}

interface LogsState {
  entries: LogEntry[]
  nextId: number
  activeLevels: Set<string>   // Which levels are shown
  searchQuery: string
  paused: boolean              // Auto-pause on scroll up

  addEntry: (raw: LogStructured) => void
  clear: () => void
  setActiveLevels: (levels: Set<string>) => void
  toggleLevel: (level: string) => void
  exportTxt: () => void
  exportJson: () => void
}
```

### Pattern 3: Virtualized Table with Expandable Rows
**What:** `@tanstack/react-virtual` virtualizes connection rows; clicking a row toggles an expanded detail panel.
**When to use:** For the connections table.
**Example:**
```typescript
// Source: TanStack Virtual docs
import { useVirtualizer } from '@tanstack/react-virtual'

function ConnectionsTable({ connections }: { connections: Connection[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: connections.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,  // Compact row height
    overscan: 20,            // Extra rows for smooth scrolling
  })

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const conn = connections[virtualRow.index]
          return (
            <div
              key={conn.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <ConnectionRow connection={conn} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

### Pattern 4: Auto-Scroll with Pause Detection
**What:** Monitor scrollTop to detect when user scrolls away from bottom; pause auto-scroll; show "scroll to bottom" button.
**When to use:** For log stream auto-scroll behavior.
**Example:**
```typescript
function useAutoScroll(ref: RefObject<HTMLDivElement>) {
  const [isAtBottom, setIsAtBottom] = useState(true)

  const handleScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    const threshold = 50 // px from bottom
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    setIsAtBottom(atBottom)
  }, [ref])

  const scrollToBottom = useCallback(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' })
  }, [ref])

  return { isAtBottom, handleScroll, scrollToBottom }
}
```

### Anti-Patterns to Avoid
- **Storing full connection history:** Only store the current snapshot from WebSocket. Mihomo sends full active connections list each tick -- do not accumulate old snapshots.
- **Unbounded log buffer:** Without a limit, logs will consume all available memory on a long-running session. Always cap at MAX_LOG_ENTRIES.
- **Re-creating WebSocket on filter change:** Filters should be client-side only. The WebSocket streams all data; filtering happens in the store/component. Never reconnect WebSocket when filters change.
- **Using `useFlushSync` with React 19:** TanStack Virtual may log console warnings about `flushSync` in React 19. Set `useFlushSync: false` in virtualizer options.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table virtualization | Custom windowing with manual scroll math | @tanstack/react-virtual | Handles dynamic row heights, overscan, scroll restoration, variable sizing -- hundreds of edge cases |
| File download | Custom fetch + blob handler | Native Blob + URL.createObjectURL + anchor download | 5 lines of code, works in all modern browsers, no library needed |
| WebSocket lifecycle | Manual WS creation in useEffect | Existing useMihomoWs hook | Already handles auth, reconnect, ref stability, cleanup |
| Tab UI | Custom div switching | shadcn/ui Tabs (radix-ui) | Handles ARIA, keyboard nav, focus management, animations |
| Confirmation dialog | window.confirm() | Existing AlertDialog component | Consistent with project style (used in ServiceControl) |

**Key insight:** The project already has robust patterns for WebSocket, stores, and UI components. This phase is mostly composition of existing patterns with one new dependency (@tanstack/react-virtual).

## Common Pitfalls

### Pitfall 1: WebSocket Data Volume
**What goes wrong:** The `/connections` endpoint sends ALL active connections every interval (default 1000ms). With 1000+ connections, each message can be 200KB+.
**Why it happens:** Mihomo sends full snapshots, not diffs.
**How to avoid:** Use the `interval` parameter of useMihomoWs to control update frequency. 1000ms (default) is fine; don't go below 500ms. Consider pausing the WS when the tab is not active.
**Warning signs:** UI lag, high memory usage, frequent GC pauses.

### Pitfall 2: Stale Closures in WebSocket Callbacks
**What goes wrong:** The onMessage callback captures stale store references.
**Why it happens:** WebSocket onmessage is set once and holds old closure.
**How to avoid:** The existing `useMihomoWs` hook already handles this via `onMessageRef`. Always pass a stable callback (useCallback) to the hook.
**Warning signs:** Filters appear to not work, old data displayed after filter change.

### Pitfall 3: Expandable Row Height with Virtualizer
**What goes wrong:** Expanded rows have different height than collapsed rows, causing virtualizer layout glitches.
**Why it happens:** `estimateSize` returns fixed height but actual row height varies.
**How to avoid:** Use `measureElement` from virtualizer to dynamically measure rows. Pass a `ref` callback to each row element: `ref={virtualizer.measureElement}`. This makes the virtualizer aware of actual row heights.
**Warning signs:** Rows overlap, scroll jumps when expanding/collapsing.

### Pitfall 4: Log Buffer Performance
**What goes wrong:** Prepending/appending to large arrays causes UI freezes due to React re-rendering thousands of elements.
**Why it happens:** Each log entry triggers state update and potential re-render.
**How to avoid:** Batch log entries (e.g., collect for 100ms then flush), use ring buffer with fixed size, virtualize the log list.
**Warning signs:** Increasing lag as log count grows, dropped frames during heavy logging.

### Pitfall 5: Memory Leak from Unmounted WebSocket
**What goes wrong:** WebSocket continues receiving data after navigating away from the page.
**Why it happens:** Cleanup in useEffect doesn't fire if component is not properly unmounted.
**How to avoid:** The existing `useMihomoWs` hook handles this correctly (cleanup in effect teardown). Just ensure the hook is used at the tab level, not globally.
**Warning signs:** Memory usage grows when navigating to other pages.

### Pitfall 6: Tailwind v4 Color Pattern
**What goes wrong:** Using `hsl(var(--color))` pattern for colors.
**Why it happens:** Old shadcn/tailwind v3 pattern.
**How to avoid:** Use `var(--color)` directly. CSS vars contain complete oklch() values in this project. This was explicitly established in Phase 02 decisions.
**Warning signs:** Colors appear wrong or transparent.

## Code Examples

### Close Connection API
```typescript
// Source: mihomo API (DELETE /connections/:id returns 204)
export async function closeConnection(id: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/connections/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok && res.status !== 204) {
    throw new Error('Failed to close connection')
  }
}

export async function closeAllConnections(): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/connections`, {
    method: 'DELETE',
    headers: getHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok && res.status !== 204) {
    throw new Error('Failed to close all connections')
  }
}
```

### WebSocket Log Message Format (structured)
```typescript
// Source: mihomo hub/route/server.go getLogs handler
// Request: ws://host:port/logs?token=SECRET&level=debug&format=structured

interface LogStructuredField {
  key: string
  value: string
}

interface LogStructuredMessage {
  time: string    // HH:MM:SS format (time.TimeOnly)
  level: string   // "debug" | "info" | "warn" | "error" (note: "warning" mapped to "warn")
  message: string
  fields: LogStructuredField[]
}

// Standard (non-structured) format:
interface LogStandardMessage {
  type: string    // "debug" | "info" | "warning" | "error"
  payload: string // The log message text
}
```

### WebSocket Connections Message Format
```typescript
// Source: mihomo hub/route/connections.go
// Request: ws://host:port/connections?token=SECRET&interval=1000
// Response: same as GET /connections (ConnectionsSnapshot)

// Already defined in mihomo-api.ts:
// ConnectionsSnapshot { downloadTotal, uploadTotal, connections: Connection[] }
// Connection { id, metadata, upload, download, start, chains, rule, rulePayload }
// ConnectionMetadata { network, type, sourceIP, destinationIP, sourcePort, destinationPort,
//                      host, dnsMode, processPath, specialProxy, specialRules,
//                      remoteDestination, dscp, sniffHost }
```

### Native File Download (No Library)
```typescript
// Source: standard Web API
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Usage for log export
function exportLogsTxt(entries: LogEntry[]) {
  const text = entries
    .map((e) => `[${e.time}] [${e.level.toUpperCase()}] ${e.message}`)
    .join('\n')
  downloadFile(text, `mihomo-logs-${Date.now()}.txt`, 'text/plain')
}

function exportLogsJson(entries: LogEntry[]) {
  const json = JSON.stringify(entries, null, 2)
  downloadFile(json, `mihomo-logs-${Date.now()}.json`, 'application/json')
}
```

## Discretion Recommendations

### Buffer Size: 1000 entries
Router environment with limited memory. 1000 log entries at ~1KB each = ~1MB. This gives ~15-20 minutes of logs at typical info-level verbosity. When buffer is full, oldest entries are dropped (ring buffer / shift + push).

### Virtualization: Yes, mandatory
Use `@tanstack/react-virtual` with `estimateSize: 32` (compact rows) and `overscan: 20`. For the log stream, also virtualize with `estimateSize: 48` (card height). This is critical for 1000+ connections that are common on active routers.

### Log Level Color Scheme
| Level | Color | Tailwind Class |
|-------|-------|----------------|
| debug | gray | `text-muted-foreground bg-muted` |
| info | blue | `text-blue-600 bg-blue-500/10` (dark: `text-blue-400`) |
| warning | amber | `text-amber-600 bg-amber-500/10` (dark: `text-amber-400`) |
| error | red | `text-red-600 bg-red-500/10` (dark: `text-red-400`) |

### Default Visible Columns
| Column | Default Visible | Notes |
|--------|----------------|-------|
| Host | Yes | Most useful identifier |
| Network | Yes | TCP/UDP badge |
| Source | Yes | sourceIP:sourcePort |
| Destination | Yes | destinationIP:destinationPort |
| Rule | Yes | Matching rule name |
| Chains | Yes | Proxy chain |
| DL Speed | Yes | Download speed |
| UL Speed | Yes | Upload speed |
| DL Total | No | Total downloaded bytes |
| UL Total | No | Total uploaded bytes |
| Start Time | No | Connection start time |
| Type | No | Connection type |
| Process | No | In expanded view only |
| sniffHost | No | In expanded view only |

### Tab Animations
Use `data-[state=active]` from Radix Tabs with a subtle `animate-in fade-in-0 duration-200` transition, consistent with ProxiesPage animation style.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-virtualized | @tanstack/react-virtual v3 | 2023 | Headless, lighter, framework-agnostic |
| react-window | @tanstack/react-virtual v3 | 2023 | Better dynamic sizing, more active maintenance |
| FileSaver.js | Native Blob + anchor download | 2022+ | No dependency needed for modern browsers |
| CSS-in-JS for themes | Tailwind v4 + CSS vars | 2025 | Project uses oklch CSS vars directly |

**Deprecated/outdated:**
- `react-virtualized`: Unmaintained, heavy bundle
- `react-window`: Less active, doesn't handle dynamic heights well
- `FileSaver.js`: Unnecessary for modern browser targets

## Open Questions

1. **Structured vs Standard log format**
   - What we know: Mihomo supports both `format=structured` (time/level/message/fields) and standard (type/payload)
   - What's unclear: Whether all mihomo versions support structured format
   - Recommendation: Use `format=structured` with fallback -- if fields are missing, parse from standard format

2. **Connection speed calculation**
   - What we know: Each WebSocket message contains `upload` and `download` as cumulative bytes. Speed must be calculated as delta between snapshots.
   - What's unclear: Exact delta approach when connections appear/disappear between snapshots
   - Recommendation: Store previous snapshot, calculate delta per connection ID. New connections show 0 speed initially.

3. **Pause behavior for connections tab**
   - What we know: User wants live updates via WebSocket
   - What's unclear: Should there be a "pause" button like logs, or always live?
   - Recommendation: Add a pause toggle in connections toolbar too -- useful when inspecting specific connections. When paused, WebSocket stays connected but store stops updating.

## Sources

### Primary (HIGH confidence)
- mihomo hub/route/server.go -- route registration, getLogs handler with structured format
- mihomo hub/route/connections.go -- WebSocket handler, DELETE endpoint, interval parameter
- mihomo wiki (wiki.metacubex.one/en/api/) -- official API docs confirming endpoints
- mihomo wiki (wiki.metacubex.one/en/config/general/) -- log levels: silent/error/warning/info/debug
- Existing project code -- mihomo-api.ts types, useMihomoWs hook, store patterns
- TanStack Virtual docs (tanstack.com/virtual/latest) -- v3.13.x, useVirtualizer API

### Secondary (MEDIUM confidence)
- [DeepWiki metacubexd API](https://deepwiki.com/MetaCubeX/metacubexd/2.2-api-and-websocket-communication) -- WebSocket patterns, authentication
- [DeepWiki metacubexd Dashboard](https://deepwiki.com/MetaCubeX/metacubexd/8-dashboard-and-statistics) -- connections table approach, @tanstack/solid-virtual usage
- [DeepWiki zashboard API](https://deepwiki.com/Zephyruso/zashboard/5-api-integration) -- WebSocket debouncing patterns

### Tertiary (LOW confidence)
- None -- all critical findings verified through official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- @tanstack/react-virtual is proven, all other deps already in project
- Architecture: HIGH -- follows established project patterns (stores, hooks, toolbar + content layout)
- API endpoints: HIGH -- verified against mihomo source code (server.go, connections.go)
- Log format: HIGH -- structured format extracted directly from mihomo source getLogs handler
- Pitfalls: HIGH -- based on established React + WebSocket + virtualization patterns
- Discretion items: MEDIUM -- buffer size and color scheme are reasonable defaults but may need tuning

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable domain -- mihomo API and @tanstack/react-virtual are mature)
