import { useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { useOverviewStore } from '@/stores/overview'
import { formatBytes } from '@/lib/format'

interface SourceStats {
  sourceIP: string
  download: number
  upload: number
  total: number
  count: number
}

export function ConnectionStatsCard() {
  const connections = useOverviewStore((s) => s.connections)

  const stats = useMemo(() => {
    const map = new Map<string, SourceStats>()
    for (const conn of connections) {
      const ip = conn.metadata.sourceIP
      const existing = map.get(ip)
      if (existing) {
        existing.download += conn.download
        existing.upload += conn.upload
        existing.total += conn.download + conn.upload
        existing.count += 1
      } else {
        map.set(ip, {
          sourceIP: ip,
          download: conn.download,
          upload: conn.upload,
          total: conn.download + conn.upload,
          count: 1,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [connections])

  return (
    <div className="rounded-xl border bg-card p-4 min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="size-4" />
        <span className="text-sm font-medium">Статистика соединений</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {connections.length} соед.
        </span>
      </div>
      {stats.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Нет активных соединений
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-3 font-medium">IP</th>
                <th className="text-right py-2 px-2 font-medium">Загр.</th>
                <th className="text-right py-2 px-2 font-medium">Отд.</th>
                <th className="text-right py-2 px-2 font-medium">Всего</th>
                <th className="text-right py-2 pl-2 font-medium">Кол-во</th>
              </tr>
            </thead>
            <tbody>
              {stats.slice(0, 10).map((s) => (
                <tr key={s.sourceIP} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 font-mono text-xs">
                    {s.sourceIP}
                  </td>
                  <td className="text-right py-1.5 px-2 tabular-nums text-blue-500">
                    {formatBytes(s.download)}
                  </td>
                  <td className="text-right py-1.5 px-2 tabular-nums text-green-500">
                    {formatBytes(s.upload)}
                  </td>
                  <td className="text-right py-1.5 px-2 tabular-nums font-medium">
                    {formatBytes(s.total)}
                  </td>
                  <td className="text-right py-1.5 pl-2 tabular-nums">
                    {s.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
