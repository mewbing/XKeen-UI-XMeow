import { useEffect, useState, useCallback } from 'react'
import { Server, LayoutDashboard, Package, Info, FileText } from 'lucide-react'
import { useUpdateStore } from '@/stores/update'
import { useHealthCheck, isHealthy } from '@/hooks/useHealthCheck'
import { useBackendAvailable } from '@/hooks/useBackendAvailable'
import { fetchVersions } from '@/lib/config-api'
import { UpdateStatusCard } from '@/components/update/UpdateStatusCard'
import { UpdateChangelog } from '@/components/update/UpdateChangelog'
import { UpdateOverlay } from '@/components/update/UpdateOverlay'
import { SetupGuide } from '@/components/shared/SetupGuide'
import { Skeleton } from '@/components/ui/skeleton'
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
import { toast } from 'sonner'

export default function UpdatesPage() {
  const releaseInfo = useUpdateStore((s) => s.releaseInfo)
  const hasUpdate = useUpdateStore((s) => s.hasUpdate)
  const isExternalUI = useUpdateStore((s) => s.isExternalUI)
  const checking = useUpdateStore((s) => s.checking)
  const applying = useUpdateStore((s) => s.applying)
  const applyingDist = useUpdateStore((s) => s.applyingDist)
  const error = useUpdateStore((s) => s.error)
  const backendAvailable = useBackendAvailable()

  const health = useHealthCheck({ requireMihomo: false })

  const [overlayOpen, setOverlayOpen] = useState(false)
  const [overlayMode, setOverlayMode] = useState<'server' | 'dist'>('server')
  const [confirmAction, setConfirmAction] = useState<{ fn: () => void; title: string; description: string } | null>(null)
  const [versions, setVersions] = useState<{ server: string; dashboard: string; xkeen: string; mihomo: string } | null>(null)

  // Fetch update check if not already loaded
  useEffect(() => {
    if (!releaseInfo) {
      useUpdateStore.getState().checkForUpdate()
    }
  }, [releaseInfo])

  // Fetch system versions
  useEffect(() => {
    if (!backendAvailable) return
    fetchVersions().then(setVersions).catch(() => {})
  }, [backendAvailable])

  // Show error toast when API errors occur
  useEffect(() => {
    if (error) {
      toast.error(error)
      useUpdateStore.getState().clearError()
    }
  }, [error])

  const handleServerUpdate = useCallback(() => {
    const version = releaseInfo?.latest_version || ''
    const displayVersion = version.startsWith('v') ? version : `v${version}`
    setConfirmAction({
      fn: () => {
        setOverlayMode('server')
        setOverlayOpen(true)
      },
      title: `Обновить до ${displayVersion}?`,
      description: 'Сервер будет перезапущен.',
    })
  }, [releaseInfo])

  const handleDistUpdate = useCallback(() => {
    const version = releaseInfo?.latest_version || ''
    const displayVersion = version.startsWith('v') ? version : `v${version}`
    setConfirmAction({
      fn: () => {
        setOverlayMode('dist')
        setOverlayOpen(true)
      },
      title: `Обновить дашборд до ${displayVersion}?`,
      description: 'Файлы дашборда будут перезаписаны.',
    })
  }, [releaseInfo])

  const handleRollback = useCallback(() => {
    setConfirmAction({
      fn: async () => {
        try {
          await useUpdateStore.getState().rollback()
          toast.success('Откат выполнен. Сервер перезапускается...')
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Ошибка отката')
        }
      },
      title: 'Откатить к предыдущей версии?',
      description: 'Будет восстановлена предыдущая версия сервера.',
    })
  }, [])

  const handleCheck = useCallback(() => {
    useUpdateStore.getState().checkForUpdate()
  }, [])

  // Show SetupGuide if health check fails
  if (!isHealthy(health) && !health.loading) {
    return (
      <SetupGuide
        mihomoOk={health.mihomoOk}
        configApiOk={health.configApiOk}
        loading={health.loading}
        onRetry={health.retry}
      />
    )
  }

  // Loading state
  if (releaseInfo === null && checking) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  // No release info and not loading
  if (!releaseInfo) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Update cards */}
      {isExternalUI ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <UpdateStatusCard
            label="Сервер XMeow"
            icon={Server}
            currentVersion={releaseInfo.current_version}
            latestVersion={releaseInfo.latest_version}
            hasUpdate={hasUpdate}
            assetSize={releaseInfo.asset_size}
            publishedAt={releaseInfo.published_at}
            checking={checking}
            applying={applying}
            onUpdate={handleServerUpdate}
            onRollback={handleRollback}
            onCheck={handleCheck}
          />

          <UpdateStatusCard
            label="Дашборд"
            icon={LayoutDashboard}
            currentVersion={releaseInfo.current_version}
            latestVersion={releaseInfo.latest_version}
            hasUpdate={hasUpdate}
            assetSize={releaseInfo.dist_size}
            publishedAt={releaseInfo.published_at}
            checking={checking}
            applying={applyingDist}
            onUpdate={handleDistUpdate}
            onRollback={() => {}}
            onCheck={handleCheck}
            showRollback={false}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <UpdateStatusCard
            label="XMeow"
            icon={Package}
            currentVersion={releaseInfo.current_version}
            latestVersion={releaseInfo.latest_version}
            hasUpdate={hasUpdate}
            assetSize={releaseInfo.asset_size}
            publishedAt={releaseInfo.published_at}
            checking={checking}
            applying={applying}
            onUpdate={handleServerUpdate}
            onRollback={handleRollback}
            onCheck={handleCheck}
          />
        </div>
      )}

      {/* System info */}
      {versions && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex items-center justify-center size-8 rounded-lg bg-muted">
              <Info className="size-4 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium">Система</span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3 md:grid-cols-5">
            <div>
              <span className="text-xs text-muted-foreground">Сервер</span>
              <p className="font-mono tabular-nums">{versions.server !== 'unknown' ? `v${versions.server}` : '--'}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Дашборд</span>
              <p className="font-mono tabular-nums">{versions.dashboard !== 'unknown' ? `v${versions.dashboard}` : '--'}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">XKeen</span>
              <p className="font-mono tabular-nums">{versions.xkeen !== 'unknown' ? versions.xkeen : '--'}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Mihomo</span>
              <p className="font-mono tabular-nums">{versions.mihomo !== 'unknown' ? versions.mihomo : '--'}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Режим</span>
              <p>{isExternalUI ? 'External UI' : 'Встроенный'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Changelog */}
      {releaseInfo.release_notes && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex items-center justify-center size-8 rounded-lg bg-muted">
              <FileText className="size-4 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium">Что нового</span>
          </div>
          <UpdateChangelog releaseNotes={releaseInfo.release_notes} />
        </div>
      )}

      {/* Confirmation AlertDialog */}
      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmAction?.fn()
                setConfirmAction(null)
              }}
            >
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Update overlay */}
      <UpdateOverlay
        open={overlayOpen}
        mode={overlayMode}
        onClose={() => setOverlayOpen(false)}
      />
    </div>
  )
}
