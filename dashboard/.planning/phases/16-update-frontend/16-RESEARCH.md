# Phase 16: Update Frontend - Research

**Researched:** 2026-03-04
**Domain:** React SPA update UI, markdown rendering, Zustand state management, health polling
**Confidence:** HIGH

## Summary

Phase 16 creates the user-facing update experience for XMeow dashboard. The backend API (Phase 15) is fully complete with endpoints for check, apply, rollback, and apply-dist. The frontend needs: a Zustand store for update state, API client functions, an update page with version comparison and changelog, a progress overlay with health polling, sidebar badge notification, and dual-card layout for external-ui mode.

The key technical challenge is markdown rendering for GitHub release notes within Tailwind v4. The project does NOT use `@tailwindcss/typography`, and react-markdown v10 removed its `className` prop. The recommended approach is custom `components` prop with Tailwind utility classes directly on elements -- this avoids adding a new dependency and keeps full control over the Antigravity theme. GitHub release notes use GFM features (tables, checkboxes, strikethrough), so `remark-gfm` is required.

**Primary recommendation:** Use react-markdown@10 + remark-gfm@4 with custom `components` map applying Tailwind classes. Skip `@tailwindcss/typography` -- manual classes give better theme control and avoid Tailwind v4 plugin compatibility friction.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **Update Page Layout**: Status card at top + changelog below as formatted markdown. Status card shows current version -> latest version with badge. When up-to-date: green checkmark badge. Rollback button in status card (secondary/outline). Use `react-markdown` with GFM support.

2. **Notifications & Auto-check**: Silent dot indicator on sidebar menu item (green dot). No toast notifications. New `useUpdateStore` (Zustand). Polling: app load + every 6 hours. Settings toggle "Проверять обновления автоматически" persisted in `useSettingsStore`.

3. **Update Progress & Reload**: Full-screen overlay with spinner + log area. Confirmation AlertDialog before update. Poll GET /api/health every 2s, timeout 30s. Auto window.location.reload() on health OK. Fallback "Перезагрузить вручную" button on timeout. Error handling with "Закрыть" button.

4. **External-UI Mode**: Two separate cards when `is_external_ui: true`. "Сервер XMeow" card + "Дашборд" card. Independent updates via /api/update/apply and /api/update/apply-dist. Shared changelog below. Dist update: success message -> auto-reload after 2s. Normal mode: single card, single button.

### Claude's Discretion

- Best approach to style react-markdown output to match Antigravity dark theme (prose class vs custom components)
- Whether to use `remark-gfm` or if base react-markdown is sufficient for GitHub release notes

### Deferred Ideas (OUT OF SCOPE)

None captured during discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UPUI-01 | Update page shows current vs latest version with comparison | Status card component with version comparison, badge logic, ReleaseInfo API type |
| UPUI-02 | Update page shows changelog from GitHub release notes (markdown) | react-markdown@10 + remark-gfm@4, custom components for theme styling |
| UPUI-03 | User can trigger update from UI with progress overlay | AlertDialog confirmation, full-screen overlay, health polling pattern, auto-reload |
| UPUI-04 | Sidebar shows notification badge when update is available | Green dot indicator in AppSidebar, useUpdateStore.hasUpdate subscription |
| UPUI-05 | Auto-check for updates on app load and periodically (6 hours) | useUpdateStore with setInterval, settings toggle autoCheckUpdates |
| UPUI-06 | UI shows separate version status for server and dashboard in external-ui mode | Dual-card layout, is_external_ui field from backend, apply-dist endpoint |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | ^10.1.0 | Render GitHub release notes as formatted HTML | De facto standard for markdown-in-React, v10 is latest stable |
| remark-gfm | ^4.0.1 | GFM extensions: tables, checkboxes, strikethrough | GitHub release notes use GFM; base react-markdown only supports CommonMark |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | ^5.0.11 | Update state store | Already project standard for all stores |
| zustand/middleware (persist) | ^5.0.11 | Persist auto-check setting | Already used by settings store |
| lucide-react | ^0.575.0 | Icons for status badges, buttons | Already project standard |
| sonner | ^2.0.7 | Toast notifications (NOT for auto-check, but for manual check errors) | Already in project |
| radix-ui AlertDialog | ^1.4.3 | Confirmation dialog before update | Already used by existing UpdateOverlay |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-markdown + custom components | @tailwindcss/typography (prose plugin) | Typography plugin adds dependency, requires @plugin directive in CSS, prose classes less customizable for Antigravity theme. Custom components give full control. |
| remark-gfm | Base react-markdown only | GitHub release notes use GFM tables and checkboxes. Without remark-gfm, tables render as plain text. Required. |

