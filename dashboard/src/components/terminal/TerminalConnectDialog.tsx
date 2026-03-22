/**
 * SSH connect dialog -- prompts for host, port, login, and password.
 *
 * Host/Port/User are prefilled from settings store and updated on change.
 * Password is NEVER saved -- always starts empty.
 *
 * In remote mode (activeAgentId set), host/port are hidden since the
 * server resolves SSH target from the agent (tunnel port 22 or direct host:22).
 *
 * Uses shadcn Dialog (Radix) since this is a transient form dialog,
 * NOT the persistent terminal modal.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { MonitorSmartphone } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings'
import { useRemoteStore } from '@/stores/remote'

interface TerminalConnectDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConnect: (host: string, port: number, user: string, password: string) => void
}

export function TerminalConnectDialog({
  open,
  onOpenChange,
  onConnect,
}: TerminalConnectDialogProps) {
  const sshHost = useSettingsStore((s) => s.sshHost)
  const sshPort = useSettingsStore((s) => s.sshPort)
  const sshUser = useSettingsStore((s) => s.sshUser)
  const setSshHost = useSettingsStore((s) => s.setSshHost)
  const setSshPort = useSettingsStore((s) => s.setSshPort)
  const setSshUser = useSettingsStore((s) => s.setSshUser)

  const activeAgentId = useRemoteStore((s) => s.activeAgentId)
  const agents = useRemoteStore((s) => s.agents)
  const activeAgent = activeAgentId ? agents.find((a) => a.id === activeAgentId) : null
  const isRemote = !!activeAgentId

  const [password, setPassword] = useState('')

  // Reset password every time dialog opens
  useEffect(() => {
    if (open) setPassword('')
  }, [open])

  const handleSubmit = useCallback(() => {
    if (!password) return
    if (isRemote) {
      // In remote mode, host/port are resolved by the server
      onConnect('', 0, sshUser, password)
    } else {
      onConnect(sshHost, sshPort, sshUser, password)
    }
    onOpenChange(false)
  }, [sshHost, sshPort, sshUser, password, isRemote, onConnect, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>SSH-подключение</DialogTitle>
          <DialogDescription>
            {isRemote
              ? 'Подключение к удалённому роутеру через туннель'
              : 'Введите данные для подключения к роутеру'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-4"
        >
          {/* Remote agent badge */}
          {isRemote && activeAgent && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
              <MonitorSmartphone className="size-4 text-muted-foreground" />
              <span className="text-sm">{activeAgent.name || activeAgent.id}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">
                {activeAgent.type === 'direct' ? 'Прямое' : 'Реверс'}
              </Badge>
            </div>
          )}

          {/* Host + Port row -- hidden in remote mode */}
          {!isRemote && (
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ssh-host" className="text-xs">
                  Хост
                </Label>
                <Input
                  id="ssh-host"
                  value={sshHost}
                  onChange={(e) => setSshHost(e.target.value)}
                  placeholder="localhost"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ssh-port" className="text-xs">
                  Порт
                </Label>
                <Input
                  id="ssh-port"
                  type="number"
                  value={sshPort}
                  onChange={(e) => setSshPort(Number(e.target.value) || 22)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          {/* User */}
          <div className="space-y-1.5">
            <Label htmlFor="ssh-user" className="text-xs">
              Логин
            </Label>
            <Input
              id="ssh-user"
              value={sshUser}
              onChange={(e) => setSshUser(e.target.value)}
              placeholder="root"
              className="h-8 text-sm"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="ssh-password" className="text-xs">
              Пароль
            </Label>
            <Input
              id="ssh-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="h-8 text-sm"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!password} className="w-full sm:w-auto">
              Подключить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
