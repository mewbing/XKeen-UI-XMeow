import { useOverviewStore } from '@/stores/overview'
import { formatBytes } from '@/lib/format'

function MetricPairCard({
  label1,
  value1,
  label2,
  value2,
}: {
  label1: string
  value1: string
  label2: string
  value2: string
}) {
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4 flex gap-2 sm:gap-4 min-w-0 overview-card">
      <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
        <span className="text-xs text-muted-foreground truncate max-w-full">{label1}</span>
        <span className="text-base sm:text-xl font-bold tabular-nums truncate max-w-full">{value1}</span>
      </div>
      <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
        <span className="text-xs text-muted-foreground truncate max-w-full">{label2}</span>
        <span className="text-base sm:text-xl font-bold tabular-nums truncate max-w-full">{value2}</span>
      </div>
    </div>
  )
}

interface MetricsCardsProps {
  backendAvailable: boolean
}

export function MetricsCards({ backendAvailable }: MetricsCardsProps) {
  const activeConnections = useOverviewStore((s) => s.activeConnections)
  const memoryInuse = useOverviewStore((s) => s.memoryInuse)
  const systemMemUsed = useOverviewStore((s) => s.systemMemUsed)
  const cpuUsage = useOverviewStore((s) => s.cpuUsage)
  const downloadTotal = useOverviewStore((s) => s.downloadTotal)
  const uploadTotal = useOverviewStore((s) => s.uploadTotal)

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {/* Card 1: CPU + RAM (only with backend) */}
      {backendAvailable && (
        <MetricPairCard
          label1="CPU"
          value1={`${cpuUsage}%`}
          label2="RAM"
          value2={formatBytes(systemMemUsed)}
        />
      )}

      {/* Card 2: Mihomo + Подключения */}
      <MetricPairCard
        label1="Mihomo"
        value1={formatBytes(memoryInuse)}
        label2="Подключения"
        value2={String(activeConnections)}
      />

      {/* Card 3: Total traffic */}
      <MetricPairCard
        label1="Отправлено"
        value1={formatBytes(uploadTotal)}
        label2="Загружено"
        value2={formatBytes(downloadTotal)}
      />
    </div>
  )
}
