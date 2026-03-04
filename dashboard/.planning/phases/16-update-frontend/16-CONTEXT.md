# Phase 16: Update Frontend — Context

**Created**: 2026-03-04
**Status**: Ready for planning

## Phase Goal (from ROADMAP)

User sees available updates in UI and can update the dashboard with one click.
In external-ui mode — separate version status for server and dashboard.

## Decisions

### 1. Update Page Layout

**Decision**: Status card at top + changelog below as formatted markdown.

- **Status card**: Shows current version → latest version, badge "Доступно"/"Актуально", "Обновить" button
- **When up-to-date**: Same card with green checkmark badge "У вас последняя версия", changelog of current version below, "Проверить обновления" button
- **Changelog rendering**: Use `react-markdown` library with GFM support (tables, checkboxes). Style to match Antigravity theme
- **Rollback button**: Show "Откатить к предыдущей" button in status card (secondary/outline style). Calls `POST /api/update/rollback`

### 2. Notifications & Auto-check

**Decision**: Silent dot indicator on sidebar menu item. No toast notifications.

- **Badge**: Small colored dot (green) next to "Обновления" menu item in AppSidebar when update available
- **No toast**: Auto-check does NOT show toast/popup — dot only
- **Store**: New dedicated `useUpdateStore` (Zustand) with: `hasUpdate`, `latestVersion`, `currentVersion`, `releaseNotes`, `checking`, `applying`, `publishedAt`, `assetSize`, `distSize`, `isExternalUI`
- **Polling**: Check on app load + every 6 hours via `setInterval`
- **Settings toggle**: Add "Проверять обновления автоматически" toggle to Settings page (persisted in `useSettingsStore`). When disabled, no auto-check — only manual "Проверить обновления" button on update page

### 3. Update Progress & Reload

**Decision**: Full-screen overlay with spinner + log area → poll /api/health → auto-reload.

- **Confirmation dialog**: AlertDialog before update — "Обновить до vX.X.X? Сервер будет перезапущен."
- **Overlay**: Full-screen overlay blocking UI during update:
  - Spinner + status text ("Скачивание..." → "Установка..." → "Перезапуск...")
  - Log area showing operation messages (similar to existing UpdateOverlay for mihomo kernel)
- **After apply**: Server responds `{status: "restarting"}` then process dies after ~1s
- **Health polling**: Poll `GET /api/health` every 2s, timeout 30 seconds total
  - If health returns OK → auto `window.location.reload()`
  - If timeout exceeded → show "Перезагрузить вручную" button (fallback)
- **Error handling**: If apply fails (HTTP error response) → show error in overlay with "Закрыть" button

### 4. External-UI Mode

**Decision**: Two separate cards when in external-ui mode. Independent updates.

- **Detection**: Add `is_external_ui: true` field to `/api/update/check` response (backend change needed). Frontend uses this to switch layout
- **Layout**: Two cards:
  - "Сервер XMeow" card — current/latest server version, "Обновить сервер" button → calls `POST /api/update/apply` (restarts process)
  - "Дашборд" card — current/latest dashboard version, "Обновить дашборд" button → calls `POST /api/update/apply-dist` (replaces SPA files, no restart)
- **Changelog**: Shared below both cards (one release = one changelog)
- **Dist update behavior**: After successful apply-dist → show success message → auto-reload page after 2 seconds
- **No "Update all" button**: Each component updated independently. Simpler, less complexity
- **Normal mode** (embedded SPA): Single card, single "Обновить" button calling `POST /api/update/apply`. Dist update not shown (SPA is embedded in binary)

## Code Context

### Existing Assets to Reuse/Extend

| Asset | Path | Relevance |
|-------|------|-----------|
| UpdateOverlay | `src/components/overview/UpdateOverlay.tsx` | Pattern for overlay+log. Reuse pattern, not component (mihomo kernel specific) |
| AppSidebar | `src/components/layout/AppSidebar.tsx` | Add dot indicator to "Обновления" menu item |
| Settings page | `src/pages/SettingsPage.tsx` | Add auto-update toggle |
| Settings store | `src/stores/settings.ts` | Add `autoCheckUpdates: boolean` field |
| config-api.ts | `src/lib/config-api.ts` | Add update API functions (checkUpdate, applyUpdate, rollback, applyDist) |
| Overview store | `src/stores/overview.ts` | Currently stores versions — new update store will handle update-specific state |

### Backend API (Phase 15 — Complete)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/update/check` | GET | Returns `ReleaseInfo` JSON: `current_version`, `latest_version`, `has_update`, `release_notes`, `published_at`, `asset_name`, `asset_size`, `dist_size`, `is_prerelease` |
| `/api/update/apply` | POST | Downloads, verifies, replaces binary. Returns `{status: "restarting"}`. Process dies after ~1s |
| `/api/update/rollback` | POST | Restores .bak backup |
| `/api/update/apply-dist` | POST | Downloads dist.tar.gz, extracts to external-ui dir. No restart |
| `/api/health` | GET | Health check — used for post-restart polling |

### Backend Change Needed

- Add `is_external_ui` boolean field to `/api/update/check` response (in `ReleaseInfo` struct and `CheckUpdate` handler)

### New Files to Create

- `src/stores/update.ts` — Zustand store for update state
- `src/lib/update-api.ts` — API client functions for update endpoints
- Refactor `src/pages/UpdatesPage.tsx` — currently a placeholder, becomes full update page
- `src/components/update/UpdateStatusCard.tsx` — version comparison card
- `src/components/update/UpdateOverlay.tsx` — progress overlay (new, separate from mihomo UpdateOverlay)
- `src/components/update/UpdateChangelog.tsx` — markdown changelog renderer

### Dependencies to Add

- `react-markdown` — GFM markdown rendering for changelog
- `remark-gfm` — GFM plugin for react-markdown (tables, checkboxes, strikethrough)

## Deferred Ideas

_None captured during discussion._

## Open Questions for Research

- Best approach to style react-markdown output to match Antigravity dark theme (prose class vs custom components)
- Whether to use `remark-gfm` or if base react-markdown is sufficient for GitHub release notes
