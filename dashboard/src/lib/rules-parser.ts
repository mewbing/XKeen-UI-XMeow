/**
 * Rules parser for mihomo config.yaml.
 *
 * Uses the `yaml` package (eemeli/yaml) for comment-preserving
 * round-trip parsing. Distinct from `js-yaml` used in ConfigEditor.
 *
 * Provides: parsing, grouping (3 modes), serialization, and utilities.
 */

import { parseDocument, YAMLSeq, Scalar, isScalar, type Document } from 'yaml'

// ── Types ──────────────────────────────────────────────────────────

export interface ParsedRule {
  id: string               // unique id for dnd-kit (e.g. "rule-0")
  raw: string              // original string: "DOMAIN-SUFFIX,example.com,ProxyGroup"
  type: string             // "DOMAIN-SUFFIX", "GEOSITE", "AND", "MATCH", etc.
  value: string            // "example.com" (empty for MATCH)
  target: string           // "ProxyGroup"
  noResolve: boolean       // has ",no-resolve" suffix
  commentBefore?: string   // comment lines above this rule (from YAML node)
  commentInline?: string   // inline comment after rule (from YAML node)
}

export interface RuleBlock {
  id: string               // unique id for dnd-kit
  name: string             // display name (proxy-group or section name)
  target: string           // primary proxy-group target
  rules: ParsedRule[]      // rules inside this block
  sectionComment?: string  // "# >>> ADULT" style marker text
  startIndex: number       // position in original rules array
}

// ── Rule String Parsing ────────────────────────────────────────────

/**
 * Parse a single rule string into its components.
 *
 * Handles:
 * - Compound rules: AND,((DOMAIN-SUFFIX,ads.twitch.tv),(DST-PORT,443)),DIRECT
 * - MATCH rules: MATCH,ProxyGroup (no value field)
 * - Standard rules: TYPE,VALUE,TARGET[,no-resolve]
 */
export function parseRuleString(raw: string): {
  type: string
  value: string
  target: string
  noResolve: boolean
} {
  // Handle compound rules: AND/OR/NOT with balanced parentheses
  const compoundMatch = raw.match(/^(AND|OR|NOT),(\(\(.*\)\)),(.+)$/)
  if (compoundMatch) {
    const rest = compoundMatch[3]
    const noResolve = rest.endsWith(',no-resolve')
    const target = noResolve ? rest.slice(0, -',no-resolve'.length) : rest
    return {
      type: compoundMatch[1],
      value: compoundMatch[2],
      target,
      noResolve,
    }
  }

  // Handle MATCH (only type + target, no value)
  if (raw.startsWith('MATCH,')) {
    return { type: 'MATCH', value: '', target: raw.slice(6), noResolve: false }
  }

  // Standard: TYPE,VALUE,TARGET[,no-resolve]
  const parts = raw.split(',')
  const noResolve = parts[parts.length - 1] === 'no-resolve'
  const target = noResolve ? parts[parts.length - 2] : parts[parts.length - 1]
  const type = parts[0]
  const value = parts.slice(1, noResolve ? -2 : -1).join(',')

  return { type, value, target, noResolve }
}

// ── Config Parsing ─────────────────────────────────────────────────

/**
 * Parse rules from a full config.yaml string.
 *
 * Returns the parsed Document (for later serialization) and
 * the structured rules array with comments preserved.
 */
export function parseRulesFromConfig(configYaml: string): {
  doc: Document
  rules: ParsedRule[]
} {
  const doc = parseDocument(configYaml)
  const rulesNode = doc.get('rules', true) as YAMLSeq | undefined

  if (!rulesNode) {
    return { doc, rules: [] }
  }

  const rules: ParsedRule[] = []

  for (let i = 0; i < rulesNode.items.length; i++) {
    const item = rulesNode.items[i]
    if (!isScalar(item)) continue

    const raw = String((item as Scalar).value)
    const parsed = parseRuleString(raw)

    rules.push({
      id: `rule-${i}`,
      raw,
      ...parsed,
      commentBefore: (item as Scalar).commentBefore ?? undefined,
      commentInline: (item as Scalar).comment ?? undefined,
    })
  }

  return { doc, rules }
}

// ── Grouping: By Proxy Group ───────────────────────────────────────

/**
 * Group rules by their target proxy-group.
 * Each unique target becomes a block. Order preserved per-group.
 */
export function groupByProxyGroup(rules: ParsedRule[]): RuleBlock[] {
  const groups = new Map<string, ParsedRule[]>()

  for (const rule of rules) {
    const existing = groups.get(rule.target) ?? []
    existing.push(rule)
    groups.set(rule.target, existing)
  }

  return Array.from(groups.entries()).map(([target, groupRules], i) => ({
    id: `block-pg-${i}`,
    name: target,
    target,
    rules: groupRules,
    startIndex: groupRules[0] ? parseInt(groupRules[0].id.split('-')[1]) : 0,
  }))
}

// ── Grouping: By Sections ──────────────────────────────────────────

// Section comment patterns found in actual config
const SECTION_OPEN = /^#\s*>>>\s*(.+)/m
const SECTION_MARKER = /^#\s*---\s*(.+?)\s*---/m
const SECTION_EMOJI = /^#\s*[^\w\s#]+\s+(.+)/m