**Installation:**
```bash
pnpm add react-markdown remark-gfm
```

## Architecture Patterns

### New Files to Create
```
src/
├── stores/
│   └── update.ts              # Zustand store for update state + auto-check logic
├── lib/
│   └── update-api.ts          # API client functions for /api/update/* endpoints
├── components/
│   └── update/
│       ├── UpdateStatusCard.tsx    # Version comparison card (single or dual mode)
│       ├── UpdateOverlay.tsx       # Full-screen progress overlay with health polling
│       └── UpdateChangelog.tsx     # react-markdown changelog renderer
└── pages/
    └── UpdatesPage.tsx            # Replace placeholder with real page
```

### Files to Modify
```
src/
├── stores/settings.ts         # Add autoCheckUpdates: boolean
├── components/layout/AppSidebar.tsx  # Add green dot indicator
├── pages/SettingsPage.tsx     # Add auto-update toggle section
└── App.tsx                    # Initialize auto-check on app load
```

### Backend File to Modify
```
internal/
├── updater/updater.go         # Add IsExternalUI field to ReleaseInfo struct
└── handler/update.go          # Add is_external_ui to CheckUpdate response
```

### Pattern 1: Update Zustand Store with Auto-Check
**What:** Dedicated store for update state with periodic checking
**When to use:** Central state for update-related data shared across sidebar badge, update page, and settings

```typescript
// Source: Project pattern from existing stores (settings.ts, overview.ts)
import { create } from 'zustand'

interface ReleaseInfo {
  current_version: string
  latest_version: string
  has_update: boolean
  release_notes: string
  published_at: string
  asset_name: string
  asset_size: number
  dist_size: number
  is_prerelease: boolean
  is_external_ui: boolean
}

interface UpdateState {
  // Data
  releaseInfo: ReleaseInfo | null
  hasUpdate: boolean
  isExternalUI: boolean

  // Loading states
  checking: boolean
  applying: boolean
  applyingDist: boolean

  // Error state
  error: string | null

  // Actions
  checkForUpdate: () => Promise<void>
  applyUpdate: () => Promise<void>
  applyDist: () => Promise<void>
  rollback: () => Promise<void>
  clearError: () => void
}
```

### Pattern 2: Health Polling After Update
**What:** Poll /api/health every 2s after apply returns "restarting", auto-reload on success
**When to use:** After POST /api/update/apply (server restarts, connection lost)

```typescript
// Source: Project pattern from existing UpdateOverlay.tsx + CONTEXT.md decisions
async function pollHealth(baseUrl: string, maxAttempts = 15): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000))
    try {
      const res = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(2000),
      })
      if (res.ok) return true
    } catch {
      // Server still restarting, continue polling
    }
  }
  return false // Timeout after 30s
}
```

### Pattern 3: react-markdown with Custom Components
**What:** Render GitHub release notes markdown with Antigravity theme classes
**When to use:** Changelog display on update page

