import { Cpu, Clock, Wifi, WifiOff, Trash2, MonitorSmartphone, Globe, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { AgentInfo } from '@/lib/remote-api'

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}д ${h}ч`
  if (h > 0) return `${h}ч ${m}мин`
  return `${m}мин`
}

/** Extract clean semver from raw mihomo version string like "Mihomo Meta v1.19.21 linux arm64 ..." → "v1.19.21" */
function cleanVersion(ver: string): string {
  if (!ver) return ''
  const m = ver.match(/v?\d+(?:\.\d+)+/)
  return m ? (m[0].startsWith('v') ? m[0] : 'v' + m[0]) : ver
}

function formatRelativeTime(iso: string): string {
  if (!iso) return '--'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return `${Math.floor(diff / 86400)} д назад`
}

interface AgentCardProps {
  agent: AgentInfo
  onConnect: (id: string) => void
  onDelete: (id: string) => void
}

export function AgentCard({ agent, onConnect, onDelete }: AgentCardProps) {
  const isDirect = agent.type === 'direct'

  return (
    <div className="flex flex-col rounded-lg border bg-card p-4 gap-3 transition-colors hover:border-accent w-80 min-w-0 overflow-hidden">
      {/* Header: status + name + type badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`size-2.5 rounded-full shrink-0 ${
              agent.online ? 'bg-emerald-500' : 'bg-muted-foreground/40'
            }`}
          />
          <span className="font-semibold text-sm truncate">{agent.name || agent.id}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {isDirect ? 'Прямое' : 'Реверс'}
          </Badge>
        </div>
        <Badge variant={agent.online ? 'default' : 'secondary'} className="text-[10px]">
          {agent.online ? 'Online' : 'Offline'}
        </Badge>
      </div>

      {/* Info rows */}
      <div className="space-y-1.5 text-xs text-muted-foreground">
        {/* Direct: connection target */}
        {isDirect && (
          <div className="flex items-center gap-1.5">
            <Globe className="size-3.5 shrink-0" />
            <span className="font-mono">{agent.host || agent.ip}:{agent.mihomo_port || 9090}</span>
            {agent.has_server && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <Server className="size-3 shrink-0" />
                <span>:{agent.server_port}</span>
              </>
            )}
          </div>
        )}

        {/* Arch + mihomo version */}
        {(agent.arch || agent.mihomo_ver) && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Cpu className="size-3.5 shrink-0" />
            <span className="truncate">{agent.arch || '--'}{agent.mihomo_ver ? ` | mihomo ${cleanVersion(agent.mihomo_ver)}` : ''}</span>
          </div>
        )}

        {/* IP + uptime */}
        {(agent.ip || !isDirect) && (
          <div className="flex items-center gap-1.5">
            <MonitorSmartphone className="size-3.5 shrink-0" />
            <span className="font-mono">{agent.ip || '--'}</span>
            {agent.online && agent.uptime_sec > 0 && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <Clock className="size-3 shrink-0" />
                <span>{formatUptime(agent.uptime_sec)}</span>
              </>
            )}
          </div>
        )}

        {/* Last heartbeat / probe */}
        {(agent.last_heartbeat || !isDirect) && (
          <div className="flex items-center gap-1.5">
            {agent.online ? (
              <Wifi className="size-3.5 shrink-0" />
            ) : (
              <WifiOff className="size-3.5 shrink-0" />
            )}
            <span>{formatRelativeTime(agent.last_heartbeat)}</span>
          </div>
        )}

        {/* Direct without server: minimal info */}
        {isDirect && !agent.has_server && !agent.arch && (
          <div className="flex items-center gap-1.5">
            <Server className="size-3.5 shrink-0" />
            <span className="text-muted-foreground/50">Только mihomo (базовый доступ)</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1 mt-auto">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs px-4"
          disabled={!agent.online}
          onClick={() => onConnect(agent.id)}
        >
          Подключиться
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(agent.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
