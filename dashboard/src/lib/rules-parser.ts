/**
 * Rules parser for mihomo config.yaml.
 *
 * Uses the `yaml` package (eemeli/yaml) for comment-preserving
 * round-trip parsing. Distinct from `js-yaml` used in ConfigEditor.
 *
 * Provides: parsing, grouping (3 modes), serialization, and utilities.
 */

import { parseDocument, type Document } from 'yaml'

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
  spaceBefore?: boolean    // blank line before this rule (from YAML node)
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
 * Parse the `rules:` section directly from the YAML text.
 *
 * eemeli/yaml misassigns standalone comments between list items —
 * it puts them as `.comment` on the PRECEDING item instead of
 * `.commentBefore` on the FOLLOWING item. This causes standalone
 * comments to become inline when re-serialized.
 *
 * This function parses comments line-by-line from the original text,
 * giving us correct comment ownership.
 */
function parseRulesFromText(yaml: string): ParsedRule[] {
  const { start, end } = findRulesBoundaries(yaml)
  if (start === -1) return []

  const section = yaml.slice(start, end)
  const lines = section.split('\n')

  const rules: ParsedRule[] = []
  let pendingComments: string[] = []
  let pendingSpace = false

  for (let i = 1; i < lines.length; i++) { // skip "rules:" line
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '') {
      pendingSpace = true
      continue
    }

    // Standalone comment line (not a rule)
    if (trimmed.startsWith('#')) {
      pendingComments.push(trimmed.slice(1)) // text after '#', preserves leading space
      continue
    }

    // Rule line: "  - RULE_STRING" or "  - RULE_STRING # comment"
    if (trimmed.startsWith('- ')) {
      const afterDash = trimmed.slice(2) // after "- "

      // Split rule value from inline comment.
      // Mihomo rule values are comma-separated with no spaces,
      // so " #" always marks a comment, never part of the value.
      let raw: string
      let inlineComment: string | undefined

      const commentIdx = afterDash.indexOf(' #')
      if (commentIdx > 0) {
        raw = afterDash.slice(0, commentIdx)
        inlineComment = afterDash.slice(commentIdx + 2) // text after "#"
      } else {
        raw = afterDash
      }

      const parsed = parseRuleString(raw)

      rules.push({
        id: `rule-${rules.length}`,
        raw,
        ...parsed,
        commentBefore: pendingComments.length > 0 ? pendingComments.join('\n') : undefined,
        commentInline: inlineComment,
        spaceBefore: pendingSpace,
      })

      pendingComments = []
      pendingSpace = false
    }
  }

  return rules
}

/**
 * Parse rules from a full config.yaml string.
 *
 * Returns the parsed Document (kept for backward compat) and
 * the structured rules array with comments correctly assigned.
 */
export function parseRulesFromConfig(configYaml: string): {
  doc: Document
  rules: ParsedRule[]
} {
  const doc = parseDocument(configYaml)

  // Parse rules from text directly — correct comment assignment
  const rules = parseRulesFromText(configYaml)

  return { doc, rules }
}

// ── Grouping ──────────────────────────────────────────────────────

/**
 * Group rules into consecutive runs by target proxy-group.
 *
 * Same target can appear multiple times if rules are scattered
 * across the config — each consecutive run becomes a separate block.
 */
export function groupBySections(rules: ParsedRule[]): RuleBlock[] {
  if (rules.length === 0) return []

  const blocks: RuleBlock[] = []
  let currentTarget = ''
  let currentRules: ParsedRule[] = []
  let startIdx = 0

  for (let i = 0; i < rules.length; i++) {
    if (rules[i].target !== currentTarget) {
      if (currentRules.length > 0) {
        blocks.push({
          id: `block-${blocks.length}`,
          name: currentTarget,
          target: currentTarget,
          rules: currentRules,
          startIndex: startIdx,
        })
      }
      currentTarget = rules[i].target
      currentRules = [rules[i]]
      startIdx = i
    } else {
      currentRules.push(rules[i])
    }
  }

  if (currentRules.length > 0) {
    blocks.push({
      id: `block-${blocks.length}`,
      name: currentTarget,
      target: currentTarget,
      rules: currentRules,
      startIndex: startIdx,
    })
  }

  return blocks
}

// ── Serialization ──────────────────────────────────────────────────

/**
 * Find the byte boundaries of the `rules:` section in the YAML string.
 *
 * The section starts at `rules:` (column 0) and ends at the next
 * top-level key or end-of-file. This includes all indented lines,
 * comments, and blank lines within the section.
 */
function findRulesBoundaries(yaml: string): { start: number; end: number } {
  const lines = yaml.split('\n')
  let startLine = -1

  for (let i = 0; i < lines.length; i++) {
    if (/^rules\s*:/.test(lines[i])) {
      startLine = i
      break
    }
  }

  if (startLine === -1) return { start: -1, end: -1 }

  // Find end: first non-empty, non-indented line after rules:
  let endLine = lines.length
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
      endLine = i
      break
    }
  }

  // Convert line numbers to character positions
  let start = 0
  for (let i = 0; i < startLine; i++) start += lines[i].length + 1
  let end = 0
  for (let i = 0; i < endLine; i++) end += lines[i].length + 1

  return { start, end }
}

/**
 * Serialize modified blocks back into the YAML config string.
 *
 * Uses string splicing — only the `rules:` section is rebuilt,
 * everything else in the config stays byte-for-byte identical.
 * This prevents eemeli/yaml's doc.toString() from reformatting
 * unrelated sections (proxy-groups, dns, sniff, etc.).
 */
export function serializeRulesToConfig(
  _doc: Document,
  blocks: RuleBlock[],
  originalYaml?: string,
): string {
  if (!originalYaml) return _doc.toString() // fallback

  const { start, end } = findRulesBoundaries(originalYaml)
  if (start === -1) return originalYaml

  const flatRules = flattenBlocksToRules(blocks)

  // Build new rules section
  const lines: string[] = ['rules:']
  for (const rule of flatRules) {
    if (rule.spaceBefore) lines.push('')
    if (rule.commentBefore) {
      for (const cLine of rule.commentBefore.split('\n')) {
        lines.push(`  #${cLine}`)
      }
    }
    const inline = rule.commentInline ? ` #${rule.commentInline}` : ''
    lines.push(`  - ${rule.raw}${inline}`)
  }

  // Splice: keep everything before rules: and after rules section unchanged
  return originalYaml.slice(0, start) + lines.join('\n') + '\n' + originalYaml.slice(end)
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
