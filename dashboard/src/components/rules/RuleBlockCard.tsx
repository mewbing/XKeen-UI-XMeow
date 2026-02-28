/**
 * Rule block card with collapse/expand, position number, density modes.
 *
 * Collapsed: shows block name, rule count, target proxy-group.
 * Expanded: shows all rules as RuleRow components.
 * Uses CSS grid-rows animation pattern from ProxyGroupCard.
 */

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RuleRow } from './RuleRow'
import type { RuleBlock } from '@/lib/rules-parser'

interface RuleBlockCardProps {
  block: RuleBlock
  index: number
  density: 'min' | 'detailed'
  isExpanded: boolean
  onToggleExpand: () => void
  isDragging?: boolean
  style?: React.CSSProperties
}

function pluralRules(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return count + ' правило'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return count + ' правила'
  return count + ' правил'
}

export function RuleBlockCard({
  block,
  index,
  density,
  isExpanded,
  onToggleExpand,
  isDragging = false,
  style,
}: RuleBlockCardProps) {
  return (
    <Card
      className={cn(
        'transition-all duration-200 overflow-hidden py-0 gap-0',
        isDragging && 'opacity-50'
      )}
      style={style}
    >
      {/* Header */}
      <CardHeader
        className={cn(
          'select-none px-4 !gap-0 transition-[padding] duration-200 cursor-pointer',
          isExpanded ? 'pt-3 pb-2' : 'py-3',
        )}
        onClick={onToggleExpand}
      >
        {/* Row 1: position + name + badges + chevron */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Position number */}
          <span className="flex items-center justify-center size-6 rounded-md bg-muted text-muted-foreground text-xs font-medium tabular-nums shrink-0">
            #{index + 1}
          </span>

          {/* Block name */}
          <span className="font-medium text-sm truncate min-w-0 flex-1">
            {block.name}
          </span>

          {/* Rule count badge */}
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 leading-none shrink-0">
            {pluralRules(block.rules.length)}
          </Badge>

          {/* Target proxy-group badge */}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-none shrink-0 max-w-[120px] truncate">
            {block.target}
          </Badge>

          {/* Chevron */}
          <ChevronDown className={cn(
            'size-4 text-muted-foreground transition-transform duration-200 shrink-0',
            isExpanded && 'rotate-180'
          )} />
        </div>

        {/* Density: detailed -- preview of first 2-3 rules when collapsed */}
        {density === 'detailed' && !isExpanded && block.rules.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground overflow-hidden">
            {block.rules.slice(0, 3).map((rule) => (
              <span key={rule.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 shrink-0 max-w-[180px] truncate">
                <span className="font-mono text-[10px] opacity-70">{rule.type}</span>
                <span className="truncate">{rule.value}</span>
              </span>
            ))}
            {block.rules.length > 3 && (
              <span className="text-muted-foreground/50 shrink-0">+{block.rules.length - 3}</span>
            )}
          </div>
        )}
      </CardHeader>

      {/* Expanded content: rules list -- animated via CSS grid */}
      <div className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out',
        isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      )}>
        <div className={cn(
          'overflow-hidden transition-opacity duration-200',
          isExpanded ? 'opacity-100 delay-100' : 'opacity-0'
        )}>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="flex flex-col gap-0.5">
              {block.rules.map((rule, ruleIndex) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  index={ruleIndex}
                  showTarget={block.rules.some(r => r.target !== block.target)}
                />
              ))}
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  )
}
