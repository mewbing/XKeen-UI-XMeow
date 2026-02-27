import { useCallback, useMemo } from 'react'
import { useLocation } from 'react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMihomoWs } from '@/hooks/use-mihomo-ws'
import { useConnectionsStore } from '@/stores/connections'
import { useLogsStore } from '@/stores/logs'
import { ConnectionsTab } from '@/components/connections/ConnectionsTab'
import { LogsTab } from '@/components/logs/LogsTab'
import type { ConnectionsSnapshot } from '@/lib/mihomo-api'

interface LogStructuredMessage {
  time: string
  level: string
  message: string
  fields?: Array<{ key: string; value: string }>
}

const LOG_PARAMS = { level: 'debug', format: 'structured' }

export default function ConnectionsLogsPage() {
  const location = useLocation()
  const defaultTab = location.pathname === '/logs' ? 'logs' : 'connections'

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

  // WebSocket streams -- always active regardless of which tab is shown
  useMihomoWs<ConnectionsSnapshot>('/connections', handleConnections, 1000)
  useMihomoWs<LogStructuredMessage>('/logs', handleLog, undefined, logParams)

  return (
    <Tabs key={defaultTab} defaultValue={defaultTab} className="flex flex-col h-full">
      <TabsList className="w-fit">
        <TabsTrigger value="connections">Подключения</TabsTrigger>
        <TabsTrigger value="logs">Логи</TabsTrigger>
      </TabsList>

      <TabsContent
        value="connections"
        className="flex-1 mt-2 min-h-0 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200"
      >
        <ConnectionsTab />
      </TabsContent>

      <TabsContent
        value="logs"
        className="flex-1 mt-2 min-h-0 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200"
      >
        <LogsTab />
      </TabsContent>
    </Tabs>
  )
}
