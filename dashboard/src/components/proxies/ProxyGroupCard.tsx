import { useEffect, useMemo } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Zap,
  MousePointerClick,
  Timer,
  ShieldCheck,
  Scale,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProxiesStore } from '@/stores/proxies'
import { ProxyLatencyBadge } from './ProxyLatencyBadge'
import { ProxyNodeItem } from './ProxyNodeItem'

interface ProxyGroupCardProps {
  groupName: string
  density: 'min' | 'mid' | 'max'
  typeStyle: 'badge' | 'border' | 'icon'
  showAutoInfo: boolean
  sortBy: 'name' | 'delay' | 'default'
}

const TYPE_LABELS: Record<string, string> = {
  Selector: 'Selector',
  URLTest: 'URLTest',
  Fallback: 'Fallback',
  LoadBalance: 'LoadBalance',
}

const TYPE_BADGE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  Selector: 'default',
  URLTest: 'secondary',
  Fallback: 'outline',
  LoadBalance: 'secondary',
}

const TYPE_BORDER_COLORS: Record<string, string> = {
  Selector: 'border-l-primary',
  URLTest: 'border-l-blue-500',
  Fallback: 'border-l-orange-500',
  LoadBalance: 'border-l-green-500',
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  Selector: MousePointerClick,
  URLTest: Timer,
  Fallback: ShieldCheck,
  LoadBalance: Scale,
}

export function ProxyGroupCard({
  groupName,
  density,
  typeStyle,
  showAutoInfo,
  sortBy,
}: ProxyGroupCardProps) {
  const group = useProxiesStore((s) => s.proxyMap[groupName])
  const expandedGroups = useProxiesStore((s) => s.expandedGroups)
  const testingGroups = useProxiesStore((s) => s.testingGroups)
  const testingProxies = useProxiesStore((s) => s.testingProxies)
  const delayCache = useProxiesStore((s) => s.delayCache)
  const toggleExpand = useProxiesStore((s) => s.toggleExpand)
  const selectProxyInGroup = useProxiesStore((s) => s.selectProxyInGroup)
  const testProxyDelay = useProxiesStore((s) => s.testProxyDelay)
  const testGroupDelay = useProxiesStore((s) => s.testGroupDelay)

  const isExpanded = expandedGroups.has(groupName)
  const isTesting = testingGroups.has(groupName)
  const isSelector = group?.type === 'Selector'
  const allProxies = group?.all ?? []
  const nowProxy = group?.now

  // Auto-test delays when expanded
  useEffect(() => {
    if (!isExpanded || allProxies.length === 0) return
    for (const proxyName of allProxies) {
      testProxyDelay(proxyName)
    }
  }, [isExpanded, allProxies, testProxyDelay])

  // Sort proxies
  const sortedProxies = useMemo(() => {
    if (sortBy === 'default') return allProxies
    const sorted = [...allProxies]
    if (sortBy === 'name') {
      sorted.sort((a, b) => a.localeCompare(b))
    } else if (sortBy === 'delay') {
      sorted.sort((a, b) => {
        const da = delayCache[a]?.delay
        const db = delayCache[b]?.delay
        // undefined and 0 (timeout) go to end
        if (da === undefined && db === undefined) return 0
        if (da === undefined) return 1
        if (db === undefined) return -1
        if (da === 0 && db === 0) return 0
        if (da === 0) return 1
        if (db === 0) return -1
        return da - db
      })
    }
    return sorted
  }, [allProxies, sortBy, delayCache])

  // Top 3 proxies by delay (for max density)
  const top3 = useMemo(() => {
    if (density !== 'max') return []
    return [...allProxies]
      .filter((n) => {
        const d = delayCache[n]?.delay
        return d !== undefined && d > 0
      })
      .sort((a, b) => (delayCache[a]!.delay) - (delayCache[b]!.delay))
      .slice(0, 3)
  }, [allProxies, delayCache, density])

  if (!group) return null

  const groupType = group.type
  const TypeIcon = TYPE_ICONS[groupType]
  const borderClass = typeStyle === 'border' ? TYPE_BORDER_COLORS[groupType] : ''

  const nowDelay = nowProxy ? delayCache[nowProxy]?.delay : undefined
  const nowTesting = nowProxy ? testingProxies.has(nowProxy) : false

  return (
    <Card
      className={cn(
        'transition-all duration-200 overflow-hidden py-0',
        isExpanded && 'col-span-full',
        typeStyle === 'border' && `border-l-4 ${borderClass}`
      )}
    >
      <Collapsible open={isExpanded}>
        {/* Header - always visible */}
        <CardHeader
          className="cursor-pointer select-none px-4 py-3"
          onClick={() => toggleExpand(groupName)}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Type icon (if icon style) */}
            {typeStyle === 'icon' && TypeIcon && (
              <TypeIcon className="size-4 shrink-0 text-muted-foreground" />
            )}

            {/* Group name */}
            <span className="font-medium text-sm truncate">{groupName}</span>

            {/* Type badge (if badge style) */}
            {typeStyle === 'badge' && (
              <Badge
                variant={TYPE_BADGE_VARIANTS[groupType] ?? 'secondary'}
                className="text-[10px] px-1.5 py-0"
              >
                {TYPE_LABELS[groupType] ?? groupType}
              </Badge>
            )}

            {/* Current proxy (now) */}
            {nowProxy && (
              <span className="text-xs text-muted-foreground truncate">
                {nowProxy}
              </span>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Mid density: latency badge + proxy count */}
            {(density === 'mid' || density === 'max') && (
              <>
                <ProxyLatencyBadge delay={nowDelay} testing={nowTesting} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {allProxies.length} proxies
                </span>
              </>
            )}

            {/* Test group button */}
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                testGroupDelay(groupName)
              }}
              disabled={isTesting}
            >
              <Zap className="size-3" />
            </Button>

            {/* Expand chevron */}
            {isExpanded ? (
              <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            )}
          </div>

          {/* Max density: icon + top 3 */}
          {density === 'max' && !isExpanded && (
            <div className="flex items-center gap-2 mt-1">
              {group.icon && (
                <img
                  src={group.icon}
                  alt=""
                  className="size-4 rounded"
                  loading="lazy"
                />
              )}
              {top3.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {top3.map((name) => (
                    <span key={name} className="flex items-center gap-1">
                      <span className="truncate max-w-[80px]">{name}</span>
                      <ProxyLatencyBadge delay={delayCache[name]?.delay} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardHeader>

        {/* Expanded content */}
        <CollapsibleContent>
          <CardContent className="px-4 pb-3 pt-0">
            <ScrollArea className="max-h-[400px]">
              <div className="flex flex-col">
                {sortedProxies.map((proxyName) => (
                  <ProxyNodeItem
                    key={proxyName}
                    name={proxyName}
                    isActive={proxyName === nowProxy}
                    canSelect={isSelector}
                    delay={delayCache[proxyName]?.delay}
                    testing={testingProxies.has(proxyName)}
                    onSelect={() => selectProxyInGroup(groupName, proxyName)}
                    onTest={() => testProxyDelay(proxyName)}
                  />
                ))}
              </div>
            </ScrollArea>

            {/* Auto group info */}
            {showAutoInfo && !isSelector && (group.type === 'URLTest' || group.type === 'Fallback') && (
              <div className="mt-2 pt-2 border-t text-xs text-muted-foreground space-y-1">
                {group.testUrl && (
                  <div>Test URL: {group.testUrl}</div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
