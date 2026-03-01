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
  groupByProxyGroup,
  groupBySections,
  groupTwoLevel,
  serializeRulesToConfig,
  flattenBlocksToRules,
  buildRuleRaw,
  type RuleBlock,
  type ParsedRule,
} from '@/lib/rules-parser'
import { useSettingsStore } from '@/stores/settings'

// ── Module-level storage (non-serializable) ────────────────────────

/** YAML Document stored outside Zustand (not serializable) */
let storedDoc: Document | null = null

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
  addRule: (blockId: string, type: string, value: string, target: string, noResolve: boolean) => void
  removeRule: (blockId: string, ruleId: string) => void
  changeBlockTarget: (blockId: string, newTarget: string) => void
  changeRuleTarget: (blockId: string, ruleId: string, newTarget: string) => void
  createBlock: (name: string, target: string) => void
  removeBlock: (blockId: string) => void
  resetChanges: () => void
  markSaved: () => void
  serialize: () => string
  getCurrentYaml: () => string
}

// ── Helpers ────────────────────────────────────────────────────────

/** Apply current grouping mode to rules */
function applyGrouping(rules: ParsedRule[]): RuleBlock[] {
  const mode = useSettingsStore.getState().rulesGrouping
  switch (mode) {
    case 'sections':
      return groupBySections(rules)
    case 'two-level':
      return groupTwoLevel(rules)
    case 'proxy-group':
    default:
      return groupByProxyGroup(rules)
  }
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
function reserialize(blocks: RuleBlock[]): string {
  if (!storedDoc) return ''
  return serializeRulesToConfig(storedDoc, blocks)
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

          const blocks = applyGrouping(rules)
          const proxyGroups = extractProxyGroups(rules)

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

      addRule: (blockId: string, type: string, value: string, target: string, noResolve: boolean) => {
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
        })

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

      resetChanges: () => {
        const { originalYaml } = get()
        if (!originalYaml) return

        const { doc, rules } = parseRulesFromConfig(originalYaml)
        storedDoc = doc

        const blocks = applyGrouping(rules)
        set({
          blocks,
          currentYaml: originalYaml,
          dirty: false,
          changeCount: 0,
          error: null,
        })
      },

      markSaved: () => {
        const { currentYaml } = get()
        set({
          originalYaml: currentYaml,
          dirty: false,
          changeCount: 0,
        })
      },

      serialize: () => {
        const { blocks, currentYaml } = get()
        if (currentYaml !== STALE) return currentYaml
        const yaml = reserialize(blocks)
        set({ currentYaml: yaml })
        return yaml
      },

      /** Get current YAML for diff preview — lazy computation */
      getCurrentYaml: () => {
        const { blocks, currentYaml } = get()
        if (currentYaml !== STALE) return currentYaml
        const yaml = reserialize(blocks)
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
        let timer: ReturnType<typeof setTimeout>
        return (state) => {
          clearTimeout(timer)
          timer = setTimeout(() => handleSet(state), 400)
        }
      },
    }
  )
)
