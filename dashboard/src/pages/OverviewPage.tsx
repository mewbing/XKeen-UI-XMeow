import { useEffect, useCallback } from 'react'
import { useOverviewStore } from '@/stores/overview'
import { useMihomoWs } from '@/hooks/use-mihomo-ws'
import { fetchConnectionsSnapshot } from '@/lib/mihomo-api'
import { fetchCpuUsage, fetchSystemMemory } from '@/lib/config-api'
import { useBackendAvailable } from '@/hooks/useBackendAvailable'
import { MetricsCards } from '@/components/overview/MetricsCards'
import { SpeedChart, MemoryChart, ConnectionsChart, CpuChart } from '@/components/overview/TrafficChart'
import { NetworkInfoCard } from '@/components/overview/NetworkInfo'
import { ConnectionStatsCard } from '@/components/overview/ConnectionStats'
import { ConnectionTopologyCard } from '@/components/overview/ConnectionTopology'
import { DnsStatsCard } from '@/components/overview/DnsStats'
import { TopDomainsCard } from '@/components/overview/TopDomains'
import { useHealthCheck, isHealthy } from '@/hooks/useHealthCheck'
import { SetupGuide } from '@/components/shared/SetupGuide'

interface TrafficMessage {
  up: number
  down: number
  upTotal: number
  downTotal: number
}

interface MemoryMessage {
  inuse: number
  oslimit: number
}

export default function OverviewPage() {
  const health = useHealthCheck({ requireMihomo: true, requireConfigApi: false })
  const backendAvailable = useBackendAvailable()

  const updateTraffic = useOverviewStore((s) => s.updateTraffic)
  const updateMemory = useOverviewStore((s) => s.updateMemory)
  const updateConnections = useOverviewStore((s) => s.updateConnections)
  const setConnections = useOverviewStore((s) => s.setConnections)
  const updateSystemPerf = useOverviewStore((s) => s.updateSystemPerf)
  const setStartTime = useOverviewStore((s) => s.setStartTime)

  const handleTraffic = useCallback(
    (data: TrafficMessage) => updateTraffic(data),
    [updateTraffic]
  )
  const handleMemory = useCallback(
    (data: MemoryMessage) => updateMemory(data),
    [updateMemory]
  )

  useMihomoWs<TrafficMessage>('/traffic', handleTraffic)
  useMihomoWs<MemoryMessage>('/memory', handleMemory)

  useEffect(() => {
    setStartTime(Date.now())

    fetchConnectionsSnapshot()
      .then((data) => {
        updateConnections(data.connections.length)
        setConnections(data.connections)
      })
      .catch(() => {})
  }, [setStartTime, updateConnections, setConnections])

  // Initial backend fetch (CPU + system memory together)
  useEffect(() => {
    if (!backendAvailable) return

    Promise.all([fetchCpuUsage(), fetchSystemMemory()])
      .then(([cpuData, memData]) => updateSystemPerf(cpuData.cpu, memData))
      .catch(() => {})
  }, [backendAvailable, updateSystemPerf])

  // Poll connections every 2s, CPU + system memory every 2s (only when backend available)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConnectionsSnapshot()
        .then((data) => {
          updateConnections(data.connections.length)
          setConnections(data.connections)
        })
        .catch(() => {})

      if (backendAvailable) {
        Promise.all([fetchCpuUsage(), fetchSystemMemory()])
          .then(([cpuData, memData]) => updateSystemPerf(cpuData.cpu, memData))
          .catch(() => {})
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [updateConnections, setConnections, updateSystemPerf, backendAvailable])

  if (!isHealthy(health)) {
    return (
      <SetupGuide
        mihomoOk={health.mihomoOk}
        configApiOk={health.configApiOk}
        loading={health.loading}
        onRetry={health.retry}
      />
    )
  }

  return (
    <div className="space-y-4">
      <MetricsCards backendAvailable={backendAvailable} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SpeedChart />
        <MemoryChart />
        <div className={backendAvailable ? '' : 'lg:col-span-2'}>
          <ConnectionsChart />
        </div>
        {backendAvailable && <CpuChart />}
      </div>

      <NetworkInfoCard />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopDomainsCard />
        <DnsStatsCard />
      </div>

      <ConnectionStatsCard />

      <ConnectionTopologyCard />

    </div>
  )
}