```typescript
// Source: react-markdown v10 docs + project CSS variables
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-xl font-bold mb-3 mt-4 text-foreground" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-lg font-semibold mb-2 mt-3 text-foreground" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-base font-medium mb-1.5 mt-2 text-foreground" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-2 text-sm text-muted-foreground leading-relaxed" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-2 ml-4 list-disc text-sm text-muted-foreground space-y-0.5" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-2 ml-4 list-decimal text-sm text-muted-foreground space-y-0.5" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm" {...props}>{children}</li>
  ),
  code: ({ children, ...props }) => (
    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
  ),
  pre: ({ children, ...props }) => (
    <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs mb-2" {...props}>{children}</pre>
  ),
  a: ({ children, ...props }) => (
    <a className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
  ),
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto mb-2">
      <table className="w-full text-sm border-collapse" {...props}>{children}</table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th className="border border-border px-2 py-1 text-left font-medium bg-muted" {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-border px-2 py-1" {...props}>{children}</td>
  ),
  input: ({ ...props }) => (
    // GFM task list checkboxes
    <input className="mr-1.5 accent-primary" disabled {...props} />
  ),
  hr: (props) => (
    <hr className="my-3 border-border" {...props} />
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-2 border-primary/30 pl-3 my-2 text-sm text-muted-foreground italic" {...props}>{children}</blockquote>
  ),
}

// Usage:
<div className="prose-custom">
  <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
    {releaseNotes}
  </Markdown>
</div>
```

### Pattern 4: Sidebar Badge Indicator
**What:** Green dot next to "Обновления" menu item when update available
**When to use:** Visual notification without toast

```typescript
// Source: CONTEXT.md decision + existing AppSidebar.tsx pattern
// In sidebar menu item rendering:
<NavLink to={item.path}>
  <item.icon />
  <span>{item.title}</span>
  {item.path === '/updates' && hasUpdate && (
    <span className="ml-auto h-2 w-2 rounded-full bg-green-500 shrink-0" />
  )}
</NavLink>
```

### Anti-Patterns to Avoid
- **Polling during normal operation:** Do NOT poll /api/health continuously. Only poll after an update apply to detect server restart. Normal update checks are periodic (6h interval).
- **Using useEffect for interval in component:** The 6-hour auto-check interval should live in the store or be initialized once in App.tsx, not in a page component that mounts/unmounts.
- **Blocking UI during check:** Update check (GET /api/update/check) should be non-blocking. Only the apply operation blocks with overlay.
- **Caching update check client-side:** Backend already caches for 1 hour (SUPD-04). Frontend does NOT need its own TTL cache -- just call the API.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom parser or dangerouslySetInnerHTML | react-markdown@10 + remark-gfm@4 | XSS safety, GFM support, React component tree |
| Version comparison | Custom semver parser in frontend | Backend `has_update` field from ReleaseInfo | Backend already does compareVersions() with proper semver logic |
| Periodic timer cleanup | Raw setInterval without cleanup | useEffect + setInterval with cleanup return | Prevents timer leak on unmount |
| URL sanitization in markdown | Custom link filtering | react-markdown's built-in defaultUrlTransform | Strips javascript: and data: URLs by default |

**Key insight:** The backend already handles all complex logic (GitHub API, version comparison, checksum verification, atomic replacement). The frontend is purely a presentation layer that calls API endpoints and shows results.

## Common Pitfalls

### Pitfall 1: react-markdown v10 className Removal
**What goes wrong:** Trying to use `<Markdown className="prose dark:prose-invert">` fails silently -- no class applied.
**Why it happens:** react-markdown v10 (released 2025-02-20) removed the `className` prop.
**How to avoid:** Wrap `<Markdown>` in a `<div>` with the desired class, or use custom `components` prop (recommended for this project).
**Warning signs:** Markdown renders without any styling.

### Pitfall 2: Tailwind v4 Preflight Strips Markdown Styles
**What goes wrong:** Headings, lists, blockquotes render as unstyled plain text.
**Why it happens:** Tailwind's CSS reset (Preflight) removes default browser styles for h1-h6, ul, ol, blockquote, etc. react-markdown renders semantic HTML but Tailwind strips the visual styles.
**How to avoid:** Use custom `components` prop with explicit Tailwind classes on every element. Do NOT rely on browser defaults.
**Warning signs:** All markdown text looks like plain paragraphs.

