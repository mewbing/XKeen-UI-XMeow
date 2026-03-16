import { Cpu, Clock, Wifi, WifiOff, Trash2, MonitorSmartphone } from 'lucide-react'
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
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 transition-colors hover:border-accent">
      {/* Header: status + name */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`size-2.5 rounded-full shrink-0 ${
              agent.online ? 'bg-emerald-500' : 'bg-muted-foreground/40'
            }`}
          />
          <span className="font-semibold text-sm truncate">{agent.name || agent.id}</span>
        </div>
        <Badge variant={agent.online ? 'default' : 'secondary'} className="text-[10px]">
          {agent.online ? 'Online' : 'Offline'}
        </Badge>
      </div>

      {/* Info rows */}
      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Cpu className="size-3.5 shrink-0" />
          <span>{agent.arch || '--'}</span>
          {agent.mihomo_ver && (
            <>
              <span className="text-muted-foreground/40">|</span>
              <span>mihomo {agent.mihomo_ver}</span>
            </>
          )}
        </div>

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

        <div className="flex items-center gap-1.5">
          {agent.online ? (
            <Wifi className="size-3.5 shrink-0" />
          ) : (
            <WifiOff className="size-3.5 shrink-0" />
          )}
          <span>{formatRelativeTime(agent.last_heartbeat)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1 h-8 text-xs"
          disabled={!agent.online}
          onClick={() => onConnect(agent.id)}
        >
          Подключиться
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(agent.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
