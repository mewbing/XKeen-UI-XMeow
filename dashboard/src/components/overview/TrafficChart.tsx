/**
 * Traffic speed chart for Overview page.
 *
 * Line chart showing upload/download speed over last 60 seconds.
 * Uses recharts with animation disabled (data updates every second).
 * Wrapped in shadcn Card with responsive container.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useOverviewStore } from '@/stores/overview'
import { formatSpeed } from '@/lib/format'

export function TrafficChart() {
  const trafficHistory = useOverviewStore((s) => s.trafficHistory)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Скорость трафика
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trafficHistory}>
            <XAxis dataKey="time" hide />
            <YAxis
              tickFormatter={(v: number) => formatSpeed(v)}
              width={80}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(v) => [formatSpeed(Number(v ?? 0))]}
              labelFormatter={() => ''}
            />
            <Line
              type="monotone"
              dataKey="up"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name="Upload"
            />
            <Line
              type="monotone"
              dataKey="down"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name="Download"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