/**
 * Detect section name from a comment string.
 * Returns null if no section marker found.
 */
function detectSection(comment: string | undefined): string | null {
  if (!comment) return null

  // Check each line of the comment for section patterns
  const lines = comment.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()

    // # >>> SECTION_NAME
    const openMatch = trimmed.match(SECTION_OPEN)
    if (openMatch) return openMatch[1].trim()

    // # --- Section Name ---
    const markerMatch = trimmed.match(SECTION_MARKER)
    if (markerMatch) return markerMatch[1].trim()

    // # emoji Section Name (e.g. # ⚪🔵🔴 RU sites)
    const emojiMatch = trimmed.match(SECTION_EMOJI)
    if (emojiMatch) return emojiMatch[1].trim()
  }

  return null
}

/**
 * Group rules by comment section markers.
 * Rules before any section marker go into "Без секции" block.
 */
export function groupBySections(rules: ParsedRule[]): RuleBlock[] {
  const blocks: RuleBlock[] = []
  let currentSection = 'Без секции'
  let currentRules: ParsedRule[] = []
  let currentSectionComment: string | undefined = undefined

  for (const rule of rules) {
    const sectionName = detectSection(rule.commentBefore)

    if (sectionName) {
      // Flush current block
      if (currentRules.length > 0) {
        blocks.push({
          id: `block-sec-${blocks.length}`,
          name: currentSection,
          target: currentRules[0].target,
          rules: currentRules,
          sectionComment: currentSectionComment,
          startIndex: parseInt(currentRules[0].id.split('-')[1]),
        })
      }
      currentSection = sectionName
      currentSectionComment = rule.commentBefore
      currentRules = [rule]
    } else {
      currentRules.push(rule)
    }
  }

  // Flush last block
  if (currentRules.length > 0) {
    blocks.push({
      id: `block-sec-${blocks.length}`,
      name: currentSection,
      target: currentRules[0]?.target ?? 'DIRECT',
      rules: currentRules,
      sectionComment: currentSectionComment,
      startIndex: parseInt(currentRules[0].id.split('-')[1]),
    })
  }

  return blocks
}

// ── Grouping: Two-Level ────────────────────────────────────────────

/**
 * Two-level grouping: sections as top-level, then proxy-group within each section.
 * Block name = "Section / ProxyGroup".
 */
export function groupTwoLevel(rules: ParsedRule[]): RuleBlock[] {
  // First group by sections
  const sections = groupBySections(rules)

  const blocks: RuleBlock[] = []

  for (const section of sections) {
    // Sub-group each section's rules by proxy-group
    const subGroups = new Map<string, ParsedRule[]>()

    for (const rule of section.rules) {
      const existing = subGroups.get(rule.target) ?? []
      existing.push(rule)
      subGroups.set(rule.target, existing)
    }

    for (const [target, groupRules] of subGroups.entries()) {
      blocks.push({
        id: `block-2l-${blocks.length}`,
        name: `${section.name} / ${target}`,
        target,
        rules: groupRules,
        sectionComment: section.sectionComment,
        startIndex: groupRules[0] ? parseInt(groupRules[0].id.split('-')[1]) : 0,
      })
    }
  }

  return blocks
}

// ── Serialization ──────────────────────────────────────────────────

/**
 * Serialize modified blocks back into the YAML config document.
 *
 * Rebuilds the rules: sequence preserving comments on each node.
 * Returns the full config as a string.
 */
export function serializeRulesToConfig(
  doc: Document,
  blocks: RuleBlock[]
): string {
  const rulesNode = doc.get('rules', true) as YAMLSeq | undefined

  if (!rulesNode) return doc.toString()

  // Flatten blocks back to ordered rules
  const flatRules = flattenBlocksToRules(blocks)

  // Rebuild sequence items preserving comments
  rulesNode.items = flatRules.map(rule => {
    const scalar = doc.createNode(rule.raw) as Scalar
    if (rule.commentBefore) scalar.commentBefore = rule.commentBefore
    if (rule.commentInline) scalar.comment = rule.commentInline
    return scalar
  })

  return doc.toString()
}

// ── Utilities ──────────────────────────────────────────────────────

/**
 * Flatten blocks back into a flat array of rules.
 */
export function flattenBlocksToRules(blocks: RuleBlock[]): ParsedRule[] {
  return blocks.flatMap(b => b.rules)
}

/**
 * Build a rule string from its components.
 *
 * Handles: MATCH (no value), compound rules (value has parens), standard rules.
 */
export function buildRuleRaw(
  type: string,
  value: string,
  target: string,
  noResolve: boolean
): string {
  const suffix = noResolve ? ',no-resolve' : ''

  // MATCH has no value
  if (type === 'MATCH') {
    return `MATCH,${target}${suffix}`
  }

  // Compound rules: value already contains (()) groups
  if ((type === 'AND' || type === 'OR' || type === 'NOT') && value.startsWith('((')) {
    return `${type},${value},${target}${suffix}`
  }

  // Standard: TYPE,VALUE,TARGET[,no-resolve]
  return `${type},${value},${target}${suffix}`
}