### Pitfall 3: Health Polling Race Condition After Update
**What goes wrong:** Old server responds to health check before restart, frontend reloads prematurely with old version.
**Why it happens:** Server sends HTTP response, then calls `time.AfterFunc(1*time.Second, restartService)`. If health poll happens in that 1s window, server is still the old version.
**How to avoid:** Start polling 2-3 seconds after receiving the "restarting" response. First poll at T+3s, then every 2s. Alternatively, wait for initial connection failure before counting success.
**Warning signs:** Page reloads but still shows old version.

### Pitfall 4: setInterval Drift and Memory Leak
**What goes wrong:** 6-hour check interval drifts or keeps running after app unmount/navigation.
**Why it happens:** setInterval in component-level useEffect without proper cleanup.
**How to avoid:** Initialize interval in App.tsx at top level (runs once), with cleanup. Or better: use store-level initialization that doesn't depend on component lifecycle.
**Warning signs:** Multiple intervals stacking, check running multiple times per period.

### Pitfall 5: External-UI Mode Detection Timing
**What goes wrong:** Update page renders before `is_external_ui` field is known, causing layout shift.
**Why it happens:** First render before checkForUpdate completes.
**How to avoid:** Show skeleton/loading state while `releaseInfo === null`. Only render card layout after check completes.
**Warning signs:** Cards flash from single to dual layout.

### Pitfall 6: Apply-Dist Does NOT Restart Server
**What goes wrong:** Frontend tries health polling after dist update, but server never goes down.
**Why it happens:** POST /api/update/apply-dist only updates SPA files in mihomo external-ui dir -- no restart needed.
**How to avoid:** After apply-dist success, show "Дашборд обновлён" message and auto-reload page after 2 seconds. Do NOT poll health -- the server is still running.
**Warning signs:** Overlay spinner stuck forever waiting for "restart" that never happens.

## Code Examples

### API Client Functions
```typescript
// Source: Pattern from existing config-api.ts
import { useSettingsStore } from '@/stores/settings'

function getBaseUrl(): string {
  return useSettingsStore.getState().configApiUrl
}

function authHeaders(): Record<string, string> {
  const secret = useSettingsStore.getState().mihomoSecret
  if (secret) return { Authorization: `Bearer ${secret}` }
  return {}
}

export interface ReleaseInfo {
  current_version: string
  latest_version: string
  has_update: boolean
  release_notes: string
  published_at: string
  asset_name: string
  asset_size: number
  dist_size: number
  is_prerelease: boolean
  is_external_ui: boolean
}

export async function checkUpdate(): Promise<ReleaseInfo> {
  const res = await fetch(`${getBaseUrl()}/api/update/check`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to check for updates')
  }
  return res.json()
}

export async function applyUpdate(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${getBaseUrl()}/api/update/apply`, {
    method: 'POST',
    headers: authHeaders(),
    signal: AbortSignal.timeout(300000), // 5 min for download
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to apply update')
  }
  return res.json()
}

