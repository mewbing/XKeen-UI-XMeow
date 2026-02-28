# Phase 6: Rules Visual Editor - Research

**Researched:** 2026-03-01
**Domain:** YAML rules parsing, drag-and-drop reordering, visual config editing
**Confidence:** HIGH

## Summary

Phase 6 requires building a visual editor for the `rules:` section of mihomo's config.yaml. The config contains ~261 rules and ~53 proxy-groups. Rules are plain YAML sequence items (strings like `- DOMAIN-SUFFIX,example.com,ProxyGroup`) with inline comments and comment-separator blocks (e.g. `# >>> ADULT`, `# <<< ADULT`, `# --- YouTube ---`).

The core challenge is **comment-preserving YAML round-trip**: the project currently uses `js-yaml` which strips all comments. Phase 6 must switch to the `yaml` npm package (eemeli/yaml) for the rules parsing pipeline because it preserves comments, blank lines, and formatting. The `js-yaml` usage in ConfigEditor/EditorToolbar (for Format/validation) can remain unchanged since those only need parse-and-dump without comment preservation.

**Primary recommendation:** Use `yaml` (eemeli/yaml v2.8.x) for comment-preserving YAML Document manipulation, `@dnd-kit/core` + `@dnd-kit/sortable` (stable v6.3.1 + v10.0.0) for drag-and-drop, and `zundo` (v2.3.x) for Zustand undo/redo middleware.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **3 grouping modes** with toggle: by proxy-group, by config sections (comment separators), two-level (sections as categories, proxy-group cards inside)
- **2 density modes** with toggle: minimal (name, count, proxy-group) and detailed (+ preview of first 2-3 rules)
- **3 layout modes** with toggle: vertical list/accordion, grid 2-3 columns with modal/side expansion, Proxies-style cards
- **Drag-and-drop**: blocks between each other AND individual rules inside expanded block; drag by whole card (no handle icon); position numbers (#1, #2...) recalculated after move; full freedom with warnings on dangerous operations (MATCH moved from last, personal exclusions moved from top); warnings shown every time
- **Add rule**: button in expanded block opens dialog/modal with rule type selector (DOMAIN-SUFFIX, DOMAIN-KEYWORD, GEOSITE, RULE-SET, IP-CIDR...) and value field
- **Proxy-group change**: dropdown on card (bulk change all rules) AND dropdown per rule in expanded block (individual change)
- **New block creation**: 2 variants with toggle: dialog with name+proxy-group, or empty inline-editable card
- **Delete confirmation**: dialog on by default, checkbox "Don't ask again" in dialog, toggle duplicated in Settings
- **Save/Apply**: same pattern as Config Editor (Phase 5); badge counter on Apply showing unsaved changes count; changed blocks highlighted
- **Diff preview before Apply**: on by default, checkbox "Don't show again", toggle in Settings
- **Reset button**: reverts all unsaved changes to last saved state
- **Ctrl+Z / Undo**: step-by-step undo of individual operations

### Claude's Discretion
None explicitly stated -- all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RULE-01 | Rules displayed as visual blocks (cards) grouped by service | `yaml` package for comment-aware parsing; grouping logic extracts proxy-group target from each rule string; comment-section parser for "by sections" mode |
| RULE-02 | Each block shows title, rule count, target proxy-group | Parsed rule model with `type`, `value`, `target` fields; card component pattern from ProxyGroupCard |
| RULE-03 | Drag-and-drop to reorder blocks (change rule priority) | `@dnd-kit/core` + `@dnd-kit/sortable` with `verticalListSortingStrategy`; DragOverlay for visual feedback |
| RULE-04 | Click block to expand and see individual rules inside | Collapsible/accordion pattern already used in ProxyGroupCard (CSS grid-rows animation) |
| RULE-05 | Add/remove individual rules within a block | Dialog with Select for rule type + Input for value; `yaml` Document API for inserting/removing sequence items |
| RULE-06 | Change target proxy-group for a block | Select/dropdown populated from proxy-groups list fetched via config API; bulk update all rules in block |
| RULE-07 | Create new rule block | Dialog or inline card; creates new comment section + rules in YAML document |
| RULE-08 | Changes saved back to config.yaml rules section | `yaml` Document.toString() preserves comments; existing `saveConfig` + `serviceAction('restart')` API |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| yaml (eemeli/yaml) | 2.8.x | Comment-preserving YAML parse/stringify | Only JS YAML lib that preserves comments, blank lines, formatting on round-trip |
| @dnd-kit/core | 6.3.1 | Drag-and-drop framework | Stable, production-proven; @dnd-kit/react v0.x still has known bugs |
| @dnd-kit/sortable | 10.0.0 | Sortable preset for dnd-kit | Provides verticalListSortingStrategy, arrayMove, SortableContext |
| @dnd-kit/utilities | latest | CSS utilities for transforms | Provides CSS.Transform.toString() for sortable items |
| zundo | 2.3.0 | Undo/redo for Zustand | <700B, temporal middleware wraps existing Zustand store |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/modifiers | latest | Drag constraint modifiers | restrictToVerticalAxis for vertical-only lists |
| js-yaml | 4.1.1 (existing) | YAML validation in ConfigEditor | Keep existing usage in EditorToolbar/ConfigEditor unchanged |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/core | @dnd-kit/react (v0.3.2) | New API, but v0.x has known bugs with onDragEnd source/target identity; not production-ready |
| @dnd-kit/core | react-beautiful-dnd | Deprecated/unmaintained since 2024; does not support React 19 |
| zundo | zustand-travel | More memory-efficient (JSON Patch diffs), but more complex API; overkill for ~261 rules |
| yaml (eemeli) | js-yaml | 10x faster parsing but strips ALL comments -- unacceptable for this use case |

**Installation:**
```bash
npm install yaml @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @dnd-kit/modifiers zundo
```

Note: `js-yaml` and `@types/js-yaml` stay in project for existing ConfigEditor usage.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── rules-parser.ts          # YAML→RuleBlock[] parser + serializer
├── stores/
│   └── rules-editor.ts          # Zustand store with zundo temporal middleware
├── pages/
│   └── RulesPage.tsx             # (replace placeholder) page assembly
├── components/
│   └── rules/
│       ├── RulesToolbar.tsx       # Grouping, layout, density toggles + search + Save/Apply/Reset
│       ├── RuleBlockCard.tsx      # Single block card (collapsed/expanded)
│       ├── RuleBlockList.tsx      # Sortable list of block cards (DndContext)
│       ├── RuleRow.tsx            # Single rule row inside expanded block (sortable)
│       ├── AddRuleDialog.tsx      # Dialog for adding new rule
│       ├── NewBlockDialog.tsx     # Dialog for creating new block
│       ├── RulesDiffPreview.tsx   # Diff preview before Apply (reuse DiffPreview pattern)
│       └── DangerWarningDialog.tsx # Warning on dangerous moves (MATCH, exclusions)
```

### Pattern 1: Comment-Preserving YAML Round-Trip
**What:** Parse config.yaml with `yaml` package, extract `rules:` sequence node, manipulate nodes while preserving comments/formatting, serialize back.
**When to use:** Every time rules are loaded, modified, or saved.
**Example:**
```typescript
// Source: eemeli/yaml docs - Document API
import { parseDocument, YAMLSeq, Scalar } from 'yaml'

// Parse full config preserving comments
const doc = parseDocument(configYaml)
const rulesSeq = doc.get('rules', true) as YAMLSeq

// Each item is a Scalar with .value like "DOMAIN-SUFFIX,example.com,ProxyGroup"
// and .comment, .commentBefore for inline/block comments

// Read items with comments
for (const item of rulesSeq.items) {
  if (item instanceof Scalar) {
    const parts = item.value.split(',')
    // type=parts[0], value=parts[1], target=parts[last]
  }
  // Comment-only nodes have commentBefore on next scalar
}

// Reorder: splice items array directly
const [moved] = rulesSeq.items.splice(oldIndex, 1)
rulesSeq.items.splice(newIndex, 0, moved)

// Serialize preserving all comments
const output = doc.toString()
```

### Pattern 2: Rule Parsing Model
**What:** Parse each rule string into a structured model for display and grouping.
**When to use:** Converting between YAML strings and visual blocks.
**Example:**
```typescript
interface ParsedRule {
  id: string               // unique id for dnd-kit
  raw: string              // original: "DOMAIN-SUFFIX,example.com,ProxyGroup"
  type: string             // "DOMAIN-SUFFIX"
  value: string            // "example.com"
  target: string           // "ProxyGroup"
  noResolve: boolean       // has ",no-resolve" suffix
  commentBefore?: string   // comment lines above this rule
  commentInline?: string   // inline comment after rule
}

interface RuleBlock {
  id: string               // unique id for dnd-kit
  name: string             // display name (proxy-group name or section name)
  target: string           // proxy-group target
  rules: ParsedRule[]      // rules inside this block
  sectionComment?: string  // "# >>> ADULT" style marker
  startIndex: number       // position in original rules array
}

// Complex rules: AND, OR, NOT wrap sub-rules
// e.g. "AND,((DOMAIN-SUFFIX,ads.twitch.tv),(DST-PORT,443)),DIRECT"
// type="AND", value="((DOMAIN-SUFFIX,ads.twitch.tv),(DST-PORT,443))", target="DIRECT"
```

### Pattern 3: Comment-Section Parser
**What:** Parse comment separators like `# >>> ADULT`, `# <<< CAM`, `# --- YouTube ---` to detect section boundaries.
**When to use:** "By sections" grouping mode.
**Example:**
```typescript
// Comment patterns found in actual config:
// "# >>> ADULT"        - section open
// "# <<< ADULT"        - section close
// "# --- YouTube ---"  - section marker
// "# --- Торренты ---" - section marker
// "# ⚪🔵🔴 RU сайты" - section marker
// "# 🚫 Недоступные"   - section marker

// Strategy: scan commentBefore of each scalar for these patterns
// Build section tree with regex:
const SECTION_OPEN = /^#\s*>>>\s*(.+)/
const SECTION_CLOSE = /^#\s*<<<\s*(.+)/
const SECTION_MARKER = /^#\s*---\s*(.+?)\s*---/
const SECTION_EMOJI = /^#\s*[^\w\s]+\s*(.+)/  // emoji-prefixed sections
```

### Pattern 4: Zustand Store with Undo/Redo
**What:** Rules editor store wrapped with zundo temporal middleware for Ctrl+Z/Redo.
**When to use:** All mutable state in the rules editor.
**Example:**
```typescript
// Source: zundo docs
import { create } from 'zustand'
import { temporal } from 'zundo'

interface RulesEditorState {
  blocks: RuleBlock[]
  originalYaml: string       // for diff preview
  dirty: boolean
  changeCount: number        // for Apply badge counter

  // Actions
  reorderBlocks: (oldIndex: number, newIndex: number) => void
  reorderRules: (blockId: string, oldIndex: number, newIndex: number) => void
  addRule: (blockId: string, rule: ParsedRule) => void
  removeRule: (blockId: string, ruleId: string) => void
  changeBlockTarget: (blockId: string, newTarget: string) => void
  changeRuleTarget: (blockId: string, ruleId: string, newTarget: string) => void
  resetChanges: () => void
  markSaved: () => void
}

export const useRulesEditorStore = create<RulesEditorState>()(
  temporal(
    (set, get) => ({
      // ... state and actions
    }),
    {
      // Only track data changes, not UI state
      partialize: (state) => ({
        blocks: state.blocks,
      }),
    }
  )
)

// Access undo/redo:
// const { undo, redo, pastStates, futureStates } = useRulesEditorStore.temporal.getState()
```

### Pattern 5: DnD-Kit Sortable Cards
**What:** Sortable vertical list of rule block cards with DragOverlay.
**When to use:** Main block list and individual rules inside expanded blocks.
**Example:**
```typescript
// Source: @dnd-kit docs - Sortable preset
import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'

function SortableCard({ block }: { block: RuleBlock }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <RuleBlockCard block={block} />
    </div>
  )
}

function RuleBlockList({ blocks }: { blocks: RuleBlock[] }) {
  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        {blocks.map(block => <SortableCard key={block.id} block={block} />)}
      </SortableContext>
      <DragOverlay>{/* active card clone */}</DragOverlay>
    </DndContext>
  )
}
```

### Anti-Patterns to Avoid
- **Parsing rules with js-yaml then re-serializing:** Destroys all comments. Use `yaml` (eemeli) for round-trip.
- **Storing rules as plain strings:** Lose structure. Parse into typed `ParsedRule` model for editing.
- **Using @dnd-kit/react (v0.x):** Known bugs with onDragEnd source/target being identical. Use stable @dnd-kit/core.
- **Modifying raw YAML string with regex:** Fragile, breaks on edge cases. Use Document API from `yaml` package.
- **Full config re-parse on every edit:** Expensive. Parse once on load, manipulate the Document/Seq nodes in memory, serialize only on save.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop reordering | Custom mouse/touch event handlers | @dnd-kit/core + @dnd-kit/sortable | Keyboard accessibility, touch support, animation, collision detection |
| Undo/redo history | Custom history stack | zundo temporal middleware | Already integrates with Zustand, handles partial state tracking |
| YAML comment preservation | Regex-based comment extraction | yaml (eemeli) Document API | Handles all YAML edge cases: multi-line comments, block scalars, anchors |
| Rule string parsing | Naive comma-split | Dedicated parser with awareness of AND/OR/NOT compound rules | Compound rules contain nested commas in `(())` groups |

**Key insight:** The compound rule format (`AND,((sub-rule),(sub-rule)),TARGET`) means a naive `str.split(',')` will break. The parser must handle balanced parentheses to correctly extract type, sub-expressions, and target.

## Common Pitfalls

### Pitfall 1: Compound Rule Parsing
**What goes wrong:** Splitting `AND,((DOMAIN-SUFFIX,ads.twitch.tv),(DST-PORT,443)),DIRECT` by comma gives wrong results.
**Why it happens:** AND/OR/NOT rules wrap sub-rules in `(())` which contain their own commas.
**How to avoid:** Parse compound rules separately: find the matching `))`  after `((`, extract the compound body as-is, then take the target after the closing `))`.
**Warning signs:** Rules showing garbled values or wrong targets in the UI.

### Pitfall 2: MATCH Rule Must Stay Last
**What goes wrong:** User drags MATCH rule up, all traffic below it becomes unreachable.
**Why it happens:** mihomo evaluates rules top-to-bottom; MATCH catches everything.
**How to avoid:** Show warning dialog explaining consequences when MATCH is moved from last position. Don't prevent it (user decided "full freedom"), but warn every time.
**Warning signs:** "Остальной трафик" block not at the bottom.

### Pitfall 3: Comment Association Instability
**What goes wrong:** Comments get associated with wrong nodes after modifications.
**Why it happens:** The `yaml` library attaches comments to adjacent nodes; reordering can shift associations.
**How to avoid:** When reordering, move comment nodes together with their associated rule nodes. Store `commentBefore` as part of the RuleBlock/ParsedRule model and re-attach after reorder.
**Warning signs:** Comments appearing next to wrong rules after drag-and-drop.

### Pitfall 4: Two YAML Libraries Conflict
**What goes wrong:** Importing both `yaml` and `js-yaml` causes confusion about which is used where.
**Why it happens:** Both are YAML parsers with different APIs.
**How to avoid:** Clear import conventions: `import YAML from 'yaml'` for rules editor, `import jsYaml from 'js-yaml'` for config editor validation. Never mix in the same file.
**Warning signs:** TypeScript import errors, wrong parser used.

### Pitfall 5: Performance with 261+ Rules
**What goes wrong:** Rendering 261 rules with drag-and-drop causes jank.
**Why it happens:** Each sortable item adds DOM nodes and event listeners.
**How to avoid:** Rules inside collapsed blocks are not rendered (already handled by CSS grid-rows-[0fr] pattern from ProxyGroupCard). Only expanded block renders its rules. With grouping, each block has ~5-30 rules -- manageable without virtualization.
**Warning signs:** Lag when expanding a block with many rules. If needed, add `@tanstack/react-virtual` (already in project) for blocks with 50+ rules.

### Pitfall 6: Losing Original YAML Structure Outside Rules
**What goes wrong:** Parsing and re-serializing the full config changes formatting of non-rules sections.
**Why it happens:** Even with `yaml` library, toString() may reformat whitespace slightly.
**How to avoid:** Two strategies: (1) Parse full document but only modify `rules:` sequence, then toString() the whole doc. (2) Alternative: extract rules section by line range, parse only rules, splice modified rules back into original text. Strategy 1 is cleaner if `yaml` preserves formatting well enough. Test with actual config.
**Warning signs:** Git diff showing changes outside the rules section.

## Code Examples

### Parsing Rules from Config YAML
```typescript
// Source: eemeli/yaml docs + project config analysis
import { parseDocument, YAMLSeq, Scalar, isScalar } from 'yaml'

export function parseRulesFromConfig(configYaml: string): {
  doc: ReturnType<typeof parseDocument>
  rules: ParsedRule[]
} {
  const doc = parseDocument(configYaml)
  const rulesNode = doc.get('rules', true) as YAMLSeq

  const rules: ParsedRule[] = []

  for (let i = 0; i < rulesNode.items.length; i++) {
    const item = rulesNode.items[i]
    if (!isScalar(item)) continue

    const raw = String(item.value)
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

function parseRuleString(raw: string): { type: string; value: string; target: string; noResolve: boolean } {
  // Handle compound rules: AND,((...),...),TARGET
  const compoundMatch = raw.match(/^(AND|OR|NOT),(\(\(.*\)\)),(.+)$/)
  if (compoundMatch) {
    const target = compoundMatch[3].replace(/,no-resolve$/, '')
    return {
      type: compoundMatch[1],
      value: compoundMatch[2],
      target,
      noResolve: compoundMatch[3].endsWith(',no-resolve'),
    }
  }

  // Handle MATCH (only 1 argument)
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
```

### Grouping Rules into Blocks
```typescript
export function groupByProxyGroup(rules: ParsedRule[]): RuleBlock[] {
  const groups = new Map<string, ParsedRule[]>()

  for (const rule of rules) {
    const existing = groups.get(rule.target) ?? []
    existing.push(rule)
    groups.set(rule.target, existing)
  }

  return Array.from(groups.entries()).map(([target, rules], i) => ({
    id: `block-${i}`,
    name: target,
    target,
    rules,
    startIndex: rules[0] ? parseInt(rules[0].id.split('-')[1]) : 0,
  }))
}

export function groupBySections(rules: ParsedRule[]): RuleBlock[] {
  const blocks: RuleBlock[] = []
  let currentSection = 'Без секции'
  let currentRules: ParsedRule[] = []

  for (const rule of rules) {
    const comment = rule.commentBefore ?? ''
    const sectionMatch = comment.match(/^#\s*(?:>>>|---)\s*(.+?)(?:\s*---)?$/m)

    if (sectionMatch) {
      if (currentRules.length > 0) {
        blocks.push({
          id: `section-${blocks.length}`,
          name: currentSection,
          target: currentRules[0].target,
          rules: currentRules,
          sectionComment: comment,
          startIndex: parseInt(currentRules[0].id.split('-')[1]),
        })
      }
      currentSection = sectionMatch[1].trim()
      currentRules = [rule]
    } else {
      currentRules.push(rule)
    }
  }

  if (currentRules.length > 0) {
    blocks.push({
      id: `section-${blocks.length}`,
      name: currentSection,
      target: currentRules[0]?.target ?? 'DIRECT',
      rules: currentRules,
      startIndex: parseInt(currentRules[0].id.split('-')[1]),
    })
  }

  return blocks
}
```

### Serializing Modified Rules Back to YAML
```typescript
export function serializeRulesToConfig(
  doc: ReturnType<typeof parseDocument>,
  blocks: RuleBlock[]
): string {
  const rulesNode = doc.get('rules', true) as YAMLSeq

  // Flatten blocks back to ordered rules
  const flatRules = blocks.flatMap(block => block.rules)

  // Rebuild sequence items preserving comments
  rulesNode.items = flatRules.map(rule => {
    const scalar = doc.createNode(rule.raw) as Scalar
    if (rule.commentBefore) scalar.commentBefore = rule.commentBefore
    if (rule.commentInline) scalar.comment = rule.commentInline
    return scalar
  })

  return doc.toString()
}
```

### Danger Warning on MATCH Move
```typescript
const DANGEROUS_MOVES = {
  MATCH: {
    condition: (block: RuleBlock, newIndex: number, totalBlocks: number) =>
      block.rules.some(r => r.type === 'MATCH') && newIndex < totalBlocks - 1,
    title: 'Перемещение MATCH',
    description: 'Правило MATCH перехватывает ВЕСЬ оставшийся трафик. ' +
      'Перемещение его с последней позиции сделает все правила ниже недоступными.',
  },
  EXCLUSIONS: {
    condition: (block: RuleBlock, newIndex: number) =>
      block.name.includes('ИСКЛЮЧЕНИЯ') && newIndex > 0,
    title: 'Перемещение исключений',
    description: 'Персональные исключения имеют наивысший приоритет. ' +
      'Перемещение их ниже может привести к тому, что они перестанут работать.',
  },
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit/core + @dnd-kit/sortable | 2023-2024 | rbd deprecated, dnd-kit is the standard |
| @dnd-kit/core (v5) | @dnd-kit/core v6.3.1 + @dnd-kit/sortable v10 | 2024 | Major API changes in transforms/measuring |
| @dnd-kit/react (new) | Still v0.x pre-release | 2025-2026 | Not production-ready, known bugs |
| js-yaml for everything | yaml (eemeli) for comment preservation | Ongoing | js-yaml intentionally drops comments |
| Custom undo stacks | zundo v2.x temporal middleware | 2024 | <700B, Zustand-native integration |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Unmaintained since 2024, does not support React 19
- `react-sortable-hoc`: Deprecated in favor of dnd-kit
- `@dnd-kit/core` v5: Breaking changes in v6 around transforms and measuring

## Open Questions

1. **YAML formatting stability on round-trip**
   - What we know: `yaml` (eemeli) preserves comments and blank lines
   - What's unclear: Whether it preserves exact indentation and quoting style for the entire config (not just rules section)
   - Recommendation: Test with actual config.yaml before implementation. If formatting drifts outside `rules:`, consider line-range splicing approach instead of full-document toString()

2. **Comment association on reorder**
   - What we know: `yaml` attaches comments to adjacent nodes; the library warns this "can be unstable"
   - What's unclear: Exact behavior when splicing sequence items in a YAMLSeq
   - Recommendation: Store comments in the ParsedRule model and re-attach programmatically after reorder rather than relying on automatic association

3. **zundo compatibility with Zustand v5**
   - What we know: Project uses zustand 5.0.11; zundo 2.3.0 docs say "v4.2.0+ or v5"
   - What's unclear: Any edge cases with Zustand v5 middleware stacking
   - Recommendation: Test temporal middleware with a simple store first; if issues arise, implement manual undo stack (command pattern with array of inverse operations)

## Sources

### Primary (HIGH confidence)
- `/websites/dndkit` (Context7) - sortable preset, vertical list strategy, DragOverlay, sensors
- `/eemeli/yaml` (Context7) - Document API, comment handling, CST visitor, collection operations
- Project codebase analysis - config.yaml structure (~261 rules, ~53 proxy-groups, comment patterns)

### Secondary (MEDIUM confidence)
- [npm @dnd-kit/core v6.3.1](https://www.npmjs.com/package/@dnd-kit/core) - current stable version
- [npm @dnd-kit/sortable v10.0.0](https://www.npmjs.com/package/@dnd-kit/sortable) - current stable version
- [npm yaml v2.8.2](https://www.npmjs.com/package/yaml) - current version with comment preservation
- [npm zundo v2.3.0](https://www.npmjs.com/package/zundo) - undo/redo middleware for Zustand
- [GitHub @dnd-kit/react discussion](https://github.com/clauderic/dnd-kit/discussions/1842) - confirmed v0.x not production-ready
- [GitHub js-yaml #689](https://github.com/nodeca/js-yaml/issues/689) - confirmed js-yaml intentionally doesn't preserve comments

### Tertiary (LOW confidence)
- @dnd-kit/react v0.3.2 API stability - limited community reports on production usage

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries verified via Context7/npm, version numbers confirmed
- Architecture: HIGH - patterns derived from existing project code (ProxyGroupCard, ConfigEditorPage) and official dnd-kit/yaml docs
- Pitfalls: HIGH - compound rule parsing and MATCH priority verified against actual config.yaml content; comment instability documented in official yaml library docs

**Research date:** 2026-03-01
**Valid until:** 2026-03-31 (stable libraries, no rapid changes expected)
