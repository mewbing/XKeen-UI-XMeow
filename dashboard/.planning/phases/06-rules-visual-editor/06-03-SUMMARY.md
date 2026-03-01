---
phase: 06-rules-visual-editor
plan: 03
subsystem: rules-editor
tags: [dialogs, editing, dnd, delete-confirmation, proxy-groups]
dependency_graph:
  requires: [06-01, 06-02]
  provides: [rule-editing-dialogs, inline-rule-editing, nested-dnd-reorder]
  affects: [06-04]
tech_stack:
  added: []
  patterns: [nested-dndcontext, confirmation-with-dont-ask-again, useSortable-per-rule]
key_files:
  created:
    - src/components/rules/AddRuleDialog.tsx
    - src/components/rules/NewBlockDialog.tsx
    - src/components/rules/DangerWarningDialog.tsx
  modified:
    - src/components/rules/RuleRow.tsx
    - src/components/rules/RuleBlockCard.tsx
    - src/components/rules/RuleBlockList.tsx
decisions:
  - Nested DndContext for intra-block rule reordering
  - Delete confirmation with dont-ask-again persisted to settings
  - RuleRow target dropdown only shown when hasMixedTargets
  - AddRuleDialog no-resolve switch only for IP-based types
  - Block name and chevron are separate clickable elements
metrics:
  duration: 8min
  completed: 2026-03-01
---

# Phase 6 Plan 3: Editing Dialogs and Controls Summary

Editing dialogs (AddRule, NewBlock, DangerWarning) plus inline editing controls on RuleRow and RuleBlockCard with nested DnD for rule reordering within blocks.

## What Was Built

### Task 1: AddRuleDialog, NewBlockDialog, DangerWarningDialog (10fb69d)

**AddRuleDialog** -- Full dialog for adding rules to blocks:
- 14 rule types in Select dropdown (DOMAIN-SUFFIX through MATCH)
- Value input (disabled for MATCH type)
- Target proxy-group dropdown from proxyGroups prop
- no-resolve Switch visible only for IP-based types
- Form reset on close via useEffect
- Calls addRule action on submit

**NewBlockDialog** -- Dialog for creating new rule blocks:
- Block name Input and Target proxy-group Select
- Calls createBlock action on submit
- Used when rulesNewBlockMode is dialog

**DangerWarningDialog** -- AlertDialog for dangerous drag operations:
- Amber AlertTriangle warning icon
- Dynamic title/description props
- Exports DANGER_MATCH_MOVED and DANGER_EXCLUSIONS_MOVED constants
- No dont-show-again -- warnings shown every time

### Task 2: Enhanced RuleRow and RuleBlockCard (daead98)

**RuleRow enhancements:**
- useSortable from dnd-kit for drag-reorder within blocks
- GripVertical drag handle
- Target proxy-group Select dropdown (shown only when hasMixedTargets)
- Trash2 delete button (opacity-0, visible on group-hover)
- New props: blockId, proxyGroups, onChangeTarget, onRemove

**RuleBlockCard enhancements:**
- Nested DndContext + SortableContext for intra-block rule reordering
- Block-level target Select dropdown on header (bulk change)
- Trash2 delete button on header with confirmation AlertDialog
- Dont-ask-again Switch in both delete dialogs (block and rule)
- Plus button opens AddRuleDialog for the block
- Block name is clickable button for expand/collapse
- Separate chevron button for expand/collapse
- Russian plural function for rule counts

**RuleBlockList updates:**
- proxyGroups prop passed through SortableBlockCard wrapper
- proxyGroups prop passed to DragOverlay RuleBlockCard

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript: npx tsc -b --noEmit passes (only pre-existing errors out of scope)
- All 3 dialog files created with correct imports and typing
- RuleRow has useSortable, target dropdown, delete button
- RuleBlockCard has nested DnD, bulk target, add rule, delete block
- Confirmation dialogs have dont-ask-again switch persisting to settings store

## Commits

| Hash | Message |
|------|---------|
| 10fb69d | feat(06-03): add rule editing dialogs |
| daead98 | feat(06-03): enhance RuleRow and RuleBlockCard with editing controls |

## Self-Check: PASSED

All 6 files verified (3 created, 3 modified). Both commits (10fb69d, daead98) confirmed in git log.
