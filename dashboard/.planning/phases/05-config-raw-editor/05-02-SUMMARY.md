---
phase: 05-config-raw-editor
plan: 02
subsystem: ui
tags: [monaco-editor, yaml-validation, config-editor, keyboard-shortcuts, alert-dialog]

# Dependency graph
requires:
  - phase: 05-config-raw-editor
    provides: "Zustand config-editor store, config-api CRUD functions, Monaco/js-yaml packages"
provides:
  - "ConfigEditor component: Monaco Editor wrapper with YAML/plaintext, validation, Ctrl+S"
  - "EditorToolbar component: 4 tabs with dirty indicators, Save/Apply/Format buttons, validation badge"
  - "ApplyConfirmDialog: confirmation dialog for save + restart mihomo"
  - "TabSwitchDialog: 3-option dialog for dirty tab switching"
affects: [05-config-raw-editor]

# Tech tracking
tech-stack:
  added: ["monaco-editor 0.55.1 (dev, for TypeScript types)"]
  patterns: ["useRef for Monaco editor/monaco instances", "Debounced YAML validation with setModelMarkers", "Unique path per tab to prevent Monaco model confusion", "onSaveRef pattern to avoid stale closures in Monaco commands"]

key-files:
  created:
    - "src/components/config-editor/ConfigEditor.tsx"
    - "src/components/config-editor/EditorToolbar.tsx"
    - "src/components/config-editor/ApplyConfirmDialog.tsx"
    - "src/components/config-editor/TabSwitchDialog.tsx"
  modified:
    - "package.json"

key-decisions:
  - "monaco-editor added as dev dependency for TypeScript types (CDN loads at runtime via @monaco-editor/react)"
  - "Format shows warning toast before applying (comment loss) rather than confirmation dialog"
  - "useRef for onSave callback to avoid stale closures in Monaco addCommand"

patterns-established:
  - "Monaco Editor integration: unique path per tab, flex-1 min-h-0 container, vs-dark theme"
  - "Debounced validation: 300ms setTimeout with clearTimeout on re-trigger"
  - "Dirty tab guard: pendingTab state + TabSwitchDialog before switching"

requirements-completed: [EDIT-01, EDIT-02, EDIT-03, EDIT-05]

# Metrics
duration: 4min
completed: 2026-02-28
---

# Phase 05 Plan 02: Editor Core Components Summary

**Monaco Editor with YAML/plaintext syntax switching, debounced validation with inline markers, 4-tab toolbar with dirty indicators, Save/Apply/Format buttons, and confirmation dialogs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-28T04:41:28Z
- **Completed:** 2026-02-28T04:45:02Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- ConfigEditor wrapping Monaco Editor with automatic YAML/plaintext language per tab and unique path to prevent model confusion
- Debounced real-time YAML validation with inline error markers via monaco.editor.setModelMarkers
- EditorToolbar with 4 tabs showing dirty indicators, YAML validation badge, and Format/Save/Apply buttons with loading states
- ApplyConfirmDialog and TabSwitchDialog using shadcn AlertDialog for safe Apply and dirty-tab switching
- Keyboard shortcuts: Ctrl+S (save via Monaco command), Ctrl+1..4 (tab switching with dirty check)

## Task Commits

Each task was committed atomically:

1. **Task 1: Monaco Editor wrapper with validation and keyboard shortcuts** - `001ee27` (feat)
2. **Task 2: Toolbar, Save/Apply/Format buttons, and confirmation dialogs** - `11816b5` (feat)

## Files Created/Modified
- `src/components/config-editor/ConfigEditor.tsx` - Monaco Editor wrapper with YAML validation, lazy content loading, Ctrl+S shortcut
- `src/components/config-editor/EditorToolbar.tsx` - Toolbar with 4 tabs, dirty indicators, validation badge, Format/Save/Apply buttons, Ctrl+1..4
- `src/components/config-editor/ApplyConfirmDialog.tsx` - AlertDialog for Apply confirmation with YAML error warning
- `src/components/config-editor/TabSwitchDialog.tsx` - 3-option AlertDialog for dirty tab switching (save/discard/stay)
- `package.json` - Added monaco-editor as dev dependency for TypeScript types

## Decisions Made
- monaco-editor added as dev dependency for TypeScript types -- @monaco-editor/react loads Monaco from CDN at runtime, but TS needs the types locally for editor/Monaco interfaces
- Format action shows warning toast about comment loss before applying, rather than a separate confirmation dialog -- simpler UX, user sees the result immediately
- useRef pattern for onSave callback to avoid stale closures when Monaco's addCommand captures the function

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed monaco-editor as dev dependency**
- **Found during:** Task 1 (ConfigEditor creation)
- **Issue:** `import type { editor, Monaco } from 'monaco-editor'` failed -- package not installed (only @monaco-editor/react was present)
- **Fix:** `pnpm add -D monaco-editor` to get TypeScript type definitions
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** `npx tsc -b --noEmit` passes
- **Committed in:** 001ee27 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Monaco type import path**
- **Found during:** Task 1 (ConfigEditor creation)
- **Issue:** `Monaco` type is exported from `@monaco-editor/react`, not from `monaco-editor`
- **Fix:** Changed import to `import Editor, { type Monaco } from '@monaco-editor/react'`
- **Files modified:** src/components/config-editor/ConfigEditor.tsx
- **Verification:** `npx tsc -b --noEmit` passes
- **Committed in:** 001ee27 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 editor components ready for Plan 03 to assemble into ConfigEditorPage
- EditorToolbar.onApplyConfirmed callback ready for Plan 03 to wire up with log streaming
- ConfigEditor.onSave callback ready for Plan 03 to connect to EditorToolbar.handleSave

## Self-Check: PASSED

All files verified present. All commit hashes found in git log.

---
*Phase: 05-config-raw-editor*
*Completed: 2026-02-28*
