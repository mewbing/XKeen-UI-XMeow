/**
 * Flat rules list with colored group sections.
 *
 * Single DndContext handles both:
 * - Block-level: drag group badge → reorder entire section
 * - Rule-level: drag rules within or across groups
 *
 * Two density modes:
 * - "detailed": full rule rows with push-aside DnD animation
 * - "min": compact inline pills with insertion-line DnD indicator
 */

import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react'
import {
  DndContext,
  closestCenter,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent, DragOverEvent, DragMoveEvent, CollisionDetection } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { useRulesEditorStore } from '@/stores/rules-editor'
import { useSettingsStore } from '@/stores/settings'
import { RuleRow, getTypeBadgeClass } from './RuleRow'
import { AddRuleDialog } from './AddRuleDialog'
import type { RuleBlock } from '@/lib/rules-parser'

/** Static arrays -- avoids new allocation each render */
const VERTICAL_MODIFIERS = [restrictToVerticalAxis]
const NO_MODIFIERS: [] = []

/** Shared ref so collision detection can read current density mode */
const compactModeRef = { current: false }

// ── Color palette for group sections ──────────────────────────

const GROUP_COLORS = [
  { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30', bar: 'border-l-blue-500/40' },
  { badge: 'bg-violet-500/15 text-violet-400 border-violet-500/30', bar: 'border-l-violet-500/40' },
  { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', bar: 'border-l-emerald-500/40' },
  { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', bar: 'border-l-amber-500/40' },
  { badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30', bar: 'border-l-rose-500/40' },
  { badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', bar: 'border-l-cyan-500/40' },
  { badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30', bar: 'border-l-orange-500/40' },
  { badge: 'bg-pink-500/15 text-pink-400 border-pink-500/30', bar: 'border-l-pink-500/40' },
] as const

/** Deterministic color by target name */
function getGroupColor(target: string) {
  let hash = 0
  for (let i = 0; i < target.length; i++) hash = (hash * 31 + target.charCodeAt(i)) | 0
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length]
}

// ── Custom collision detection ────────────────────────────────

/**
 * When dragging a block, only collide with blocks.
 * When dragging a rule:
 *   - compact mode: find which BLOCK the pointer is in (by Y), then closestCenter
 *     among pills in THAT block only — prevents cross-group false matches
 *   - detailed mode: closestCenter across all rules (smooth cross-block animation)
 * Fallback to blocks if no rule match.
 */
const typedCollisionDetection: CollisionDetection = (args) => {
  // Trash zone priority: if pointer is inside trash rect, return it immediately
  const trashContainers = args.droppableContainers.filter(
    c => c.data.current?.type === 'trash'
  )
  if (trashContainers.length > 0 && args.pointerCoordinates) {
    const { x, y } = args.pointerCoordinates
    const rect = args.droppableRects.get(trashContainers[0].id)
    if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return [{ id: trashContainers[0].id, data: { droppableContainer: trashContainers[0], value: 0 } }]
    }
  }

  const activeType = args.active.data.current?.type

  if (activeType === 'block') {
    const blockContainers = args.droppableContainers.filter(
      c => c.data.current?.type === 'block'
    )
    return closestCenter({ ...args, droppableContainers: blockContainers })
  }

  if (compactModeRef.current) {
    // Step 1: determine which block the pointer is vertically inside
    const pointer = args.pointerCoordinates
    const blockContainers = args.droppableContainers.filter(
      c => c.data.current?.type === 'block'
    )

    let targetBlockId: string | null = null

    if (pointer) {
      for (const container of blockContainers) {
        const rect = args.droppableRects.get(container.id)
        if (rect && pointer.y >= rect.top && pointer.y <= rect.bottom) {
          targetBlockId = String(container.id)
          break
        }
      }
    }

    // Pointer not inside any block rect → find nearest block
    if (!targetBlockId) {
      const blockCollisions = closestCenter({ ...args, droppableContainers: blockContainers })
      if (blockCollisions.length > 0) targetBlockId = String(blockCollisions[0].id)
    }

    if (targetBlockId) {
      // Step 2: only consider pills WITHIN this block
      const blockRules = args.droppableContainers.filter(
        c => c.data.current?.type === 'rule' && c.data.current?.blockId === targetBlockId
      )
      if (blockRules.length > 0) {
        const ruleCollisions = closestCenter({ ...args, droppableContainers: blockRules })
        if (ruleCollisions.length > 0) return ruleCollisions
      }
    }

    // No rule match → return nearest block
    return closestCenter({ ...args, droppableContainers: blockContainers })
  }

  // Detailed mode: closest center across all rules for smooth cross-block
  const ruleContainers = args.droppableContainers.filter(
    c => c.data.current?.type === 'rule'
  )
  const ruleCollisions = closestCenter({ ...args, droppableContainers: ruleContainers })
  if (ruleCollisions.length > 0) return ruleCollisions

  const blockContainers = args.droppableContainers.filter(
    c => c.data.current?.type === 'block'
  )
  return closestCenter({ ...args, droppableContainers: blockContainers })
}

// ── Compact rule pill (draggable, no push-aside) ─────────────

const CompactRulePill = memo(function CompactRulePill({
  rule,
  blockId,
  overSide,
  isDragActive,
}: {
  rule: import('@/lib/rules-parser').ParsedRule
  blockId: string
  /** null = not hovered, 'before' = line on left, 'after' = line on right */
  overSide: 'before' | 'after' | null
  isDragActive: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id, data: { type: 'rule' as const, blockId } })

  // Only the dragged pill gets translate (no scale — prevents stretching)
  const style: React.CSSProperties = isDragging
    ? { transform: CSS.Translate.toString(transform), transition, zIndex: 50 }
    : {}

  const showBefore = isDragActive && !isDragging && overSide === 'before'
  const showAfter = isDragActive && !isDragging && overSide === 'after'

  return (
    // Wrapper: relative + no overflow clip so indicators are visible
    <span
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative inline-flex cursor-grab touch-none select-none',
        isDragging && 'opacity-30',
      )}
      {...attributes}
      {...listeners}
    >
      {/* Insertion indicators — absolute in wrapper, outside pill overflow */}
      {showBefore && <span className="absolute -left-[3px] inset-y-0 w-[2px] rounded-full bg-white/80 z-10" />}
      {showAfter && <span className="absolute -right-[3px] inset-y-0 w-[2px] rounded-full bg-white/80 z-10" />}
      <span
        className={cn(
          'inline-flex items-center rounded-md border px-1.5 py-0 text-[10px] leading-4 font-mono truncate max-w-[200px]',
          getTypeBadgeClass(rule.type),
        )}
        title={`${rule.type}: ${rule.value || '(fallback)'}${rule.noResolve ? ' [no-resolve]' : ''}`}
      >
        {rule.value || (rule.type === 'MATCH' ? '∗' : rule.type)}
      </span>
    </span>
  )
})

// ── Compact group section (minimal density) ──────────────────

const CompactGroupSection = memo(function CompactGroupSection({
  block,
  dragOverInfo,
  isDragActive,
}: {
  block: RuleBlock
  dragOverInfo: { id: string; side: 'before' | 'after' } | null
  isDragActive: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, data: { type: 'block' as const } })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const ruleIds = useMemo(() => block.rules.map(r => r.id), [block.rules])
  const color = getGroupColor(block.target)
  const ruleCount = block.rules.length

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border-l-2 rounded-r-md',
        color.bar,
        isDragging && 'opacity-40',
      )}
    >
      <div className="flex items-center gap-1.5 pl-2 pr-1 py-1.5 flex-wrap">
        {/* Group badge with drag handle */}
        <Badge
          variant="outline"
          className={cn(
            'cursor-grab touch-none select-none gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold shrink-0',
            color.badge,
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3 opacity-50" />
          {block.target}
        </Badge>
        <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">
          {ruleCount}
        </span>

        {/* Inline draggable rule pills */}
        <SortableContext items={ruleIds} strategy={rectSortingStrategy}>
          {block.rules.map((rule) => (
            <CompactRulePill
              key={rule.id}
              rule={rule}
              blockId={block.id}
              overSide={dragOverInfo?.id === rule.id ? dragOverInfo.side : null}
              isDragActive={isDragActive}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
})

// ── Sortable group section (detailed density) ────────────────

const SortableGroupSection = memo(function SortableGroupSection({
  block,
  proxyGroups,
  onRemoveRule,
  onChangeRuleTarget,
}: {
  block: RuleBlock
  proxyGroups: string[]
  onRemoveRule: (blockId: string, ruleId: string) => void
  onChangeRuleTarget: (blockId: string, ruleId: string, newT: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, data: { type: 'block' as const } })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const ruleIds = useMemo(() => block.rules.map(r => r.id), [block.rules])
  const color = getGroupColor(block.target)
  const ruleCount = block.rules.length

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border-l-2 rounded-r-md',
        color.bar,
        isDragging && 'opacity-40',
      )}
    >
      {/* Group header */}
      <div className="flex items-center gap-2 pl-2 pr-1 py-1.5">
        <Badge
          variant="outline"
          className={cn(
            'cursor-grab touch-none select-none gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold',
            color.badge,
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3 opacity-50" />
          {block.target}
        </Badge>
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
          {ruleCount}
        </span>
      </div>

      {/* Rules — per-block SortableContext, shared DndContext from parent */}
      <SortableContext items={ruleIds} strategy={verticalListSortingStrategy}>
        <div className="pl-1">
          {block.rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              index={0}
              showTarget={false}
              blockId={block.id}
              proxyGroups={proxyGroups}
              onChangeTarget={onChangeRuleTarget}
              onRemove={onRemoveRule}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
})

// ── Trash drop zone (visible during drag) ─────────────────────

function TrashDropZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: 'trash-zone',
    data: { type: 'trash' },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'absolute bottom-3 right-3 flex items-center gap-2 rounded-xl border-2 border-dashed px-4 py-2.5 transition-all duration-200 z-10',
        isOver
          ? 'border-destructive bg-destructive/20 text-destructive scale-105'
          : 'border-muted-foreground/30 bg-card/90 text-muted-foreground backdrop-blur-sm',
      )}
    >
      <Trash2 className={cn('size-4 transition-transform duration-200', isOver && 'scale-110')} />
      <span className="text-xs font-medium">
        {isOver ? 'Отпустите для удаления' : 'Удалить'}
      </span>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────

interface RulesListProps {
  blocks: RuleBlock[]
  proxyGroups: string[]
}

// ── Component ─────────────────────────────────────────────────

export function RulesList({ blocks, proxyGroups }: RulesListProps) {
  const density = useSettingsStore((s) => s.rulesDensity)
  const isCompact = density === 'min'

  // Keep module-level ref in sync so collision detection can read it
  compactModeRef.current = isCompact

  // ── Directional animation on density switch ──
  const blocksContainerRef = useRef<HTMLDivElement>(null)
  const prevDensityRef = useRef(density)
  useEffect(() => {
    if (prevDensityRef.current !== density) {
      const toMin = density === 'min'
      prevDensityRef.current = density
      const el = blocksContainerRef.current
      if (el) {
        // Start: offset in the direction of the transition
        el.style.opacity = '0'
        el.style.transform = toMin
          ? 'translateY(-8px)'  // fold up into group headers
          : 'translateY(8px)'   // unfold down from group headers
        requestAnimationFrame(() => {
          el.style.transition = 'opacity 250ms ease-out, transform 250ms ease-out'
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
          const cleanup = () => { el.style.transition = ''; el.style.transform = '' }
          el.addEventListener('transitionend', cleanup, { once: true })
        })
      }
    }
  }, [density])

  const [addRuleOpen, setAddRuleOpen] = useState(false)
  const [addRuleBlockId, setAddRuleBlockId] = useState('')
  const [deleteRuleConfirm, setDeleteRuleConfirm] = useState<{ blockId: string; ruleId: string; label: string } | null>(null)
  const [dontAskAgain, setDontAskAgain] = useState(false)

  // ── Drag state ──
  const sourceBlockRef = useRef<string | null>(null)
  // Detailed mode: live cross-block via local blocks copy
  const [dragBlocks, setDragBlocks] = useState<RuleBlock[] | null>(null)
  const dragBlocksRef = useRef<RuleBlock[] | null>(null)
  const rafRef = useRef<number>(0)
  // Compact mode: insertion line indicator with side detection
  const [dragOverInfo, setDragOverInfo] = useState<{ id: string; side: 'before' | 'after' } | null>(null)
  const dragOverInfoRef = useRef<{ id: string; side: 'before' | 'after' } | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // During rule drag in detailed mode, render from local copy; otherwise from store
  const displayBlocks = dragBlocks ?? blocks
  const blockIds = useMemo(() => displayBlocks.map(b => b.id), [displayBlocks])

  // ── Drag handlers ───────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setIsDragActive(true)
    if (event.active.data.current?.type === 'rule') {
      sourceBlockRef.current = event.active.data.current.blockId as string
      if (!isCompact) {
        // Detailed mode: store reference for live cross-block
        dragBlocksRef.current = blocks
      }
    }
  }, [blocks, isCompact])

  // Compact mode: continuous side detection on every pointer move
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!isCompact) return
    const { active, over } = event
    if (!over || active.data.current?.type !== 'rule' || over.data.current?.type !== 'rule') {
      if (dragOverInfoRef.current !== null) {
        dragOverInfoRef.current = null
        setDragOverInfo(null)
      }
      return
    }

    const translated = active.rect.current.translated
    const overRect = over.rect
    let side: 'before' | 'after' = 'before'
    if (overRect && translated) {
      const activeCenterX = translated.left + translated.width / 2
      const overCenterX = overRect.left + overRect.width / 2
      side = activeCenterX > overCenterX ? 'after' : 'before'
    }

    // Only update state when something actually changed
    const prev = dragOverInfoRef.current
    if (!prev || prev.id !== String(over.id) || prev.side !== side) {
      const info = { id: String(over.id), side }
      dragOverInfoRef.current = info
      setDragOverInfo(info)
    }
  }, [isCompact])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.data.current?.type !== 'rule') return

    // Compact mode side detection is handled by handleDragMove (fires continuously)
    if (isCompact) return

    // ── Detailed mode: live cross-block animation ──
    const db = dragBlocksRef.current
    if (!db) return

    const activeId = String(active.id)
    const overType = over.data.current?.type as string

    // Find which block currently contains the active rule
    const srcIdx = db.findIndex(b => b.rules.some(r => r.id === activeId))
    if (srcIdx === -1) return

    // Find target block
    let targetBlockId: string
    if (overType === 'rule') {
      targetBlockId = over.data.current?.blockId as string
    } else if (overType === 'block') {
      targetBlockId = String(over.id)
    } else return

    const dstIdx = db.findIndex(b => b.id === targetBlockId)
    if (dstIdx === -1 || srcIdx === dstIdx) return // same block — dnd-kit handles natively

    // Cross-block: move rule in local state, throttled via rAF
    const overId = String(over.id)
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const db = dragBlocksRef.current
      if (!db) return

      // Re-find positions (may have shifted since event)
      const si = db.findIndex(b => b.rules.some(r => r.id === activeId))
      if (si === -1) return
      const di = db.findIndex(b => b.id === targetBlockId)
      if (di === -1 || si === di) return

      const srcRules = db[si].rules
      const ri = srcRules.findIndex(r => r.id === activeId)
      if (ri === -1) return

      const rule = srcRules[ri]
      const newSrcRules = srcRules.filter((_, i) => i !== ri)

      const dstRules = [...db[di].rules]
      let insertAt = dstRules.length
      if (overType === 'rule') {
        const oi = dstRules.findIndex(r => r.id === overId)
        if (oi >= 0) insertAt = oi
      }
      dstRules.splice(insertAt, 0, rule)

      // New refs only for changed blocks — React.memo skips the rest
      const newBlocks = db.map((b, i) => {
        if (i === si) return { ...b, rules: newSrcRules }
        if (i === di) return { ...b, rules: dstRules }
        return b
      })

      dragBlocksRef.current = newBlocks
      setDragBlocks(newBlocks)
    })
  }, [isCompact])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    const origBlockId = sourceBlockRef.current
    const db = dragBlocksRef.current

    // Capture insert-side before resetting
    const overInfo = dragOverInfoRef.current

    // Reset all drag state
    cancelAnimationFrame(rafRef.current)
    sourceBlockRef.current = null
    dragBlocksRef.current = null
    setDragBlocks(null)
    dragOverInfoRef.current = null
    setDragOverInfo(null)
    setIsDragActive(false)

    // ── Trash zone: delete dropped item ──
    if (over && String(over.id) === 'trash-zone') {
      const activeType = active.data.current?.type
      if (activeType === 'block') {
        useRulesEditorStore.getState().removeBlock(String(active.id))
      } else if (activeType === 'rule') {
        const blockId = active.data.current?.blockId as string
        if (blockId) {
          useRulesEditorStore.getState().removeRule(blockId, String(active.id))
        }
      }
      return
    }

    if (!over || active.id === over.id) return

    const activeType = active.data.current?.type

    // ── Block reorder ──
    if (activeType === 'block') {
      const storeBlocks = useRulesEditorStore.getState().blocks
      const oldI = storeBlocks.findIndex(b => b.id === active.id)
      const newI = storeBlocks.findIndex(b => b.id === over.id)
      if (oldI !== -1 && newI !== -1) useRulesEditorStore.getState().reorderBlocks(oldI, newI)
      return
    }

    // ── Rule move ──
    if (activeType === 'rule' && origBlockId) {
      const ruleId = String(active.id)

      if (isCompact) {
        // Compact mode: use over data + side info directly
        const overType = over.data.current?.type
        const insertAfter = overInfo?.side === 'after'
        if (overType === 'rule') {
          const overBlockId = over.data.current?.blockId as string
          if (overBlockId === origBlockId) {
            // Same block reorder
            const block = useRulesEditorStore.getState().blocks.find(b => b.id === origBlockId)
            if (!block) return
            const oldI = block.rules.findIndex(r => r.id === active.id)
            let newI = block.rules.findIndex(r => r.id === over.id)
            if (insertAfter && newI >= 0) newI += 1
            // Adjust if dragging forward (source shifts indices)
            if (oldI < newI) newI -= 1
            if (oldI !== -1 && newI !== -1 && oldI !== newI) {
              useRulesEditorStore.getState().reorderRules(origBlockId, oldI, newI)
            }
          } else {
            // Cross-block move
            const destBlock = useRulesEditorStore.getState().blocks.find(b => b.id === overBlockId)
            if (!destBlock) return
            let insertIdx = destBlock.rules.findIndex(r => r.id === String(over.id))
            if (insertAfter && insertIdx >= 0) insertIdx += 1
            useRulesEditorStore.getState().moveRuleBetweenBlocks(
              origBlockId, ruleId, overBlockId, insertIdx >= 0 ? insertIdx : 0,
            )
          }
        } else if (overType === 'block') {
          // Dropped on a group header → move to end of that block
          const destBlockId = String(over.id)
          if (destBlockId !== origBlockId) {
            const destBlock = useRulesEditorStore.getState().blocks.find(b => b.id === destBlockId)
            if (!destBlock) return
            useRulesEditorStore.getState().moveRuleBetweenBlocks(
              origBlockId, ruleId, destBlockId, destBlock.rules.length,
            )
          }
        }
        return
      }

      // Detailed mode: use dragBlocks state
      const currentBlock = db?.find(b => b.rules.some(r => r.id === ruleId))

      if (!currentBlock || currentBlock.id === origBlockId) {
        // Same block — within-block reorder (or returned to original)
        const overType = over.data.current?.type
        if (overType !== 'rule') return
        const block = useRulesEditorStore.getState().blocks.find(b => b.id === origBlockId)
        if (!block) return
        const oldI = block.rules.findIndex(r => r.id === active.id)
        const newI = block.rules.findIndex(r => r.id === over.id)
        if (oldI !== -1 && newI !== -1 && oldI !== newI) {
          useRulesEditorStore.getState().reorderRules(origBlockId, oldI, newI)
        }
      } else {
        // Cross-block move — use position from dragBlocks
        const insertIdx = currentBlock.rules.findIndex(r => r.id === ruleId)
        useRulesEditorStore.getState().moveRuleBetweenBlocks(
          origBlockId, ruleId, currentBlock.id, insertIdx >= 0 ? insertIdx : 0,
        )
      }
    }
  }, [isCompact])

  const handleDragCancel = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    sourceBlockRef.current = null
    dragBlocksRef.current = null
    setDragBlocks(null)
    dragOverInfoRef.current = null
    setDragOverInfo(null)
    setIsDragActive(false)
  }, [])

  // ── Rule actions ────────────────────────────────────────────

  const handleRemoveRule = useCallback((blockId: string, ruleId: string) => {
    if (useSettingsStore.getState().rulesConfirmDelete) {
      const currentBlock = useRulesEditorStore.getState().blocks.find(b => b.id === blockId)
      const rule = currentBlock?.rules.find(r => r.id === ruleId)
      setDeleteRuleConfirm({ blockId, ruleId, label: rule ? `${rule.type},${rule.value}` : ruleId })
    } else {
      useRulesEditorStore.getState().removeRule(blockId, ruleId)
    }
  }, [])

  const handleConfirmDeleteRule = () => {
    if (!deleteRuleConfirm) return
    if (dontAskAgain) useSettingsStore.getState().setRulesConfirmDelete(false)
    useRulesEditorStore.getState().removeRule(deleteRuleConfirm.blockId, deleteRuleConfirm.ruleId)
    setDeleteRuleConfirm(null); setDontAskAgain(false)
  }

  const handleChangeRuleTarget = useCallback(
    (blockId: string, ruleId: string, newT: string) =>
      useRulesEditorStore.getState().changeRuleTarget(blockId, ruleId, newT),
    [],
  )

  const handleOpenAddRule = useCallback((blockId: string) => {
    setAddRuleBlockId(blockId)
    setAddRuleOpen(true)
  }, [])

  const lastBlock = displayBlocks[displayBlocks.length - 1]
  const defaultTarget = lastBlock?.target ?? proxyGroups[0] ?? 'DIRECT'

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      <DndContext
        sensors={sensors}
        collisionDetection={typedCollisionDetection}
        modifiers={isCompact ? NO_MODIFIERS : VERTICAL_MODIFIERS}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div ref={blocksContainerRef} className="flex flex-col flex-1 min-h-0 overflow-y-auto rounded-lg border bg-card p-2 gap-2">
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            {isCompact
              ? displayBlocks.map(block => (
                  <CompactGroupSection
                    key={block.id}
                    block={block}
                    dragOverInfo={dragOverInfo}
                    isDragActive={isDragActive}
                  />
                ))
              : displayBlocks.map(block => (
                  <SortableGroupSection
                    key={block.id}
                    block={block}
                    proxyGroups={proxyGroups}
                    onRemoveRule={handleRemoveRule}
                    onChangeRuleTarget={handleChangeRuleTarget}
                  />
                ))
            }
          </SortableContext>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground hover:text-primary text-xs"
            onClick={() => handleOpenAddRule(lastBlock?.id ?? '')}
          >
            <Plus className="size-3.5" />
            Добавить правило
          </Button>
        </div>

        {/* Trash drop zone — appears during drag */}
        {isDragActive && <TrashDropZone />}
      </DndContext>

      {/* Add rule dialog */}
      <AddRuleDialog
        open={addRuleOpen}
        onOpenChange={setAddRuleOpen}
        blockId={addRuleBlockId}
        proxyGroups={proxyGroups}
        defaultTarget={defaultTarget}
      />

      {/* Delete rule confirmation */}
      <AlertDialog open={deleteRuleConfirm !== null} onOpenChange={() => { setDeleteRuleConfirm(null); setDontAskAgain(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить правило?</AlertDialogTitle>
            <AlertDialogDescription>{deleteRuleConfirm?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2">
            <Switch id="dont-ask-rule" checked={dontAskAgain} onCheckedChange={setDontAskAgain} />
            <Label htmlFor="dont-ask-rule" className="text-sm cursor-pointer">Больше не спрашивать</Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteRuleConfirm(null); setDontAskAgain(false) }}>Отмена</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDeleteRule}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
