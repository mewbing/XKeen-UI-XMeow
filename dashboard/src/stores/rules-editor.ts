/**
 * Rules Editor store with undo/redo support.
 *
 * Volatile store (no persist) — rules loaded fresh from config on page visit.
 * Uses zundo temporal middleware for Ctrl+Z / Ctrl+Y undo/redo.
 */

import { create } from 'zustand'
import { temporal } from 'zundo'
import type { Document } from 'yaml'
import {
  parseRulesFromConfig,
  groupBySections,
  serializeRulesToConfig,
  flattenBlocksToRules,
  buildRuleRaw,
  type RuleBlock,
  type ParsedRule,
} from '@/lib/rules-parser'

// ── Module-level storage (non-serializable) ────────────────────────

/** YAML Document stored outside Zustand (not serializable) */
let storedDoc: Document | null = null

/** Original rule raws for structural dirty comparison (avoids YAML formatting differences) */
let originalRuleRaws: string[] = []

/** Flag to skip temporal save during non-edit operations (loadRules, resetChanges, syncAfterUndoRedo) */
let skipTemporalSave = false

/** Debounce timer for temporal save — module-level so we can cancel it before undo/redo */
let temporalTimer: ReturnType<typeof setTimeout> | null = null

// ── Types ──────────────────────────────────────────────────────────

interface RulesEditorState {
  // Data
  blocks: RuleBlock[]
  originalYaml: string        // for diff preview
  currentYaml: string         // serialized current state for diff
  proxyGroups: string[]       // list of available proxy-group names (for dropdowns)

  // UI state (not tracked by undo)
  dirty: boolean
  changeCount: number         // for Apply badge counter
  loading: boolean
  error: string | null

  // Actions
  loadRules: (configYaml: string) => void
  reorderBlocks: (oldIndex: number, newIndex: number) => void
  reorderRules: (blockId: string, oldIndex: number, newIndex: number) => void
  addRule: (blockId: string, type: string, value: string, target: string, noResolve: boolean, comment?: string) => void
  removeRule: (blockId: string, ruleId: string) => void
  changeBlockTarget: (blockId: string, newTarget: string) => void
  changeRuleTarget: (blockId: string, ruleId: string, newTarget: string) => void
  moveRuleBetweenBlocks: (fromBlockId: string, ruleId: string, toBlockId: string, insertIndex: number) => void
  createBlock: (name: string, target: string) => void
  removeBlock: (blockId: string) => void
  syncAfterUndoRedo: () => void
  resetChanges: () => void
  markSaved: () => void
  serialize: () => string
  getCurrentYaml: () => string
}

// ── Helpers ────────────────────────────────────────────────────────

/** Group rules into consecutive target blocks */
function applyGrouping(rules: ParsedRule[]): RuleBlock[] {
  return groupBySections(rules)
}

/** Extract unique proxy-group names from rules */
function extractProxyGroups(rules: ParsedRule[]): string[] {
  const targets = new Set<string>()
  for (const rule of rules) {
    targets.add(rule.target)
  }
  return Array.from(targets).sort()
}

/** Return the same array reference if contents haven't changed — prevents memo-breaking re-renders */
function stableProxyGroups(newGroups: string[], currentGroups: string[]): string[] {
  if (newGroups.length !== currentGroups.length) return newGroups
  for (let i = 0; i < newGroups.length; i++) {
    if (newGroups[i] !== currentGroups[i]) return newGroups
  }
  return currentGroups
}

/** Lazily serialize blocks to YAML — only called on Save/Apply/Diff, NOT on every mutation */
function reserialize(blocks: RuleBlock[], originalYaml: string): string {
  if (!storedDoc) return ''
  return serializeRulesToConfig(storedDoc, blocks, originalYaml)
}

/** Sentinel value meaning "currentYaml needs recomputation" */
const STALE = '__STALE__'

/** Generate unique rule id based on existing rules */
function nextRuleId(blocks: RuleBlock[]): string {
  let maxId = 0
  for (const block of blocks) {
    for (const rule of block.rules) {
      const num = parseInt(rule.id.split('-')[1])
      if (num > maxId) maxId = num
    }
  }
  return `rule-${maxId + 1}`
}

// ── Store ──────────────────────────────────────────────────────────

