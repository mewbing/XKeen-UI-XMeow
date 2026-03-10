import { useMemo } from 'react'
import { Globe } from 'lucide-react'
import { useOverviewStore } from '@/stores/overview'

export function DnsStatsCard() {
  const connections = useOverviewStore((s) => s.connections)

  const stats = useMemo(() => {
    const domainCounts = new Map<string, number>()
    const dnsModeCounts = new Map<string, number>()

    for (const conn of connections) {
      const host = conn.metadata.host || conn.metadata.destinationIP
      if (host) {
        domainCounts.set(host, (domainCounts.get(host) ?? 0) + 1)
      }

      const mode = conn.metadata.dnsMode || 'normal'
      dnsModeCounts.set(mode, (dnsModeCounts.get(mode) ?? 0) + 1)
    }

    const topDomains = Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    return {
      uniqueDomains: domainCounts.size,
      totalConnections: connections.length,
      topDomains,
      dnsModeCounts: Array.from(dnsModeCounts.entries()).sort((a, b) => b[1] - a[1]),
    }
  }, [connections])

  return (
    <div className="rounded-xl border bg-card p-4 min-w-0 overview-card">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="size-4" />
        <span className="text-sm font-medium">DNS-статистика</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {stats.uniqueDomains} доменов
        </span>
      </div>

      {/* DNS Mode breakdown */}
      {stats.dnsModeCounts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {stats.dnsModeCounts.map(([mode, count]) => (
            <span
              key={mode}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
            >
              <span className="font-medium">{mode}</span>
              <span className="text-muted-foreground">{count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Top domains by connection count */}
      {stats.topDomains.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Нет DNS-данных
        </div>
      ) : (
        <div className="space-y-1.5">
          {stats.topDomains.map(([domain, count]) => {
            const pct =
              stats.totalConnections > 0
                ? (count / stats.totalConnections) * 100
                : 0
            return (
              <div key={domain}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-mono truncate max-w-[70%]">
                    {domain}
                  </span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {count}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/50 transition-all duration-300"
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
