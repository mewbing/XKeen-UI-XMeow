import { Badge } from '@/components/ui/badge'
import { useConnectionsStore } from '@/stores/connections'
import { formatBytes, formatSpeed } from '@/lib/format'
import { ConnectionDetail } from './ConnectionDetail'
import { ProxyFlag } from '@/components/proxies/ProxyFlag'
import { getDisplayName } from '@/lib/flags'
import type { ConnectionWithSpeed } from '@/stores/connections'

interface ConnectionRowProps {
  connection: ConnectionWithSpeed
  visibleColumns: string[]
  isExpanded: boolean
  gridTemplate: string
}

function formatStartTime(start: string): string {
  const d = new Date(start)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function CellContent({ column, connection }: { column: string; connection: ConnectionWithSpeed }) {
  const { metadata } = connection
  switch (column) {
    case 'host':
      return <span className="truncate">{metadata.host || metadata.destinationIP || '—'}</span>
    case 'network':
      return (
        <Badge
          variant="outline"
          className={
            metadata.network.toLowerCase() === 'tcp'
              ? 'text-[var(--color-blue-400)] border-[var(--color-blue-400)]/30 text-[10px] px-1 py-0'
              : 'text-[var(--color-green-400)] border-[var(--color-green-400)]/30 text-[10px] px-1 py-0'
          }
        >
          {metadata.network.toUpperCase()}
        </Badge>
      )
    case 'source':
      return <span className="truncate">{metadata.sourceIP}:{metadata.sourcePort}</span>
    case 'destination':
      return <span className="truncate">{metadata.destinationIP}:{metadata.destinationPort}</span>
    case 'rule':
      return <span className="truncate" title={connection.rule}>{connection.rule}</span>
    case 'chains':
      return (
        <span className="flex items-center gap-0.5 truncate" title={connection.chains.join(' > ')}>
          {connection.chains.map((node, i) => (
            <span key={i} className="flex items-center gap-0.5 shrink-0">
              {i > 0 && <span className="text-muted-foreground mx-0.5">&gt;</span>}
              <ProxyFlag name={node} className="h-2.5 w-auto" />
              <span className="truncate">{getDisplayName(node)}</span>
            </span>
          ))}
        </span>
      )
    case 'dlSpeed':
      return <span className="tabular-nums">{formatSpeed(connection.dlSpeed)}</span>
    case 'ulSpeed':
      return <span className="tabular-nums">{formatSpeed(connection.ulSpeed)}</span>
    case 'dlTotal':
      return <span className="tabular-nums">{formatBytes(connection.download)}</span>
    case 'ulTotal':
      return <span className="tabular-nums">{formatBytes(connection.upload)}</span>
    case 'start':
      return <span className="tabular-nums">{formatStartTime(connection.start)}</span>
    case 'type':
      return <span>{metadata.type}</span>
    default:
      return null
  }
}

export function ConnectionRow({ connection, visibleColumns, isExpanded, gridTemplate }: ConnectionRowProps) {
  const toggleExpanded = useConnectionsStore((s) => s.toggleExpanded)

  return (
    <div>
      <div
        className={`grid items-center h-8 px-2 text-xs font-mono cursor-pointer hover:bg-accent/50 ${isExpanded ? 'bg-accent/30' : ''}`}
        style={{ gridTemplateColumns: gridTemplate }}
        onClick={() => toggleExpanded(connection.id)}
      >
        {visibleColumns.map((col) => (
          <div key={col} className="overflow-hidden px-1">
            <CellContent column={col} connection={connection} />
          </div>
        ))}
      </div>
      {isExpanded && <ConnectionDetail connection={connection} />}
    </div>
  )
}
