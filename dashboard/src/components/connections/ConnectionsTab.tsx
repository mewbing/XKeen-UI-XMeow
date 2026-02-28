import { useConnectionsStore } from '@/stores/connections'
import { ConnectionsToolbar } from './ConnectionsToolbar'
import { ConnectionsTable } from './ConnectionsTable'

export function ConnectionsTab() {
  const filteredConnections = useConnectionsStore((s) => s.filteredConnections)
  const visibleColumns = useConnectionsStore((s) => s.visibleColumns)
  const expandedId = useConnectionsStore((s) => s.expandedId)

  const connections = filteredConnections()

  return (
    <div className="flex flex-col h-full">
      <ConnectionsToolbar />
      <div className="flex-1 min-h-0">
        <ConnectionsTable
          connections={connections}
          visibleColumns={visibleColumns}
          expandedId={expandedId}
        />
      </div>
    </div>
  )
}
