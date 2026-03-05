import { useCallback } from 'react'
import { Download, RotateCcw, RefreshCw, Loader2, ArrowUpCircle, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useUpdateStore } from '@/stores/update'
import { useOverviewStore } from '@/stores/overview'
import { toast } from 'sonner'
import { fmtVer } from './shared'

interface ConfirmAction {
  fn: () => void
  title: string
  description: string
}

interface DashboardTabProps {
  active: boolean
  onClose: () => void
  onConfirm: (action: ConfirmAction) => void
  onOverlay: (mode: 'server' | 'dist') => void
}

export function DashboardTab({ active, onClose, onConfirm, onOverlay }: DashboardTabProps) {
  const serverVersion = useOverviewStore((s) => s.serverVersion)
  const dashboardVersion = useOverviewStore((s) => s.dashboardVersion)
  const hasUpdate = useUpdateStore((s) => s.hasUpdate)
  const isExternalUI = useUpdateStore((s) => s.isExternalUI)
  const checking = useUpdateStore((s) => s.checking)
  const applying = useUpdateStore((s) => s.applying)
  const applyingDist = useUpdateStore((s) => s.applyingDist)
  const releaseInfo = useUpdateStore((s) => s.releaseInfo)

  const handleCheck = useCallback(() => {
    useUpdateStore.getState().checkForUpdate()
  }, [])

  const handleServerUpdate = useCallback(() => {
    const ver = fmtVer(releaseInfo?.latest_version || '')
    onConfirm({
      fn: () => {
        onClose()
        onOverlay('server')
      },
      title: `Обновить сервер до ${ver}?`,
      description: 'Сервер будет перезапущен.',
    })
  }, [releaseInfo, onClose, onConfirm, onOverlay])

  const handleDistUpdate = useCallback(() => {
    const ver = fmtVer(releaseInfo?.latest_version || '')
    onConfirm({
      fn: () => {
        onClose()
        onOverlay('dist')
      },
      title: `Обновить дашборд до ${ver}?`,
      description: 'Файлы дашборда будут перезаписаны.',
    })
  }, [releaseInfo, onClose, onConfirm, onOverlay])

  const handleRollback = useCallback(() => {
    onConfirm({
      fn: async () => {
        try {
          await useUpdateStore.getState().rollback()
          toast.success('Откат выполнен. Сервер перезапускается...')
          onClose()
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Ошибка отката')
        }
      },
      title: 'Откатить сервер к предыдущей версии?',
      description: 'Будет восстановлена предыдущая версия из резервной копии (.bak).',
    })
  }, [onClose, onConfirm])

  return (
    <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
      <div className="space-y-4 pb-2">
        {/* Versions block */}
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Dashboard</span>
            <span className="font-mono font-medium">{fmtVer(dashboardVersion)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Server</span>
            <span className="font-mono font-medium">{fmtVer(serverVersion)}</span>
          </div>
          {releaseInfo && hasUpdate && (
            <div className="animate-in fade-in-0 duration-200 space-y-2">
              <div className="border-t pt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Доступна версия</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{fmtVer(releaseInfo.latest_version)}</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    <ArrowUpCircle className="h-2.5 w-2.5 mr-0.5" />
                    обновление
                  </Badge>
                </div>
              </div>
              {releaseInfo.published_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Дата релиза</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(releaseInfo.published_at).toLocaleDateString('ru-RU', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          )}
          {!hasUpdate && !checking && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Статус</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0">актуально</Badge>
            </div>
          )}
        </div>

        {/* Release notes */}
        {releaseInfo?.release_notes && hasUpdate && (
          <div className="space-y-1.5 animate-in fade-in-0 duration-200">
            <p className="text-sm font-medium text-muted-foreground">
              Изменения ({fmtVer(releaseInfo.latest_version)})
            </p>
            <pre className="bg-muted rounded-md p-3 text-sm font-mono leading-relaxed overflow-y-auto max-h-[40vh] whitespace-pre-wrap">
              {releaseInfo.release_notes}
            </pre>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {hasUpdate && (
            <div className="flex gap-2 animate-in fade-in-0 duration-200">
              <Button
                className="flex-1"
                disabled={applying || checking}
                onClick={handleServerUpdate}
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                Обновить сервер
              </Button>
              {isExternalUI && (
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={applyingDist || checking}
                  onClick={handleDistUpdate}
                >
                  {applyingDist ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                  Обновить дашборд
                </Button>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={applying}
              onClick={handleRollback}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Откатить
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              disabled={checking}
              onClick={handleCheck}
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
              Проверить
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
