import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useOverviewStore } from '@/stores/overview'
import { formatSpeed, formatBytes } from '@/lib/format'

function ChartHeader({ items }: { items: { color: string; label: string; value?: string; icon?: React.ReactNode }[] }) {
  return (
    <div className="flex items-center justify-center gap-4 mb-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {item.icon || (
            <span
              className="size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
          )}
          <span className="text-sm font-medium leading-none">{item.label}</span>
          {item.value && (
            <span className="text-xs text-muted-foreground tabular-nums leading-none">{item.value}</span>
          )}
        </div>
      ))}
    </div>
  )
}

const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 8,
  fontFamily: 'Inter, sans-serif',
}

const TICK_STYLE = {
  fontSize: 10,
  fontFamily: 'Inter, sans-serif',
}

export function SpeedChart() {
  const trafficHistory = useOverviewStore((s) => s.trafficHistory)
  const downloadSpeed = useOverviewStore((s) => s.downloadSpeed)
  const uploadSpeed = useOverviewStore((s) => s.uploadSpeed)

  return (
    <div className="rounded-xl border bg-card p-4 min-w-0 overview-card">
      <ChartHeader
        items={[
          { color: 'var(--chart-2)', label: 'Отдача', value: formatSpeed(uploadSpeed), icon: <ArrowUp className="size-3.5 shrink-0" style={{ color: 'var(--chart-2)' }} /> },
          { color: 'var(--chart-1)', label: 'Загрузка', value: formatSpeed(downloadSpeed), icon: <ArrowDown className="size-3.5 shrink-0" style={{ color: 'var(--chart-1)' }} /> },
        ]}
      />
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={trafficHistory}>
          <defs>
            <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" hide />
          <YAxis
            tickFormatter={(v: number) => formatSpeed(v)}
            width={70}
            tick={TICK_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={((v: number | undefined) => [formatSpeed(v ?? 0)]) as never}
            labelFormatter={() => ''}
            contentStyle={TOOLTIP_STYLE}
          />
          <Area
            type="monotone"
            dataKey="down"
            stroke="var(--chart-1)"
            strokeWidth={1.5}
            fill="url(#downGrad)"
            isAnimationActive={false}
            name="Загрузка"
          />
          <Area
            type="monotone"
            dataKey="up"
            stroke="var(--chart-2)"
            strokeWidth={1.5}
            fill="url(#upGrad)"
            isAnimationActive={false}
            name="Отдача"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Mihomo memory + System RAM on one chart (same Y-axis, both in bytes) */
export function MemoryChart() {
  const memoryHistory = useOverviewStore((s) => s.memoryHistory)
  const memoryInuse = useOverviewStore((s) => s.memoryInuse)
  const systemMemTotal = useOverviewStore((s) => s.systemMemTotal)
  const systemMemUsed = useOverviewStore((s) => s.systemMemUsed)

  const hasSystemMem = systemMemTotal > 0

  const headerItems = [
    { color: 'var(--chart-3)', label: 'Mihomo', value: formatBytes(memoryInuse) },
    ...(hasSystemMem
      ? [{ color: 'var(--chart-4)', label: 'Система', value: `${formatBytes(systemMemUsed)} / ${formatBytes(systemMemTotal)}` }]
      : []),
  ]

  return (
    <div className="rounded-xl border bg-card p-4 min-w-0 overview-card">
      <ChartHeader items={headerItems} />
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={memoryHistory}>
          <defs>
            <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="sysMemGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" hide />
          <YAxis
            tickFormatter={(v: number) => formatBytes(v)}
            width={70}
            tick={TICK_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={((v: number | undefined) => [formatBytes(v ?? 0)]) as never}
            labelFormatter={() => ''}
            contentStyle={TOOLTIP_STYLE}
            itemSorter={(item) => (item.dataKey === 'system' ? -1 : 0)}
          />
          {hasSystemMem && (
            <Area
              type="monotone"
              dataKey="system"
              stroke="var(--chart-4)"
              strokeWidth={1.5}
              fill="url(#sysMemGrad)"
              isAnimationActive={false}
              name="Система"
            />
          )}
          <Area
            type="monotone"
            dataKey="mihomo"
            stroke="var(--chart-3)"
            strokeWidth={1.5}
            fill="url(#memGrad)"
            isAnimationActive={false}
            name="Mihomo"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ConnectionsChart() {
  const connectionsHistory = useOverviewStore((s) => s.connectionsHistory)

  return (
    <div className="rounded-xl border bg-card p-4 min-w-0 overview-card">
      <ChartHeader items={[{ color: 'var(--chart-4)', label: 'Подключения' }]} />
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={connectionsHistory}>
          <defs>
            <linearGradient id="connGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" hide />
          <YAxis
            width={40}
            tick={TICK_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            labelFormatter={() => ''}
            contentStyle={TOOLTIP_STYLE}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-4)"
            strokeWidth={1.5}
            fill="url(#connGrad)"
            isAnimationActive={false}
            name="Подключения"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CpuChart() {
  const cpuHistory = useOverviewStore((s) => s.cpuHistory)

  return (
    <div className="rounded-xl border bg-card p-4 min-w-0 overview-card">
      <ChartHeader items={[{ color: 'var(--chart-5)', label: 'CPU' }]} />
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={cpuHistory}>
          <defs>
            <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" hide />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            width={40}
            tick={TICK_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={((v: number | undefined) => [`${v ?? 0}%`]) as never}
            labelFormatter={() => ''}
            contentStyle={TOOLTIP_STYLE}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-5)"
            strokeWidth={1.5}
            fill="url(#cpuGrad)"
            isAnimationActive={false}
            name="CPU"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
