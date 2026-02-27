import { cn } from '@/lib/utils'
import { formatDelay } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'

interface ProxyLatencyBadgeProps {
  delay: number | undefined
  testing?: boolean
}

function getDelayColor(delay: number | undefined): string {
  if (delay === undefined) return 'text-muted-foreground'
  if (delay === 0) return 'text-destructive'
  if (delay < 100) return 'text-green-500'
  if (delay < 300) return 'text-yellow-500'
  return 'text-red-500'
}

export function ProxyLatencyBadge({ delay, testing }: ProxyLatencyBadgeProps) {
  if (testing) {
    return <Skeleton className="h-4 w-10" />
  }

  return (
    <span
      className={cn(
        'text-xs font-mono tabular-nums',
        getDelayColor(delay)
      )}
    >
      {formatDelay(delay)}
    </span>
  )
}
