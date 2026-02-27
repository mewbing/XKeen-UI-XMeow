/**
 * Overview page -- main dashboard landing page.
 *
 * Displays real-time system metrics from mihomo via WebSocket:
 * - Traffic speed and totals
 * - Memory usage
 * - Active connections (polled every 5s)
 * - Client-side uptime tracking
 * - Version information (mihomo, xkeen, dashboard)
 *
 * Components: MetricsCards (compact/panels toggle), TrafficChart (recharts).
 */

import { useEffect, useCallback } from 'react'
import { useOverviewStore } from '@/stores/overview'
import { useMihomoWs } from '@/hooks/use-mihomo-ws'
import { fetchMihomoVersion, fetchConnectionsSnapshot } from '@/lib/mihomo-api'
import { fetchVersions } from '@/lib/config-api'
import { MetricsCards } from '@/components/overview/MetricsCards'
import { TrafficChart } from '@/components/overview/TrafficChart'

// Traffic WebSocket message shape
interface TrafficMessage {
  up: number
  down: number
  upTotal: number
  downTotal: number
}

// Memory WebSocket message shape
interface MemoryMessage {
  inuse: number
  oslimit: number
}

export default function OverviewPage() {
  const updateTraffic = useOverviewStore((s) => s.updateTraffic)
  const updateMemory = useOverviewStore((s) => s.updateMemory)
  const updateConnections = useOverviewStore((s) => s.updateConnections)
  const setStartTime = useOverviewStore((s) => s.setStartTime)
  const setVersions = useOverviewStore((s) => s.setVersions)
  const mihomoVersion = useOverviewStore((s) => s.mihomoVersion)
  const dashboardVersion = useOverviewStore((s) => s.dashboardVersion)
  const xkeenVersion = useOverviewStore((s) => s.xkeenVersion)

  // Stable callbacks for WebSocket hooks (Zustand actions are already stable)
  const handleTraffic = useCallback(
    (data: TrafficMessage) => updateTraffic(data),
    [updateTraffic]
  )
  const handleMemory = useCallback(
    (data: MemoryMessage) => updateMemory(data),
    [updateMemory]
  )

  // WebSocket streams
  useMihomoWs<TrafficMessage>('/traffic', handleTraffic)
  useMihomoWs<MemoryMessage>('/memory', handleMemory)

  // On mount: fetch versions, set uptime start, get initial connections
  useEffect(() => {
    setStartTime(Date.now())

    fetchMihomoVersion()
      .then((data) => setVersions({ mihomo: data.version }))
      .catch(() => {
        // Silently ignore -- version will show empty
      })

    fetchVersions()
      .then((data) =>
        setVersions({ dashboard: data.dashboard, xkeen: data.xkeen })
      )
      .catch(() => {
        // Silently ignore
      })

    fetchConnectionsSnapshot()
      .then((data) => updateConnections(data.connections.length))
      .catch(() => {
        // Silently ignore
      })
  }, [setStartTime, setVersions, updateConnections])

  // Poll active connections every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConnectionsSnapshot()
        .then((data) => updateConnections(data.connections.length))
        .catch(() => {
          // Silently ignore polling errors
        })
    }, 5000)

    return () => clearInterval(interval)
  }, [updateConnections])

  return (
    <div className="space-y-4">
      <MetricsCards />
      <TrafficChart />

      {/* Version info footer */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground px-1">
        {mihomoVersion && <span>mihomo {mihomoVersion}</span>}
        {xkeenVersion && (
          <>
            <span className="text-border">|</span>
            <span>xkeen {xkeenVersion}</span>
          </>
        )}
        {dashboardVersion && (
          <>
            <span className="text-border">|</span>
            <span>Dashboard {dashboardVersion}</span>
          </>
        )}
      </div>
    </div>
  )
}
