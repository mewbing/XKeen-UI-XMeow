/**
 * Sortable list of block cards with DndContext and DragOverlay.
 *
 * Wraps RuleBlockCard components in @dnd-kit SortableContext
 * for drag-and-drop reordering. Supports 3 layout modes.
 */

import { useState, memo, useMemo, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRulesEditorStore } from '@/stores/rules-editor'
import { RuleBlockCard } from './RuleBlockCard'
import { DangerWarningDialog, DANGER_MATCH_MOVED, DANGER_EXCLUSIONS_MOVED } from './DangerWarningDialog'
import type { RuleBlock } from '@/lib/rules-parser'

interface RuleBlockListProps {
  blocks: RuleBlock[]
  density: 'min' | 'detailed'
  layout: 'list' | 'grid' | 'proxies'
  expandedBlocks: Set<string>
  onToggleExpand: (blockId: string) => void
  newBlockMode: 'dialog' | 'inline'
  proxyGroups: string[]
  changedBlockIds: Set<string>
}

// ---- SortableBlockCard wrapper ----

interface SortableBlockCardProps {
  block: RuleBlock
  index: number
  density: 'min' | 'detailed'
  isExpanded: boolean
  onToggleExpand: (blockId: string) => void
  proxyGroups: string[]
  isChanged: boolean
}

const SortableBlockCard = memo(function SortableBlockCard({
  block,
  index,
  density,
  isExpanded,
  onToggleExpand,
  proxyGroups,
  isChanged,
}: SortableBlockCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleToggle = useCallback(() => onToggleExpand(block.id), [onToggleExpand, block.id])

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={cn(
        isExpanded && 'col-span-full',
        isChanged && 'border-l-4 border-l-amber-500 rounded-l-sm',
      )}
    >
      <RuleBlockCard
        block={block}
        index={index}
        density={density}
        isExpanded={isExpanded}
        onToggleExpand={handleToggle}
        isDragging={isDragging}
        proxyGroups={proxyGroups}
      />
    </div>
  )
})

// ---- Inline new block card ----

interface InlineNewBlockCardProps {
  proxyGroups: string[]
}

function InlineNewBlockCard({ proxyGroups }: InlineNewBlockCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')

  const handleCreate = () => {
    if (!name.trim() || !target) return
    useRulesEditorStore.getState().createBlock(name.trim(), target)
    setName('')
    setTarget('')
    setIsEditing(false)
  }

  const handleCancel = () => {
    setName('')
    setTarget('')
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleCancel()
    if (e.key === 'Enter') handleCreate()
  }

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="flex items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed border-muted-foreground/30 py-6 text-sm text-muted-foreground/50 hover:border-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        <Plus className="size-4" />
        <span>Новый блок</span>
      </button>
    )
  }

  return (
    <div
      className="rounded-lg border-2 border-dashed border-primary/40 p-4 space-y-3"
      onKeyDown={handleKeyDown}
    >
      <Input
        placeholder="Название блока"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <Select value={target} onValueChange={setTarget}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Целевая прокси-группа" />
        </SelectTrigger>
        <SelectContent>
          {proxyGroups.map((pg) => (
            <SelectItem key={pg} value={pg}>
              {pg}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleCreate} disabled={!name.trim() || !target}>
          Создать
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCancel}>
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}

// ---- Main RuleBlockList ----

export function RuleBlockList({
  blocks,
  density,
  layout,
  expandedBlocks,
  onToggleExpand,
  newBlockMode,
  proxyGroups,
  changedBlockIds,
}: RuleBlockListProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pendingMove, setPendingMove] = useState<{
    oldIndex: number; newIndex: number;
    dangerType: { title: string; description: string }
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const oldIndex = blocks.findIndex((b) => b.id === active.id)
    const newIndex = blocks.findIndex((b) => b.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const movedBlock = blocks[oldIndex]

    // Check MATCH to non-last position
    const hasMatch = movedBlock.rules.some((r) => r.type === 'MATCH')
    if (hasMatch && newIndex !== blocks.length - 1) {
      setPendingMove({ oldIndex, newIndex, dangerType: DANGER_MATCH_MOVED })
      return
    }

    // Check exclusions block
    if (/исключен/i.test(movedBlock.name) && newIndex > 0) {
      setPendingMove({ oldIndex, newIndex, dangerType: DANGER_EXCLUSIONS_MOVED })
      return
    }

    useRulesEditorStore.getState().reorderBlocks(oldIndex, newIndex)
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  const handleDangerConfirm = () => {
    if (pendingMove) {
      useRulesEditorStore.getState().reorderBlocks(pendingMove.oldIndex, pendingMove.newIndex)
      setPendingMove(null)
    }
  }

  const handleDangerCancel = () => {
    setPendingMove(null)
  }

  const activeBlock = activeId ? blocks.find((b) => b.id === activeId) : null
  const activeIndex = activeId ? blocks.findIndex((b) => b.id === activeId) : -1

  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks])

  // Layout mode determines strategy and CSS grid
  const isListLayout = layout === 'list'
  const strategy = isListLayout ? verticalListSortingStrategy : rectSortingStrategy
  const modifiers = useMemo(() => isListLayout ? [restrictToVerticalAxis] : [], [isListLayout])

  const containerClass = cn(
    layout === 'list' && 'flex flex-col gap-3',
    layout === 'grid' && 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3',
    layout === 'proxies' && 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3',
  )

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={modifiers}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={blockIds} strategy={strategy}>
        <div className={containerClass}>
          {blocks.map((block, i) => (
            <SortableBlockCard
              key={block.id}
              block={block}
              index={i}
              density={density}
              isExpanded={expandedBlocks.has(block.id)}
              onToggleExpand={onToggleExpand}
              proxyGroups={proxyGroups}
              isChanged={changedBlockIds.has(block.id)}
            />
          ))}

          {/* Inline new block placeholder */}
          {newBlockMode === 'inline' && (
            <InlineNewBlockCard proxyGroups={proxyGroups} />
          )}
        </div>
      </SortableContext>

      {/* Drag overlay: clone of the active card */}
      <DragOverlay>
        {activeBlock && (
          <RuleBlockCard
            block={activeBlock}
            index={activeIndex}
            density={density}
            isExpanded={false}
            onToggleExpand={() => {}}
            proxyGroups={proxyGroups}
          />
        )}
      </DragOverlay>
    </DndContext>

      {/* Danger warning dialog */}
      {pendingMove && (
        <DangerWarningDialog
          open={pendingMove !== null}
          onOpenChange={(v) => { if (!v) setPendingMove(null) }}
          title={pendingMove.dangerType.title}
          description={pendingMove.dangerType.description}
          onConfirm={handleDangerConfirm}
          onCancel={handleDangerCancel}
        />
      )}
    </>
  )
}
