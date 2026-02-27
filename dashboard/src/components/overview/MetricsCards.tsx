/**
 * Metrics cards component for Overview page.
 *
 * Two display modes:
 * - Compact: horizontal row of small stat cards
 * - Panels: 2x2 grid of larger cards with more detail
 *
 * Toggle between modes via shadcn/ui ToggleGroup.
 * Uses selective Zustand subscriptions to prevent unnecessary re-renders.
 */

import { Clock, ArrowUpDown, Gauge, Network, MemoryStick, LayoutGrid, LayoutList } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useOverviewStore } from '@/stores/overview'
import { formatBytes, formatSpeed, formatUptime } from '@/lib/format'

// --- Compact mode: small stat card ---

function CompactCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <Card className="py-3 flex-1 min-w-[120px] max-w-full overflow-hidden">
      <CardContent className="flex items-center gap-3 px-4">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-sm font-semibold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Compact mode row ---

function CompactMetrics() {
  const uploadSpeed = useOverviewStore((s) => s.uploadSpeed)
  const downloadSpeed = useOverviewStore((s) => s.downloadSpeed)
  const uploadTotal = useOverviewStore((s) => s.uploadTotal)
  const downloadTotal = useOverviewStore((s) => s.downloadTotal)
  const memoryInuse = useOverviewStore((s) => s.memoryInuse)
  const activeConnections = useOverviewStore((s) => s.activeConnections)
  const startTime = useOverviewStore((s) => s.startTime)

  return (
    <div className="flex flex-wrap gap-2 overflow-hidden">
      <CompactCard
        icon={Clock}
        label="Аптайм"
        value={formatUptime(startTime)}
      />
      <CompactCard
        icon={ArrowUpDown}
        label="Трафик"
        value={`${formatBytes(uploadTotal)} / ${formatBytes(downloadTotal)}`}
      />
      <CompactCard
        icon={Gauge}
        label="Скорость"
        value={`${formatSpeed(uploadSpeed)} / ${formatSpeed(downloadSpeed)}`}
      />
      <CompactCard
        icon={Network}
        label="Подключения"
        value={String(activeConnections)}
      />
      <CompactCard
        icon={MemoryStick}
        label="Память"
        value={formatBytes(memoryInuse)}
      />
    </div>
  )
}

// --- Panels mode: larger 2x2 cards ---

function PanelCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <Card className="py-4 overflow-hidden">
      <CardContent className="px-4 space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function PanelsMetrics() {
  const uploadSpeed = useOverviewStore((s) => s.uploadSpeed)
  const downloadSpeed = useOverviewStore((s) => s.downloadSpeed)
  const uploadTotal = useOverviewStore((s) => s.uploadTotal)
  const downloadTotal = useOverviewStore((s) => s.downloadTotal)
  const memoryInuse = useOverviewStore((s) => s.memoryInuse)
  const activeConnections = useOverviewStore((s) => s.activeConnections)
  const startTime = useOverviewStore((s) => s.startTime)

  return (
    <div className="grid grid-cols-2 gap-3 overflow-hidden">
      <PanelCard icon={ArrowUpDown} title="Трафик">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Загрузка</span>
            <span className="font-semibold">{formatBytes(uploadTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Скачивание</span>
            <span className="font-semibold">{formatBytes(downloadTotal)}</span>
          </div>
        </div>
      </PanelCard>

      <PanelCard icon={Gauge} title="Скорость">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Загрузка</span>
            <span className="font-semibold">{formatSpeed(uploadSpeed)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Скачивание</span>
            <span className="font-semibold">{formatSpeed(downloadSpeed)}</span>
          </div>
        </div>
      </PanelCard>

      <PanelCard icon={Network} title="Подключения">
        <p className="text-2xl font-bold truncate">{activeConnections}</p>
      </PanelCard>

      <PanelCard icon={MemoryStick} title="Память">
        <p className="text-2xl font-bold truncate">{formatBytes(memoryInuse)}</p>
        <p className="text-xs text-muted-foreground">
          Аптайм: {formatUptime(startTime)}
        </p>
      </PanelCard>
    </div>
  )
}

// --- Main component with toggle ---

export function MetricsCards() {
  const metricsMode = useOverviewStore((s) => s.metricsMode)
  const setMetricsMode = useOverviewStore((s) => s.setMetricsMode)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ToggleGroup
          type="single"
          value={metricsMode}
          onValueChange={(value) => {
            if (value) setMetricsMode(value as 'compact' | 'panels')
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="compact" aria-label="Компактный вид">
            <LayoutList className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="panels" aria-label="Панели">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {metricsMode === 'compact' ? <CompactMetrics /> : <PanelsMetrics />}
    </div>
  )
}
