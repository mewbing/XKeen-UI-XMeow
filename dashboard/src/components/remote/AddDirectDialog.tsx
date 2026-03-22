import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addDirectAgent } from '@/lib/remote-api'

interface AddDirectDialogProps {
  onAdded: () => void
}

export function AddDirectDialog({ onAdded }: AddDirectDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [mihomoPort, setMihomoPort] = useState('9090')
  const [serverPort, setServerPort] = useState('')
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !host.trim()) return

    setLoading(true)
    setError('')
    try {
      await addDirectAgent({
        name: name.trim(),
        host: host.trim(),
        mihomo_port: parseInt(mihomoPort) || 9090,
        server_port: serverPort ? (parseInt(serverPort) || 0) : 0,
        secret: secret.trim(),
      })
      setOpen(false)
      setName('')
      setHost('')
      setMihomoPort('9090')
      setServerPort('')
      setSecret('')
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Добавить роутер
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Прямое подключение</DialogTitle>
            <DialogDescription>
              Подключение к mihomo API роутера по IP-адресу.
              XMeow Server не обязателен — базовые функции работают напрямую.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="direct-name">Название</Label>
              <Input
                id="direct-name"
                placeholder="Дача, Офис..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 grid gap-1.5">
                <Label htmlFor="direct-host">IP-адрес / Хост</Label>
                <Input
                  id="direct-host"
                  placeholder="192.168.1.1"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="direct-mihomo-port">Порт mihomo</Label>
                <Input
                  id="direct-mihomo-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={mihomoPort}
                  onChange={(e) => setMihomoPort(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="direct-secret">Секрет (mihomo secret)</Label>
              <Input
                id="direct-secret"
                type="password"
                placeholder="Пароль из config.yaml удалённого роутера"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="direct-server-port" className="text-muted-foreground">
                Порт XMeow Server (необязательно)
              </Label>
              <Input
                id="direct-server-port"
                type="number"
                min={1}
                max={65535}
                placeholder="5000 — если XMeow Server установлен"
                value={serverPort}
                onChange={(e) => setServerPort(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading || !name.trim() || !host.trim()}>
              {loading ? 'Добавление...' : 'Добавить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
