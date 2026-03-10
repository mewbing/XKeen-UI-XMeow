/**
 * Single rule row displayed inside an expanded block.
 *
 * Shows: position number, type badge (colored by category),
 * value text (truncated), target proxy-group dropdown,
 * and delete button. Wrapped with useSortable for drag-reorder.
 */

import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Trash2, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ParsedRule } from '@/lib/rules-parser'

interface RuleRowProps {
  rule: ParsedRule
  index: number
  showTarget: boolean
  blockId: string
  proxyGroups: string[]
  onChangeTarget: (blockId: string, ruleId: string, newTarget: string) => void
  onRemove: (blockId: string, ruleId: string) => void
}

/** Map rule type to color category for the badge */
export function getTypeBadgeClass(type: string): string {
  // DOMAIN-* family
  if (type.startsWith('DOMAIN')) return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
  // Geo databases
  if (type === 'GEOSITE' || type === 'GEOIP') return 'bg-green-500/15 text-green-400 border-green-500/30'
  // IP ranges
  if (type.startsWith('IP-CIDR') || type === 'SRC-IP-CIDR') return 'bg-orange-500/15 text-orange-400 border-orange-500/30'
  // Rule sets
  if (type === 'RULE-SET') return 'bg-purple-500/15 text-purple-400 border-purple-500/30'
  // Compound rules
  if (type === 'AND' || type === 'OR' || type === 'NOT') return 'bg-red-500/15 text-red-400 border-red-500/30'
  // MATCH fallback
  if (type === 'MATCH') return 'bg-muted text-muted-foreground border-border'
  // Process, port, etc.
  return 'bg-muted text-muted-foreground border-border'
}

export const RuleRow = memo(function RuleRow({ rule, index: _index, showTarget, blockId, proxyGroups, onChangeTarget, onRemove }: RuleRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id, data: { type: 'rule' as const, blockId } })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Native browser virtualization — skip paint/layout for off-screen rows
    contentVisibility: 'auto',
    containIntrinsicSize: 'auto 34px',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent/30 transition-colors text-sm group',
        isDragging && 'opacity-50',
      )}
    >
      {/* Drag handle */}
      <button
        className="cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Type badge */}
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] px-1.5 py-0 leading-4 shrink-0 rounded-md font-mono',
          getTypeBadgeClass(rule.type)
        )}
      >
        {rule.type}
      </Badge>

      {/* Value text */}
      <span className="truncate min-w-0 flex-1 text-foreground/90">
        {rule.value || (rule.type === 'MATCH' ? '(fallback)' : '')}
      </span>

      {/* no-resolve flag */}
      {rule.noResolve && (
        <span className="text-[10px] text-muted-foreground/60 shrink-0">
          no-resolve
        </span>
      )}

      {/* Target proxy-group dropdown */}
      {showTarget && (
        <Select
          value={rule.target}
          onValueChange={(v) => onChangeTarget(blockId, rule.id, v)}
        >
          <SelectTrigger className="h-7 text-xs w-auto min-w-[80px] max-w-[140px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {proxyGroups.map((pg) => (
              <SelectItem key={pg} value={pg}>
                {pg}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation()
          onRemove(blockId, rule.id)
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
})
