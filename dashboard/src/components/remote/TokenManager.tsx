import { useState, useEffect, useCallback } from 'react'
import { Plus, Copy, Check, AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  createToken,
  listTokens,
  revokeToken,
  type AgentToken,
} from '@/lib/remote-api'

function TokenCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        throw new Error('no secure context')
      }
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={handleCopy}
      title="Копировать"
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </Button>
  )
}

function formatDate(iso: string): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function TokenManager() {
  const [open, setOpen] = useState(false)
  const [tokens, setTokens] = useState<AgentToken[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [newToken, setNewToken] = useState<AgentToken | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revokeId, setRevokeId] = useState<string | null>(null)

  const loadTokens = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listTokens()
      setTokens(list)
    } catch {
      // Silently fail — tokens list is non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadTokens()
      setNewToken(null)
      setName('')
      setError(null)
    }
  }, [open, loadTokens])

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    try {
      const token = await createToken(name.trim())
      setNewToken(token)
      setName('')
      loadTokens()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания токена')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async () => {
    if (!revokeId) return
    try {
      await revokeToken(revokeId)
      setRevokeId(null)
      loadTokens()
    } catch {
      // Silently fail
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="h-8 gap-1.5">
            <Plus className="size-3.5" />
            Создать токен
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Токены агентов</DialogTitle>
            <DialogDescription>
              Создавайте токены для подключения удалённых агентов
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Create new token */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Название агента..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="h-9"
              />
              <Button
                size="sm"
                className="h-9 shrink-0"
                disabled={!name.trim() || creating}
                onClick={handleCreate}
              >
                {creating ? 'Создание...' : 'Создать'}
              </Button>
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            {/* Newly created token — one-time view */}
            {newToken && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-500">
                  <AlertTriangle className="size-3.5" />
                  <span className="text-xs font-medium">
                    Сохраните токен -- он показан один раз!
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded border bg-muted/50 p-2">
                  <code className="text-xs font-mono text-foreground break-all flex-1 select-all">
                    {newToken.token}
                  </code>
                  <TokenCopyButton text={newToken.token} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => setNewToken(null)}
                >
                  Готово
                </Button>
              </div>
            )}

            {/* Existing tokens list */}
            {!loading && tokens.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">Существующие токены</h4>
                <div className="space-y-1.5">
                  {tokens.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 rounded-lg border bg-card p-2.5 text-xs"
                    >
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium truncate">{t.name}</span>
                          {t.revoked && (
                            <Badge variant="secondary" className="text-[10px] py-0">
                              Отозван
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="font-mono">{t.token.slice(0, 8)}...</span>
                          <span>{formatDate(t.created_at)}</span>
                        </div>
                      </div>
                      {!t.revoked && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => setRevokeId(t.id)}
                          title="Отозвать токен"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && tokens.length === 0 && !newToken && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Нет созданных токенов
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <AlertDialog open={revokeId !== null} onOpenChange={(v) => !v && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отозвать токен?</AlertDialogTitle>
            <AlertDialogDescription>
              Агент с этим токеном больше не сможет подключиться к серверу.
              Это действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke}>
              Отозвать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
