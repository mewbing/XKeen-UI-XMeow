---
status: diagnosed
trigger: "Traffic chart is empty - shows only empty block with scale, nothing updates"
created: 2026-02-27T12:00:00Z
updated: 2026-02-27T12:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Chart line stroke colors use invalid CSS (hsl wrapping oklch)
test: Verified CSS variable values contain full oklch() colors, not HSL channel values
expecting: hsl(oklch(...)) is invalid CSS => stroke becomes transparent
next_action: Return diagnosis

## Symptoms

expected: Traffic chart shows upload/download speed lines updating in real-time
actual: Chart renders as empty block with Y-axis scale visible, no lines, nothing updates
errors: No console errors reported (invalid CSS color silently fails)
reproduction: Open Overview page, observe chart area
started: Since initial implementation

## Eliminated

(none - first hypothesis confirmed)

## Evidence

- timestamp: 2026-02-27T12:00:00Z
  checked: TrafficChart.tsx lines 47-56, stroke color values
  found: stroke="hsl(var(--chart-1))" and stroke="hsl(var(--chart-2))"
  implication: These wrap CSS var in hsl() function

- timestamp: 2026-02-27T12:00:00Z
  checked: index.css lines 70-71, 104-105 - CSS variable definitions
  found: "--chart-1: oklch(0.646 0.222 41.116)" and "--chart-2: oklch(0.6 0.118 184.704)"
  implication: Variables contain FULL oklch() color values, not HSL channel values

- timestamp: 2026-02-27T12:00:00Z
  checked: CSS color resolution
  found: hsl(var(--chart-1)) resolves to hsl(oklch(0.646 0.222 41.116)) which is INVALID CSS
  implication: Browser silently ignores invalid color => stroke is transparent => lines invisible

- timestamp: 2026-02-27T12:00:00Z
  checked: overview.ts lines 74-78 - initial trafficHistory state
  found: Pre-filled with 60 zero-value points, so chart always has data array
  implication: Chart renders with data but lines are invisible due to bad color

- timestamp: 2026-02-27T12:00:00Z
  checked: OverviewPage.tsx lines 23-28 - TrafficMessage interface
  found: Expects {up, down, upTotal, downTotal} but mihomo /traffic WS only sends {up, down}
  implication: Secondary issue - upTotal/downTotal will be undefined, but up/down still work for chart

## Resolution

root_cause: |
  PRIMARY: TrafficChart.tsx uses hsl(var(--chart-1)) and hsl(var(--chart-2)) for line stroke colors,
  but the CSS variables --chart-1 and --chart-2 contain complete oklch() color values (Tailwind v4 convention).
  This creates invalid CSS like hsl(oklch(0.646 0.222 41.116)), making lines transparent/invisible.

  SECONDARY: TrafficMessage interface expects upTotal/downTotal fields from /traffic WebSocket,
  but mihomo only sends {up, down}. This causes undefined values for total traffic metrics
  in MetricsCards but does NOT affect the chart itself.

fix: (not applied - diagnosis only)
verification: (not applied - diagnosis only)
files_changed: []
