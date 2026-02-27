---
status: diagnosed
phase: 02-overview-service-management
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md
started: 2026-02-27T12:00:00Z
updated: 2026-02-27T12:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Overview page - real-time metrics
expected: Overview page shows live metrics cards: Upload speed, Download speed, Memory usage, Active connections, Uptime. Values update in real-time (traffic speed changes every second via WebSocket).
result: issue
reported: "блоки выходят за грани метрики при обновлении аптайм обнуляется скорость трафика просто пустая шкала"
severity: major

### 2. Metrics display mode toggle
expected: On overview page, a toggle switches between compact mode (single row of metrics) and panels mode (2x2 grid of metric cards). Selection persists.
result: issue
reported: "да, но все так же выходит за границы и кривое"
severity: major

### 3. Traffic chart
expected: Below metrics, a line chart shows upload/download speed history over the last ~60 seconds. Lines update in real-time as traffic flows.
result: issue
reported: "график ничего не показывает просто пустой блок со шкалой, ничего не обновляется"
severity: major

### 4. Service control in header
expected: In the header bar, a service control element shows the current xkeen service status as a colored badge (green=active, red=inactive, etc.). Clicking opens a dropdown menu with Start, Stop, Restart actions.
result: pass

### 5. Service action confirmations
expected: Clicking Stop or Restart in the service dropdown shows an AlertDialog confirmation before executing. Start executes immediately without confirmation.
result: issue
reported: "xkeen запушен но не отображается зеленой точкой не запускает при нажатии запустить поэтому не могу проверить подтверждение"
severity: major

### 6. Kernel update button and overlay
expected: A kernel update button is visible in the header. Clicking it opens a confirmation dialog, then shows a full-screen overlay with spinner and progress log during the update process.
result: pass

### 7. Sidebar version display
expected: In the sidebar footer, three version lines are shown: mihomo, xkeen, and Dashboard versions. Each shows the version number (with 'v' prefix). When sidebar is collapsed to icon mode, version info is hidden.
result: pass

## Summary

total: 7
passed: 3
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "Overview page shows live metrics cards with real-time updates, uptime counter, and traffic speed chart with lines"
  status: failed
  reason: "User reported: блоки выходят за грани метрики при обновлении аптайм обнуляется скорость трафика просто пустая шкала"
  severity: major
  test: 1
  root_cause: "Missing overflow constraints at multiple levels: CompactCard flex-1 without max-width/overflow-hidden, AppLayout no overflow-hidden/min-w-0, SidebarInset no min-w-0. Uptime resets because OverviewPage uses setStartTime(Date.now()) on mount + key={location.pathname} forces full remount on navigation."
  artifacts:
    - path: "src/components/overview/MetricsCards.tsx"
      issue: "CompactCard flex-1 min-w-[120px] without overflow-hidden or max-width"
    - path: "src/components/layout/AppLayout.tsx"
      issue: "Content area no overflow-hidden, key={location.pathname} forces remount"
    - path: "src/pages/OverviewPage.tsx"
      issue: "setStartTime(Date.now()) on every mount resets uptime"
  missing:
    - "Add overflow-hidden and min-w-0 to flex containers"
    - "Persist startTime in store or remove key={pathname} from layout"
  debug_session: ".planning/debug/overview-metrics-overflow-uptime.md"
- truth: "Toggle switches between compact row and 2x2 panels grid without layout overflow"
  status: failed
  reason: "User reported: да, но все так же выходит за границы и кривое"
  severity: major
  test: 2
  root_cause: "Same overflow issue as test 1 - affects both compact and panels modes. PanelCard has no overflow protection, grid cells can overflow with large numbers."
  artifacts:
    - path: "src/components/overview/MetricsCards.tsx"
      issue: "PanelCard and grid containers missing overflow-hidden"
  missing:
    - "Add overflow-hidden to PanelCard and grid containers"
  debug_session: ".planning/debug/overview-metrics-overflow-uptime.md"
- truth: "Traffic chart shows upload/download speed lines updating in real-time over ~60 seconds"
  status: failed
  reason: "User reported: график ничего не показывает просто пустой блок со шкалой, ничего не обновляется"
  severity: major
  test: 3
  root_cause: "TrafficChart uses hsl(var(--chart-1)) but CSS vars contain full oklch() values (Tailwind v4). Result: hsl(oklch(...)) is invalid CSS, lines become transparent."
  artifacts:
    - path: "src/components/overview/TrafficChart.tsx"
      issue: "stroke='hsl(var(--chart-1))' wraps oklch value in hsl()"
    - path: "src/index.css"
      issue: "--chart-1: oklch(0.646 0.222 41.116) - full color value, not HSL channels"
  missing:
    - "Use var(--chart-1) directly without hsl() wrapper, or use Tailwind color classes"
  debug_session: ".planning/debug/traffic-chart-empty.md"
- truth: "Service status badge reflects actual state (green=active), and Start action executes service start"
  status: failed
  reason: "User reported: xkeen запушен но не отображается зеленой точкой не запускает при нажатии запустить поэтому не могу проверить подтверждение"
  severity: major
  test: 5
  root_cause: "Two issues: 1) Backend uses pidof mihomo but service is xkeen (wrong process name). 2) Vite proxy routes ALL /api/* to mihomo:9090 instead of Flask:5000, so service actions never reach backend."
  artifacts:
    - path: "backend/server.py"
      issue: "Line 95: pidof mihomo checks wrong process"
    - path: "vite.config.ts"
      issue: "Proxy sends /api/* to mihomo:9090 not Flask:5000"
    - path: "src/lib/config-api.ts"
      issue: "No res.ok check in fetchServiceStatus"
  missing:
    - "Fix process name in pidof check"
    - "Add separate vite proxy for /api/service/* to Flask backend"
    - "Add error handling in config-api.ts"
  debug_session: ".planning/debug/service-status-badge-broken.md"
