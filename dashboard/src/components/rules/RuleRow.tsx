/**
 * Single rule row displayed inside an expanded block.
 *
 * Shows: position number, type badge (colored by category),
 * value text (truncated), and target proxy-group name.
 */

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { ParsedRule } from '@/lib/rules-parser'

interface RuleRowProps {
  rule: ParsedRule
  index: number
  showTarget: boolean
}

/** Map rule type to color category for the badge */
function getTypeBadgeClass(type: string): string {
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

export function RuleRow({ rule, index, showTarget }: RuleRowProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent/30 transition-colors text-sm">
      {/* Position number */}
      <span className="text-[11px] tabular-nums text-muted-foreground w-7 text-right shrink-0 font-mono">
        #{index + 1}
      </span>

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

      {/* Target proxy-group */}
      {showTarget && (
        <span className="text-xs text-muted-foreground shrink-0 truncate max-w-[120px]">
          {rule.target}
        </span>
      )}

      {/* no-resolve flag */}
      {rule.noResolve && (
        <span className="text-[10px] text-muted-foreground/60 shrink-0">
          no-resolve
        </span>
      )}
    </div>
  )
}
