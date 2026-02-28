/**
 * Sortable list of block cards with DndContext and DragOverlay.
 *
 * Wraps RuleBlockCard components in @dnd-kit SortableContext
 * for drag-and-drop reordering. Supports 3 layout modes.
 */

import { useState } from 'react'
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
import type { RuleBlock } from '@/lib/rules-parser'

interface RuleBlockListProps {
  blocks: RuleBlock[]
  density: 'min' | 'detailed'
  layout: 'list' | 'grid' | 'proxies'
  expandedBlocks: Set<string>
  onToggleExpand: (blockId: string) => void
  newBlockMode: 'dialog' | 'inline'
  proxyGroups: string[]
}

// ---- SortableBlockCard wrapper ----

interface SortableBlockCardProps {
  block: RuleBlock
  index: number
  density: 'min' | 'detailed'
  isExpanded: boolean
  onToggleExpand: () => void
}

function SortableBlockCard({
  block,
  index,
  density,
  isExpanded,
  onToggleExpand,
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

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={cn(isExpanded && 'col-span-full')}
    >
      <RuleBlockCard
        block={block}
        index={index}
        density={density}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        isDragging={isDragging}
      />
    </div>
  )
}

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
}: RuleBlockListProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

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

    if (oldIndex !== -1 && newIndex !== -1) {
      useRulesEditorStore.getState().reorderBlocks(oldIndex, newIndex)
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  const activeBlock = activeId ? blocks.find((b) => b.id === activeId) : null
  const activeIndex = activeId ? blocks.findIndex((b) => b.id === activeId) : -1

  const blockIds = blocks.map((b) => b.id)

  // Layout mode determines strategy and CSS grid
  const isListLayout = layout === 'list'
  const strategy = isListLayout ? verticalListSortingStrategy : rectSortingStrategy
  const modifiers = isListLayout ? [restrictToVerticalAxis] : []

  const containerClass = cn(
    layout === 'list' && 'flex flex-col gap-3',
    layout === 'grid' && 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3',
    layout === 'proxies' && 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3',
  )

  return (
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
              onToggleExpand={() => onToggleExpand(block.id)}
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
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
