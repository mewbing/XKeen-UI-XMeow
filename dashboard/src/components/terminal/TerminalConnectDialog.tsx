/**
 * SSH connect dialog -- prompts for host, port, login, and password.
 *
 * Host/Port/User are prefilled from settings store and updated on change.
 * Password is NEVER saved -- always starts empty.
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
import { useSettingsStore } from '@/stores/settings'

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

  const [password, setPassword] = useState('')

  // Reset password every time dialog opens
  useEffect(() => {
    if (open) setPassword('')
  }, [open])

  const handleSubmit = useCallback(() => {
    if (!password) return
    onConnect(sshHost, sshPort, sshUser, password)
    onOpenChange(false)
  }, [sshHost, sshPort, sshUser, password, onConnect, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>SSH-подключение</DialogTitle>
          <DialogDescription>
            Введите данные для подключения к роутеру
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-4"
        >
          {/* Host + Port row */}
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
