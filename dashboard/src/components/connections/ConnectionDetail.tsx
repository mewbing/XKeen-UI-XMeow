import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConnectionsStore } from '@/stores/connections'
import { formatBytes } from '@/lib/format'
import type { ConnectionWithSpeed } from '@/stores/connections'

interface ConnectionDetailProps {
  connection: ConnectionWithSpeed
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="font-mono truncate">{value || '—'}</span>
    </div>
  )
}

export function ConnectionDetail({ connection }: ConnectionDetailProps) {
  const closeConnection = useConnectionsStore((s) => s.closeConnection)
  const { metadata } = connection

  return (
    <div className="p-3 bg-muted/50 border-t text-xs">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <DetailRow label="Процесс" value={metadata.processPath || 'Unknown'} />
        <DetailRow label="Цепочка" value={connection.chains.join(' -> ')} />
        <DetailRow label="sniffHost" value={metadata.sniffHost} />
        <DetailRow label="DNS Mode" value={metadata.dnsMode} />
        <DetailRow label="Remote Dest" value={metadata.remoteDestination} />
        <DetailRow label="DSCP" value={String(metadata.dscp)} />
        <DetailRow label="Special Proxy" value={metadata.specialProxy} />
        <DetailRow label="Special Rules" value={metadata.specialRules} />
        <DetailRow label="Rule Payload" value={connection.rulePayload} />
        <DetailRow label="Начало" value={new Date(connection.start).toLocaleString()} />
        <DetailRow label="DL всего" value={formatBytes(connection.download)} />
        <DetailRow label="UL всего" value={formatBytes(connection.upload)} />
      </div>
      <div className="mt-2 flex justify-end">
        <Button
          variant="outline"
          size="xs"
          className="text-destructive hover:text-destructive"
          onClick={() => closeConnection(connection.id)}
        >
          <X className="size-3" />
          Закрыть подключение
        </Button>
      </div>
    </div>
  )
}
