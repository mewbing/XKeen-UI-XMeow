import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ProxyLatencyBadge } from './ProxyLatencyBadge'

interface ProxyNodeItemProps {
  name: string
  isActive: boolean
  canSelect: boolean
  delay: number | undefined
  testing: boolean
  onSelect: () => void
  onTest: () => void
}

export function ProxyNodeItem({
  name,
  isActive,
  canSelect,
  delay,
  testing,
  onSelect,
  onTest,
}: ProxyNodeItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 h-9 rounded-sm transition-colors',
        isActive && 'bg-primary/10 border-l-2 border-primary',
        !isActive && 'border-l-2 border-transparent',
        canSelect && 'cursor-pointer hover:bg-accent/50',
        !canSelect && 'cursor-default'
      )}
      onClick={canSelect ? onSelect : undefined}
    >
      <span className="text-sm truncate flex-1">{name}</span>
      <ProxyLatencyBadge delay={delay} testing={testing} />
      <Button
        variant="ghost"
        size="icon-xs"
        className="shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          onTest()
        }}
        disabled={testing}
      >
        <Zap className="size-3" />
      </Button>
    </div>
  )
}
