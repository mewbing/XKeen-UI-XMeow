import { useMemo } from 'react'
import {
  ChevronDown,
  MousePointerClick,
  Timer,
  ShieldCheck,
  Scale,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDisplayName } from '@/lib/flags'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useProxiesStore } from '@/stores/proxies'
import { ScrollText } from '@/components/ui/scroll-text'
import { ProxyFlag } from './ProxyFlag'
import { FaviconImg } from './FaviconImg'

interface ProxyGroupCardProps {
  groupName: string
  density: 'min' | 'mid' | 'max'
  typeStyle: 'badge' | 'border' | 'icon' | 'none'
  sortBy: 'name' | 'delay' | 'default'
}

function getDelayColorClass(delay: number | undefined): string {
  if (delay === undefined) return 'text-muted-foreground'
  if (delay === 0) return 'text-destructive'
  if (delay < 100) return 'text-green-500'
  if (delay < 300) return 'text-yellow-500'
  return 'text-red-500'
}

/** Resolve delay for a name that might be a group — follows now→now chain to leaf */
function resolveDelay(
  name: string,
  proxyMap: Record<string, import('@/lib/mihomo-api').Proxy>,
  delayCache: Record<string, { delay: number }>,
): number | undefined {
  let current = name
  for (let i = 0; i < 10; i++) {
    const cached = delayCache[current]?.delay
    if (cached !== undefined) return cached
    const p = proxyMap[current]
    if (p?.all && p.now) {
      current = p.now
    } else {
      break
    }
  }
  return delayCache[current]?.delay
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
  sortBy,
}: ProxyGroupCardProps) {
  const proxyMap = useProxiesStore((s) => s.proxyMap)
  const group = proxyMap[groupName]
  const expandedGroups = useProxiesStore((s) => s.expandedGroups)
  const testingGroups = useProxiesStore((s) => s.testingGroups)
  const delayCache = useProxiesStore((s) => s.delayCache)
  const toggleExpand = useProxiesStore((s) => s.toggleExpand)
  const selectProxyInGroup = useProxiesStore((s) => s.selectProxyInGroup)
  const testGroupDelay = useProxiesStore((s) => s.testGroupDelay)

  const isExpanded = expandedGroups.has(groupName)
  const isTesting = testingGroups.has(groupName)
  const isSelectable = group?.type === 'Selector' || group?.type === 'URLTest' || group?.type === 'Fallback'
  const allProxies = group?.all ?? []
  const nowProxy = group?.now

  // Sort proxies (normal order)
  const sortedProxies = useMemo(() => {
    if (sortBy === 'default') return allProxies
    const sorted = [...allProxies]
    if (sortBy === 'name') {
      sorted.sort((a, b) => a.localeCompare(b))
    } else if (sortBy === 'delay') {
      sorted.sort((a, b) => {
        const da = resolveDelay(a, proxyMap, delayCache)
        const db = resolveDelay(b, proxyMap, delayCache)
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

  // Collapsed order: active proxy first
  const collapsedProxies = useMemo(() => {
    if (!nowProxy) return sortedProxies
    const rest = sortedProxies.filter((n) => n !== nowProxy)
    return [nowProxy, ...rest]
  }, [sortedProxies, nowProxy])

  if (!group) return null

  const groupType = group.type
  const TypeIcon = TYPE_ICONS[groupType] ?? MousePointerClick
  const borderClass = typeStyle === 'border' ? TYPE_BORDER_COLORS[groupType] : ''

  const showCards = density === 'max' || isExpanded

  return (
    <Card
      className={cn(
        'transition-all duration-200 overflow-hidden py-0 gap-0',
        typeStyle === 'border' && `border-l-4 ${borderClass}`
      )}
    >
      {/* Header */}
      <CardHeader
        className={cn(
          'select-none px-4 !gap-0 transition-[padding] duration-200',
          showCards ? 'pt-3 pb-2' : 'py-3',
          density !== 'max' && 'cursor-pointer'
        )}
        onClick={density !== 'max' ? () => toggleExpand(groupName) : undefined}
      >
        {/* Row 1: group name + controls */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <div className={cn(
              'shrink-0 transition-all duration-200 overflow-hidden',
              typeStyle === 'icon' ? 'max-w-4 opacity-100' : 'max-w-0 opacity-0'
            )}>
              <TypeIcon className="size-4 text-muted-foreground" />
            </div>
            <FaviconImg
              iconUrl={group.icon}
              testUrl={group.testUrl}
              name={groupName}
            />
            <ScrollText className="font-medium text-sm min-w-0">{groupName}</ScrollText>
            <div className={cn(
              'shrink-0 flex items-center transition-all duration-200 overflow-hidden',
              typeStyle === 'badge' ? 'max-w-[100px] opacity-100' : 'max-w-0 opacity-0'
            )}>
              <Badge
                variant={TYPE_BADGE_VARIANTS[groupType] ?? 'secondary'}
                className="text-[10px] px-1.5 py-0 leading-none whitespace-nowrap"
              >
                {TYPE_LABELS[groupType] ?? groupType}
              </Badge>
            </div>
          </div>
          {/* Min density: active proxy centered */}
          {density === 'min' && !isExpanded && nowProxy && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full min-w-0 max-w-[45%] bg-primary text-primary-foreground text-xs overflow-hidden">
              <ProxyFlag name={nowProxy} className="h-2.5 w-auto shrink-0" />
              <span className="truncate">{getDisplayName(nowProxy)}</span>
              {(() => {
                const d = resolveDelay(nowProxy, proxyMap, delayCache)
                return d !== undefined && d > 0 ? (
                  <span className={cn('font-mono tabular-nums font-bold shrink-0', getDelayColorClass(d))}>
                    {d}
                  </span>
                ) : null
              })()}
            </span>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button
              className={cn(
                'size-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-all active:scale-75',
                isTesting
                  ? 'bg-primary/20 text-primary animate-pulse'
                  : 'bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary'
              )}
              onClick={(e) => {
                e.stopPropagation()
                testGroupDelay(groupName)
              }}
              disabled={isTesting}
              title="Тестировать группу"
            >
              {allProxies.length}
            </button>
            {density !== 'max' && (
              <ChevronDown className={cn(
                'size-4 text-muted-foreground transition-transform duration-200',
                isExpanded && 'rotate-180'
              )} />
            )}
          </div>
        </div>

        {/* Collapsed mid: proxy preview with active first + highlighted */}
        <div className={cn(
          'flex items-center gap-0.5 mt-1 text-xs text-muted-foreground overflow-hidden transition-all duration-200',
          !showCards && density === 'mid'
            ? 'opacity-100 max-h-10'
            : 'opacity-0 max-h-0 mt-0'
        )}>
          {collapsedProxies.slice(0, 4).map((name) => {
            const isActive = name === nowProxy
            const delay = resolveDelay(name, proxyMap, delayCache)
            return (
              <span
                key={name}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0',
                  isActive && 'bg-primary text-primary-foreground'
                )}
              >
                <ProxyFlag name={name} className="h-2.5 w-auto" />
                <span className="truncate max-w-[80px]">{getDisplayName(name)}</span>
                {delay !== undefined && delay > 0 && (
                  <span className={cn(
                    'font-mono tabular-nums font-bold',
                    getDelayColorClass(delay)
                  )}>
                    {delay}
                  </span>
                )}
              </span>
            )
          })}
        </div>
      </CardHeader>

      {/* Proxy card grid — animated height via CSS grid */}
      <div className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out',
        showCards ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      )}>
        <div className={cn(
          'overflow-hidden transition-opacity duration-200',
          showCards ? 'opacity-100 delay-100' : 'opacity-0'
        )}>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-1.5">
              {sortedProxies.map((proxyName) => {
                const isActive = proxyName === nowProxy
                const delay = resolveDelay(proxyName, proxyMap, delayCache)
                const proxy = proxyMap[proxyName]
                const proxyType = proxy?.type?.toLowerCase() ?? ''
                const transport = proxy?.xudp ? 'xudp' : proxy?.udp ? 'udp' : ''
                const proto = transport ? `${proxyType}/${transport}` : proxyType
                return (
                  <button
                    key={proxyName}
                    className={cn(
                      'flex flex-col items-start px-2 py-1 rounded-md text-[13px] text-left transition-all border',
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/30 border-border/50 hover:bg-accent/50',
                      isSelectable && 'cursor-pointer active:scale-95'
                    )}
                    onClick={isSelectable ? () => selectProxyInGroup(groupName, proxyName) : undefined}
                  >
                    <ScrollText className="font-medium w-full">
                      <ProxyFlag name={proxyName} className="h-3 w-auto shrink-0" />
                      {getDisplayName(proxyName)}
                    </ScrollText>
                    <div className="flex items-center justify-between w-full">
                      <span className={cn(
                        'text-xs leading-tight',
                        isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}>
                        {proto}
                      </span>
                      {delay !== undefined && delay > 0 && (
                        <span className={cn(
                          'text-[13px] leading-tight font-mono tabular-nums font-bold',
                          isActive ? 'text-primary-foreground/70' : getDelayColorClass(delay)
                        )}>
                          {delay}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

          </CardContent>
        </div>
      </div>
    </Card>
  )
}
