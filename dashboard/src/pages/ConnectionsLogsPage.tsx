import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router'
import { useMihomoWs } from '@/hooks/use-mihomo-ws'
import { useConnectionsStore } from '@/stores/connections'
import { useLogsStore } from '@/stores/logs'
import { useSettingsStore } from '@/stores/settings'
import { ConnectionsTab } from '@/components/connections/ConnectionsTab'
import { LogsTab } from '@/components/logs/LogsTab'
import type { ConnectionsSnapshot } from '@/lib/mihomo-api'
import { useHealthCheck, isHealthy } from '@/hooks/useHealthCheck'
import { SetupGuide } from '@/components/shared/SetupGuide'

interface LogStructuredMessage {
  time: string
  level: string
  message: string
  fields?: Array<{ key: string; value: string }>
}

const LOG_PARAMS = { level: 'debug', format: 'structured' }

export default function ConnectionsLogsPage() {
  const health = useHealthCheck({ requireMihomo: true })

  const location = useLocation()
  const isLogs = location.pathname === '/logs'
  const splitMode = useSettingsStore((s) => s.splitMode)
  const syncScroll = useSettingsStore((s) => s.syncScroll)

  const updateSnapshot = useConnectionsStore((s) => s.updateSnapshot)
  const addLogEntry = useLogsStore((s) => s.addEntry)

  const handleConnections = useCallback(
    (data: ConnectionsSnapshot) => updateSnapshot(data),
    [updateSnapshot]
  )

  const handleLog = useCallback(
    (data: LogStructuredMessage) => addLogEntry(data),
    [addLogEntry]
  )

  // Stable extraParams reference to avoid WS reconnects
  const logParams = useMemo(() => LOG_PARAMS, [])

  // WebSocket streams -- both active so data keeps flowing on either page
  useMihomoWs<ConnectionsSnapshot>('/connections', handleConnections, 1000)
  useMihomoWs<LogStructuredMessage>('/logs', handleLog, undefined, logParams)

  // Refs for scroll sync
  const panel1Ref = useRef<HTMLDivElement>(null)
  const panel2Ref = useRef<HTMLDivElement>(null)
  const isSyncing = useRef(false)

  useEffect(() => {
    if (splitMode === 'none' || !syncScroll) return

    const getScrollContainer = (panel: HTMLDivElement | null) =>
      panel?.querySelector<HTMLDivElement>('[data-scroll-container]')

    const syncFrom = (source: HTMLDivElement, target: HTMLDivElement) => {
      if (isSyncing.current) return
      isSyncing.current = true
      const maxScroll = source.scrollHeight - source.clientHeight
      const pct = maxScroll > 0 ? source.scrollTop / maxScroll : 0
      const targetMax = target.scrollHeight - target.clientHeight
      target.scrollTop = pct * targetMax
      requestAnimationFrame(() => { isSyncing.current = false })
    }

    const sc1 = getScrollContainer(panel1Ref.current)
    const sc2 = getScrollContainer(panel2Ref.current)
    if (!sc1 || !sc2) return

    const h1 = () => syncFrom(sc1, sc2)
    const h2 = () => syncFrom(sc2, sc1)

    sc1.addEventListener('scroll', h1, { passive: true })
    sc2.addEventListener('scroll', h2, { passive: true })
    return () => {
      sc1.removeEventListener('scroll', h1)
      sc2.removeEventListener('scroll', h2)
    }
  }, [splitMode, syncScroll])

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

  // Single view
  if (splitMode === 'none') {
    return (
      <div className="flex flex-col h-full">
        {isLogs ? <LogsTab /> : <ConnectionsTab />}
      </div>
    )
  }

  // Split view (vertical = side by side, horizontal = top/bottom)
  const isVertical = splitMode === 'vertical'

  return (
    <div className={`flex h-full gap-2 overflow-hidden ${isVertical ? 'flex-row' : 'flex-col'}`}>
      <div ref={panel1Ref} className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
        <ConnectionsTab />
      </div>
      <div ref={panel2Ref} className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
        <LogsTab />
      </div>
    </div>
  )
}
