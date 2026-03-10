import { useConnectionsStore } from '@/stores/connections'
import { Card, CardContent } from '@/components/ui/card'
import { ConnectionsToolbar } from './ConnectionsToolbar'
import { ConnectionsTable } from './ConnectionsTable'

export function ConnectionsTab() {
  // Subscribe to data that filteredConnections depends on to trigger re-renders
  useConnectionsStore((s) => s.connections)
  const filteredConnections = useConnectionsStore((s) => s.filteredConnections)
  const visibleColumns = useConnectionsStore((s) => s.visibleColumns)
  const expandedId = useConnectionsStore((s) => s.expandedId)

  const connections = filteredConnections()

  return (
    <Card className="flex flex-col flex-1 h-full w-full gap-0 py-0 overflow-hidden">
      <ConnectionsToolbar />
      <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
        <ConnectionsTable
          connections={connections}
          visibleColumns={visibleColumns}
          expandedId={expandedId}
        />
      </CardContent>
    </Card>
  )
}