export async function applyDist(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${getBaseUrl()}/api/update/apply-dist`, {
    method: 'POST',
    headers: authHeaders(),
    signal: AbortSignal.timeout(300000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to update dashboard')
  }
  return res.json()
}

export async function rollbackUpdate(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${getBaseUrl()}/api/update/rollback`, {
    method: 'POST',
    headers: authHeaders(),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to rollback')
  }
  return res.json()
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/health`, {
      signal: AbortSignal.timeout(2000),
    })
    return res.ok
  } catch {
    return false
  }
}
```

### Backend Change: Add is_external_ui to ReleaseInfo
```go
// Source: internal/updater/updater.go — add field to ReleaseInfo struct
type ReleaseInfo struct {
    // ... existing fields ...
    IsExternalUI   bool      `json:"is_external_ui"`
}

// In Check() method, after building info:
info.IsExternalUI = u.IsExternalUI()
```

### Settings Store Extension
```typescript
// Source: Extend existing src/stores/settings.ts
// Add to SettingsState interface:
autoCheckUpdates: boolean
setAutoCheckUpdates: (v: boolean) => void

// Add to initialState:
autoCheckUpdates: true

// Add to store actions:
setAutoCheckUpdates: (v) => set({ autoCheckUpdates: v })
```

### Auto-Check Initialization in App.tsx
```typescript
// Source: Pattern -- initialize once at app level
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours

useEffect(() => {
  const settings = useSettingsStore.getState()
  if (!settings.autoCheckUpdates) return

  // Check on load
  useUpdateStore.getState().checkForUpdate()

  // Periodic check
  const id = setInterval(() => {
    if (useSettingsStore.getState().autoCheckUpdates) {
      useUpdateStore.getState().checkForUpdate()
    }
  }, CHECK_INTERVAL_MS)

  return () => clearInterval(id)
}, []) // Run once on mount
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-markdown v9 className prop | v10 removed className, use wrapper div | 2025-02-20 | Must wrap in div or use components prop |
| @tailwindcss/typography for prose | Custom components in Tailwind v4 | 2024-12 (Tailwind v4) | Typography plugin works but requires @plugin directive; custom components give more control |
| remark-gfm v3 | remark-gfm v4 | 2023 | v4 is ESM-only, compatible with react-markdown v10 |

**Deprecated/outdated:**
- `react-markdown` className prop: removed in v10, use wrapper div or components
- `remarkPlugins` with old remark-gfm v3: use v4 with react-markdown v10

## Open Questions

1. **Backend change deployment timing**
   - What we know: `is_external_ui` field needs to be added to Go backend `ReleaseInfo` struct
   - What's unclear: Should this be a separate mini-task or bundled with frontend work?
   - Recommendation: Include as first task in the phase plan -- small change (2 lines in Go)

2. **Health polling initial delay**
   - What we know: Backend sends response then waits 1s before calling init.d restart
   - What's unclear: Exact timing between HTTP response and process death
   - Recommendation: Wait 3 seconds after "restarting" response before first health poll to avoid false-positive

## Sources

### Primary (HIGH confidence)
- Go backend source code: `internal/updater/updater.go`, `internal/handler/update.go` -- ReleaseInfo struct, API endpoints verified
- Go backend routes: `internal/server/routes.go` -- confirmed /api/update/* route group with auth
- react-markdown GitHub README -- v10 API, components prop, remarkPlugins
- Existing project patterns: `src/stores/settings.ts`, `src/lib/config-api.ts`, `src/components/overview/UpdateOverlay.tsx`

### Secondary (MEDIUM confidence)
- [react-markdown changelog](https://github.com/remarkjs/react-markdown/blob/main/changelog.md) -- v10.0.0 breaking change: className removed
- [Tailwind CSS v4 + react-markdown discussion](https://github.com/tailwindlabs/tailwindcss/discussions/17645) -- preflight breaks markdown styling, @tailwindcss/typography or custom components needed
- [remark-gfm npm page](https://www.npmjs.com/package/remark-gfm) -- v4.0.1 latest, GFM extensions

### Tertiary (LOW confidence)
- None -- all findings verified against source code or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- react-markdown and remark-gfm are well-established, versions verified on npm
- Architecture: HIGH -- follows existing project patterns (Zustand stores, config-api.ts, UpdateOverlay.tsx)
- Pitfalls: HIGH -- Tailwind v4 preflight issue verified via GitHub discussion, v10 className removal verified via changelog, health polling timing verified from Go source code
- Backend API: HIGH -- verified directly from Go source code in repo

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable libraries, well-defined project patterns)
