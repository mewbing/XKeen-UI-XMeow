import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { useOverviewStore } from '@/stores/overview'
import { formatBytes } from '@/lib/format'

interface DomainStats {
  domain: string
  download: number
  upload: number
  total: number
  count: number
}

export function TopDomainsCard() {
  const connections = useOverviewStore((s) => s.connections)

  const stats = useMemo(() => {
    const map = new Map<string, DomainStats>()
    for (const conn of connections) {
      const domain = conn.metadata.host || conn.metadata.destinationIP
      if (!domain) continue
      const existing = map.get(domain)
      if (existing) {
        existing.download += conn.download
        existing.upload += conn.upload
        existing.total += conn.download + conn.upload
        existing.count += 1
      } else {
        map.set(domain, {
          domain,
          download: conn.download,
          upload: conn.upload,
          total: conn.download + conn.upload,
          count: 1,
        })
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [connections])

  const maxTotal = stats[0]?.total ?? 1

  return (
    <div className="rounded-xl border bg-card p-4 min-w-0 overview-card">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="size-4" />
        <span className="text-sm font-medium">Топ доменов по трафику</span>
      </div>
      {stats.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Нет данных
        </div>
      ) : (
        <div className="space-y-2">
          {stats.map((s) => {
            const pct = (s.total / maxTotal) * 100
            return (
              <div key={s.domain}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-mono truncate max-w-[55%]">
                    {s.domain}
                  </span>
                  <div className="flex items-center shrink-0 tabular-nums text-right">
                    <span className="text-green-500 w-[4.5rem] text-right">
                      {formatBytes(s.download)}
                    </span>
                    <span className="text-blue-500 w-[4.5rem] text-right">
                      {formatBytes(s.upload)}
                    </span>
                    <span className="font-medium w-[4.5rem] text-right">
                      {formatBytes(s.total)}
                    </span>
                  </div>
                </div>
                <div className="h-1 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/40 transition-all duration-300"
                    style={{ width: `${Math.max(pct, 2)}%` }}
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
