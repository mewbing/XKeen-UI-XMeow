---
phase: 06-rules-visual-editor
plan: 01
subsystem: ui
tags: [yaml, dnd-kit, zundo, zustand, rules-parser, undo-redo]

# Dependency graph
requires:
  - phase: 05-config-raw-editor
    provides: config API (fetchConfig, saveConfig), settings store pattern
provides:
  - Comment-preserving YAML rules parser (yaml package)
  - Rules editor Zustand store with undo/redo (zundo temporal)
  - 3 grouping modes (proxy-group, sections, two-level)
  - Rules editor settings (grouping, layout, density, confirmations)
  - DnD-kit and utilities installed for drag-and-drop
affects: [06-02, 06-03, 06-04]

# Tech tracking
tech-stack:
  added: [yaml@2.8.2, "@dnd-kit/core@6.3.1", "@dnd-kit/sortable@10.0.0", "@dnd-kit/utilities@3.2.2", "@dnd-kit/modifiers@9.0.0", zundo@2.3.0]
  patterns: [comment-preserving YAML round-trip, zundo temporal middleware for undo/redo, module-level non-serializable state]

key-files:
  created: [src/lib/rules-parser.ts, src/stores/rules-editor.ts]
  modified: [src/stores/settings.ts, package.json, pnpm-lock.yaml]

key-decisions:
  - "yaml (eemeli) for rules parsing, js-yaml stays for ConfigEditor validation"
  - "Module-level Document storage (not in Zustand) since YAML Document is not serializable"
  - "zundo partialize tracks only blocks state, not UI flags (dirty, loading, error)"
  - "pnpm used as package manager (project has pnpm-lock.yaml, not package-lock.json)"

patterns-established:
  - "Import convention: 'yaml' for rules editor, 'js-yaml' for config editor"
  - "Compound rule parsing: regex for AND/OR/NOT with balanced parentheses"
  - "Section detection: multi-pattern (>>>, --- ---, emoji-prefixed) for comment grouping"
  - "Module-level storage for non-serializable objects outside Zustand"

requirements-completed: [RULE-01, RULE-02, RULE-08]

# Metrics
duration: 4min
completed: 2026-03-01
---

# Phase 6 Plan 01: Rules Parser, Editor Store, Settings Summary

**Comment-preserving YAML rules parser with 3 grouping modes, Zustand editor store with zundo undo/redo, and 6 rules editor settings**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-28T21:49:23Z
- **Completed:** 2026-02-28T21:54:17Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created rules-parser.ts with comment-preserving YAML round-trip using eemeli/yaml
- Implemented 8 exported functions: parseRuleString, parseRulesFromConfig, groupByProxyGroup, groupBySections, groupTwoLevel, serializeRulesToConfig, flattenBlocksToRules, buildRuleRaw
- Created rules-editor Zustand store with zundo temporal middleware for step-by-step undo/redo
- Extended settings store with 6 rules editor preferences (grouping, layout, density, confirmations, diff preview, new block mode)
- Installed all 6 npm packages: yaml, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, @dnd-kit/modifiers, zundo

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create rules parser** - `ad16485` (feat)
2. **Task 2: Zustand store with undo/redo and settings extensions** - `06a4b53` (feat)

**Plan metadata:** `b394a79` (docs: complete plan)

## Files Created/Modified
- `src/lib/rules-parser.ts` - Comment-preserving YAML parser with 3 grouping modes, serialization, and compound rule support (327 lines)
- `src/stores/rules-editor.ts` - Zustand store with zundo temporal middleware, all editing actions (345 lines)
- `src/stores/settings.ts` - Extended with 6 rules editor preferences and setter actions
- `package.json` - Added yaml, @dnd-kit/*, zundo dependencies
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Used `yaml` (eemeli/yaml v2.8.2) for comment-preserving round-trip; `js-yaml` stays for ConfigEditor validation (no conflict)
- Stored YAML Document object at module level (outside Zustand) because Document is not JSON-serializable
- zundo `partialize` tracks only `blocks` for undo/redo, excluding UI state (dirty, loading, error, changeCount)
- Used pnpm (not npm) since project has pnpm-lock.yaml

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- npm install failed with "Cannot read properties of null" error; switched to pnpm which is the project's actual package manager (pnpm-lock.yaml present)
- Pre-existing TS errors in EditorLogPanel.tsx, useHealthCheck.ts, ProxiesPage.tsx (unused variables) -- out of scope, do not affect new code

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Rules parser and store ready for UI component implementation in Plan 06-02
- All dnd-kit packages installed for drag-and-drop in Plan 06-02/03
- Settings store extended for toolbar controls in Plan 06-02

## Self-Check: PASSED

- FOUND: src/lib/rules-parser.ts
- FOUND: src/stores/rules-editor.ts
- FOUND: ad16485 (Task 1 commit)
- FOUND: 06a4b53 (Task 2 commit)

---
*Phase: 06-rules-visual-editor*
*Completed: 2026-03-01*
