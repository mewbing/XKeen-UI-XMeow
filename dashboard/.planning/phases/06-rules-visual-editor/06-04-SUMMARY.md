---
phase: 06-rules-visual-editor
plan: 04
subsystem: rules-editor
tags: [save-apply, diff-preview, undo-redo, keyboard-shortcuts, danger-warnings, settings]
dependency_graph:
  requires: [06-02, 06-03]
  provides: [save-apply-workflow, diff-preview, keyboard-shortcuts, danger-warnings, rules-settings]
  affects: []
tech_stack:
  added: []
  patterns: [temporal-undo-redo, beforeunload-guard, ctrl-key-shortcuts, danger-interception-on-drag]
key_files:
  created:
    - src/components/rules/RulesDiffPreview.tsx
  modified:
    - src/components/rules/RulesToolbar.tsx
    - src/components/rules/RuleBlockList.tsx
    - src/pages/RulesPage.tsx
    - src/pages/SettingsPage.tsx
decisions:
  - Danger warnings shown every time (no dont-show-again per user research decision)
  - RulesDiffPreview has dont-show-again Switch persisting to rulesShowDiffBeforeApply setting
  - Keyboard shortcuts use ctrlKey || metaKey for cross-platform (Windows/Mac)
  - changedBlockIds marks all blocks as changed when dirty (simplified approach)
  - Apply executes saveConfig then restartMihomo sequentially
metrics:
  duration: 12min
  completed: 2026-03-01
---

# Phase 6 Plan 4: Save/Apply Workflow and Settings Summary

Complete Save/Apply/Reset/Undo/Redo workflow with Monaco diff preview, danger warnings on block reorder, keyboard shortcuts (Ctrl+Z/S), naviguation guard, and 6 rules editor settings controls.

## What Was Built

### Task 1: RulesDiffPreview and Toolbar Save/Apply/Reset/Undo (296ce03)

**RulesDiffPreview** -- Monaco DiffEditor in AlertDialog for rules Apply preview:
- Props: open, onOpenChange, original, modified, onConfirmApply
- Monaco DiffEditor with yaml language, readOnly, 300px min-height
- Footer with Cancel and Apply buttons
- "Больше не показывать" Switch that calls setRulesShowDiffBeforeApply(false)
- Pattern reused from Phase 5 config-editor DiffPreview

**RulesToolbar enhancements** -- 5 action buttons added to right side:
1. Undo (Undo2 icon) -- calls temporal.undo(), disabled when pastStates empty
2. Redo (Redo2 icon) -- calls temporal.redo(), disabled when futureStates empty
3. Reset (RotateCcw icon) -- AlertDialog confirmation, calls resetChanges(), disabled when !dirty
4. Save (Save icon) -- serialize() + saveConfig() + markSaved(), toast feedback, disabled when !dirty
5. Apply (Play icon) -- badge showing changeCount, opens RulesDiffPreview when setting enabled, otherwise executes saveConfig + restartMihomo + markSaved

### Task 2: Danger Warnings and Keyboard Shortcuts (ecb4e9f)

**RuleBlockList danger warning integration:**
- Import DangerWarningDialog, DANGER_MATCH_MOVED, DANGER_EXCLUSIONS_MOVED
- handleDragEnd checks: MATCH rule to non-last position, exclusion block moved from first
- pendingMove state with oldIndex/newIndex/dangerType
- DangerWarningDialog on confirm applies move, on cancel discards
- changedBlockIds prop with amber left border highlight (border-l-4 border-l-amber-500)
- isChanged prop passed through SortableBlockCard wrapper

**RulesPage enhancements:**
- Keyboard shortcuts useEffect: Ctrl+Z (undo), Ctrl+Shift+Z/Ctrl+Y (redo), Ctrl+S (save with serialize + saveConfig)
- Navigation guard useEffect: beforeunload event when dirty is true
- changedBlockIds useMemo: marks all blocks when dirty flag is set
- dirty state subscription from rules-editor store

### Task 3: Settings Page Extensions (480017c)

**SettingsPage new "Визуальный редактор правил" section:**
- Placed between "Config editor" and "Core management" sections
- 6 controls following existing settings section patterns:
  1. Подтверждать удаление -- Switch (rulesConfirmDelete)
  2. Diff перед Apply -- Switch (rulesShowDiffBeforeApply)
  3. Группировка -- Select with 3 options (proxy-group/sections/two-level)
  4. Раскладка -- Select with 3 options (list/grid/proxies)
  5. Плотность -- Select with 2 options (min/detailed)
  6. Создание блока -- Select with 2 options (dialog/inline)
- All 12 state+setter pairs destructured from useSettingsStore

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript: npx tsc --noEmit passes (no new errors)
- RulesDiffPreview created with Monaco DiffEditor and dont-show-again Switch
- Toolbar has 5 action buttons with correct disabled states and badge counter
- Denger warnings fire on MATCH and exclusion block moves
- Keyboard shortcuts Ctrl+Z/Ctrl+Shift+Z/Ctrl+S work
- Navigation guard warns on page leave with unsaved changes
- Changed blocks highlighted with amber left border
- Settings page has 6 rules editor controls in dedicated section

## Commits

| Hash | Message |
|------|---------|
| 296ce03 | feat(06-04): add RulesDiffPreview and toolbar Save/Apply/Reset/Undo buttons |
| ecb4e9f | feat(06-04): add danger warnings, keyboard shortcuts, and navigation guard |
| 480017c | feat(06-04): add rules editor settings section to Settings page |

## Self-Check: PASSED

All 5 files verified (1 created, 4 modified). All 3 commits (296ce03, ecb4e9f, 480017c) confirmed in git log.