export const useRulesEditorStore = create<RulesEditorState>()(
  temporal(
    (set, get) => ({
      // Initial state
      blocks: [],
      originalYaml: '',
      currentYaml: '',
      proxyGroups: [],
      dirty: false,
      changeCount: 0,
      loading: false,
      error: null,

      loadRules: (configYaml: string) => {
        try {
          const { doc, rules } = parseRulesFromConfig(configYaml)
          storedDoc = doc
          originalRuleRaws = rules.map(r => r.raw)

          const blocks = applyGrouping(rules)
          const proxyGroups = extractProxyGroups(rules)

          // Skip temporal save — loading is not a user edit
          skipTemporalSave = true
          set({
            blocks,
            originalYaml: configYaml,
            currentYaml: configYaml,
            proxyGroups,
            dirty: false,
            changeCount: 0,
            loading: false,
            error: null,
          })
          skipTemporalSave = false

          // Clear any stale undo history
          useRulesEditorStore.temporal.getState().clear()
        } catch (e) {
          set({
            error: e instanceof Error ? e.message : 'Failed to parse rules',
            loading: false,
          })
        }
      },

      reorderBlocks: (oldIndex: number, newIndex: number) => {
        const { blocks, changeCount } = get()
        const newBlocks = [...blocks]
        const [moved] = newBlocks.splice(oldIndex, 1)
        newBlocks.splice(newIndex, 0, moved)

        set({
          blocks: newBlocks,
          currentYaml: STALE,
          dirty: true,
          changeCount: changeCount + 1,
        })
      },

      reorderRules: (blockId: string, oldIndex: number, newIndex: number) => {
        const { blocks, changeCount } = get()
        const newBlocks = blocks.map(block => {
          if (block.id !== blockId) return block

          const newRules = [...block.rules]
          const [moved] = newRules.splice(oldIndex, 1)
          newRules.splice(newIndex, 0, moved)

          return { ...block, rules: newRules }
        })

        set({
          blocks: newBlocks,
          currentYaml: STALE,
          dirty: true,
          changeCount: changeCount + 1,
        })
      },

      addRule: (blockId: string, type: string, value: string, target: string, noResolve: boolean, comment?: string) => {
        const { blocks, changeCount } = get()
        const raw = buildRuleRaw(type, value, target, noResolve)
        const id = nextRuleId(blocks)

        const newRule: ParsedRule = {
          id,
          raw,
          type,
          value,
          target,
          noResolve,
          ...(comment ? { commentInline: comment } : {}),
        }

        const newBlocks = blocks.map(block => {
          if (block.id !== blockId) return block
          return { ...block, rules: [...block.rules, newRule] }
        })

        set({
          blocks: newBlocks,
          currentYaml: STALE,
          proxyGroups: stableProxyGroups(extractProxyGroups(flattenBlocksToRules(newBlocks)), get().proxyGroups),
          dirty: true,
          changeCount: changeCount + 1,
        })
      },

      removeRule: (blockId: string, ruleId: string) => {
        const { blocks, changeCount } = get()
        const newBlocks = blocks.map(block => {
          if (block.id !== blockId) return block
          return { ...block, rules: block.rules.filter(r => r.id !== ruleId) }
        }).filter(b => b.rules.length > 0)

        set({
          blocks: newBlocks,
          currentYaml: STALE,
          proxyGroups: stableProxyGroups(extractProxyGroups(flattenBlocksToRules(newBlocks)), get().proxyGroups),
          dirty: true,
          changeCount: changeCount + 1,
        })
      },

      changeBlockTarget: (blockId: string, newTarget: string) => {
        const { blocks, changeCount } = get()
        const newBlocks = blocks.map(block => {
          if (block.id !== blockId) return block

          const updatedRules = block.rules.map(rule => {
            const raw = buildRuleRaw(rule.type, rule.value, newTarget, rule.noResolve)
            return { ...rule, target: newTarget, raw }
          })

          return { ...block, target: newTarget, name: newTarget, rules: updatedRules }
        })

        set({
          blocks: newBlocks,
          currentYaml: STALE,
          proxyGroups: stableProxyGroups(extractProxyGroups(flattenBlocksToRules(newBlocks)), get().proxyGroups),
          dirty: true,
          changeCount: changeCount + 1,
        })
      },

      changeRuleTarget: (blockId: string, ruleId: string, newTarget: string) => {
        const { blocks, changeCount } = get()
        const newBlocks = blocks.map(block => {
          if (block.id !== blockId) return block

          const updatedRules = block.rules.map(rule => {
            if (rule.id !== ruleId) return rule
            const raw = buildRuleRaw(rule.type, rule.value, newTarget, rule.noResolve)
            return { ...rule, target: newTarget, raw }
          })

          return { ...block, rules: updatedRules }
        })

        set({
          blocks: newBlocks,
          currentYaml: STALE,
          proxyGroups: stableProxyGroups(extractProxyGroups(flattenBlocksToRules(newBlocks)), get().proxyGroups),
          dirty: true,
          changeCount: changeCount + 1,
        })
      },

      moveRuleBetweenBlocks: (fromBlockId: string, ruleId: string, toBlockId: string, insertIndex: number) => {
        const { blocks, changeCount } = get()
        const fromBlock = blocks.find(b => b.id === fromBlockId)
        const toBlock = blocks.find(b => b.id === toBlockId)
        if (!fromBlock || !toBlock) return

        const ruleIndex = fromBlock.rules.findIndex(r => r.id === ruleId)
        if (ruleIndex === -1) return
        const movedRule = fromBlock.rules[ruleIndex]

        // Update rule target to match destination block
        const updatedRule: ParsedRule = {
          ...movedRule,
          target: toBlock.target,
          raw: buildRuleRaw(movedRule.type, movedRule.value, toBlock.target, movedRule.noResolve),
        }

        const newBlocks = blocks.map(block => {
          if (block.id === fromBlockId) {
            return { ...block, rules: block.rules.filter(r => r.id !== ruleId) }
          }
          if (block.id === toBlockId) {
            const newRules = [...block.rules]
            newRules.splice(insertIndex, 0, updatedRule)
            return { ...block, rules: newRules }
          }
          return block
        }).filter(b => b.rules.length > 0)

        set({
          blocks: newBlocks,
          currentYaml: STALE,
          proxyGroups: stableProxyGroups(extractProxyGroups(flattenBlocksToRules(newBlocks)), get().proxyGroups),
          dirty: true,
          changeCount: changeCount + 1,
        })
      },

      createBlock: (name: string, target: string) => {
        const { blocks, changeCount } = get()
        const newBlock: RuleBlock = {
          id: `block-new-${Date.now()}`,
          name,
          target,
          rules: [],
          startIndex: flattenBlocksToRules(blocks).length,
        }

        const newBlocks = [...blocks, newBlock]
        set({
          blocks: newBlocks,
          currentYaml: STALE,
          proxyGroups: stableProxyGroups(extractProxyGroups(flattenBlocksToRules(newBlocks)), get().proxyGroups),
          dirty: true,
          changeCount: changeCount + 1,
        })
      },

      removeBlock: (blockId: string) => {
        const { blocks, changeCount } = get()
        const newBlocks = blocks.filter(b => b.id !== blockId)

        set({
          blocks: newBlocks,
          currentYaml: STALE,
          proxyGroups: stableProxyGroups(extractProxyGroups(flattenBlocksToRules(newBlocks)), get().proxyGroups),
          dirty: true,
          changeCount: changeCount + 1,
        })
      },

      syncAfterUndoRedo: () => {
        // Cancel pending debounced temporal save — otherwise it fires after
        // undo/redo and pushes stale state, wiping the redo stack
        if (temporalTimer) {
          clearTimeout(temporalTimer)
          temporalTimer = null
        }
        const { blocks } = get()
        const currentRaws = flattenBlocksToRules(blocks).map(r => r.raw)
        const isDirty = currentRaws.length !== originalRuleRaws.length ||
          currentRaws.some((r, i) => r !== originalRuleRaws[i])
        // Skip temporal save — this is a UI-only update (dirty/changeCount),
        // not a user edit. Without this, set() triggers a new temporal save
        // that wipes the redo stack.
        skipTemporalSave = true
        set({
          currentYaml: STALE,
          dirty: isDirty,
          changeCount: isDirty ? 1 : 0,
        })
        skipTemporalSave = false
      },

      resetChanges: () => {
        const { originalYaml } = get()
        if (!originalYaml) return

        const { doc, rules } = parseRulesFromConfig(originalYaml)
        storedDoc = doc
        originalRuleRaws = rules.map(r => r.raw)

        const blocks = applyGrouping(rules)
        skipTemporalSave = true
        set({
          blocks,
          currentYaml: originalYaml,
          dirty: false,
          changeCount: 0,
          error: null,
        })
        skipTemporalSave = false
        useRulesEditorStore.temporal.getState().clear()
      },

      markSaved: () => {
        const { blocks, currentYaml } = get()
        originalRuleRaws = flattenBlocksToRules(blocks).map(r => r.raw)
        set({
          originalYaml: currentYaml,
          dirty: false,
          changeCount: 0,
        })
      },

      serialize: () => {
        const { blocks, currentYaml, originalYaml } = get()
        if (currentYaml !== STALE) return currentYaml
        const yaml = reserialize(blocks, originalYaml)
        set({ currentYaml: yaml })
        return yaml
      },

      /** Get current YAML for diff preview — lazy computation */
      getCurrentYaml: () => {
        const { blocks, currentYaml, originalYaml } = get()
        if (currentYaml !== STALE) return currentYaml
        const yaml = reserialize(blocks, originalYaml)
        set({ currentYaml: yaml })
        return yaml
      },
    }),
    {
      // Only track `blocks` for undo/redo (not UI state)
      partialize: (state) => ({
        blocks: state.blocks,
      }),
      limit: 50,
      // Debounce undo snapshots — batch rapid mutations (drag, type-ahead, etc.)
      handleSet: (handleSet) => {
        return (state) => {
          if (skipTemporalSave) return
          if (temporalTimer) clearTimeout(temporalTimer)
          temporalTimer = setTimeout(() => {
            temporalTimer = null
            handleSet(state)
          }, 400)
        }
      },
    }
  )
)
