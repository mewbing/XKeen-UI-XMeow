---
status: diagnosed
trigger: "Overview page metrics overflow containers and uptime resets"
created: 2026-02-27T00:00:00Z
updated: 2026-02-27T00:00:00Z
---

## Current Focus

hypothesis: Multiple root causes identified -- see Resolution
test: Code analysis complete
expecting: N/A
next_action: Report findings

## Symptoms

expected: Metric cards stay within their container bounds; uptime counts continuously from mihomo start
actual: Cards overflow containers in both compact and panels mode; uptime resets to 0
errors: Visual overflow, layout breakage
reproduction: Open Overview page, observe metrics updating
started: Since implementation

## Eliminated

(none -- root causes confirmed on first pass)

## Evidence

- timestamp: 2026-02-27
  checked: MetricsCards.tsx CompactCard layout (line 30)
  found: Card has `flex-1 min-w-[120px]` but no `overflow-hidden` and no `max-w` constraint. The `flex-1` allows unlimited growth.
  implication: When text content (especially "Трафик" and "Скорость" with dual values like "1.5 MB / 2.3 GB") is long, the card stretches beyond its parent flex container.

- timestamp: 2026-02-27
  checked: MetricsCards.tsx CompactMetrics container (line 54)
  found: Container is `<div className="flex flex-wrap gap-2">` with no `overflow-hidden` and no width constraint.
  implication: The flex container itself has no overflow containment, so children can push content beyond viewport.

- timestamp: 2026-02-27
  checked: Card component (card.tsx line 10)
  found: Card base class is `flex flex-col gap-6 py-6`. CompactCard overrides `py-3` but gap-6 remains.
  implication: The gap-6 (1.5rem) between Card's internal flex items wastes vertical space inside compact cards.

- timestamp: 2026-02-27
  checked: AppLayout.tsx (lines 17-27)
  found: Content area is `<div className="flex flex-1 flex-col">` -> inner div with animate -> `<Outlet />`. No padding, no overflow-hidden, no max-width constraint.
  implication: There is no container-level overflow protection. Content can bleed out in all directions.

- timestamp: 2026-02-27
  checked: SidebarInset (sidebar.tsx line 312)
  found: SidebarInset is `relative flex w-full flex-1 flex-col` -- uses `w-full` but no `overflow-hidden` or `min-w-0`.
  implication: In a flex layout, `w-full` does NOT prevent overflow. The `min-w-0` utility is needed on flex children to allow them to shrink below content size.

- timestamp: 2026-02-27
  checked: PanelsMetrics layout (MetricsCards.tsx line 118)
  found: Grid `grid-cols-2 gap-3` with PanelCards containing `text-2xl font-bold` text. No overflow-hidden on the grid or on PanelCard content.
  implication: Large numbers in panels mode (e.g., large byte counts) can overflow their grid cells.

- timestamp: 2026-02-27
  checked: OverviewPage.tsx uptime logic (line 62)
  found: `setStartTime(Date.now())` is called in useEffect on mount. This sets startTime to the CLIENT's current time when the component mounts, NOT the actual mihomo process start time.
  implication: Every time the user navigates away and back to Overview, or on any remount, startTime resets to Date.now(), making uptime appear as 0s.

- timestamp: 2026-02-27
  checked: AppLayout.tsx key prop (line 19)
  found: `<div key={location.pathname} ...>` forces a COMPLETE unmount/remount of the Outlet content whenever the route changes.
  implication: Navigating to any page and back to /overview causes OverviewPage to fully remount, re-triggering the useEffect that resets startTime to Date.now(). This is the direct trigger for uptime reset.

- timestamp: 2026-02-27
  checked: overview store (overview.ts line 80)
  found: `startTime: null` as initial state, and `setStartTime` simply overwrites it.
  implication: No guard exists to prevent overwriting an already-set startTime. Also, using client-side Date.now() is fundamentally wrong for tracking mihomo daemon uptime.

## Resolution

root_cause: |
  **Issue 1 (Overflow):** Multiple missing overflow constraints at every level:
  1. CompactCard (MetricsCards.tsx:30) has `flex-1 min-w-[120px]` but no max-width or overflow-hidden
  2. CompactMetrics container (MetricsCards.tsx:54) is a bare flex-wrap with no overflow-hidden
  3. AppLayout content wrapper (AppLayout.tsx:17) has no overflow-hidden or min-w-0
  4. SidebarInset (sidebar.tsx:312) has no min-w-0, so it cannot shrink below its content size in the flex layout
  5. Card base class (card.tsx:10) has gap-6 which is excessive for compact mode
  6. PanelCard has no overflow protection on its content

  **Issue 2 (Uptime reset):** OverviewPage.tsx:62 calls `setStartTime(Date.now())` on every mount.
  Combined with AppLayout.tsx:19 using `key={location.pathname}` on the Outlet wrapper,
  every navigation triggers a full remount of OverviewPage, which re-calls the useEffect
  and overwrites startTime with a new Date.now(). Additionally, the uptime is client-side
  only -- it should ideally come from the mihomo API.

fix: (not applied -- diagnosis only)
verification: (not applicable)
files_changed: []
