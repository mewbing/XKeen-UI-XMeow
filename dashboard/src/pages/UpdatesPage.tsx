import { useEffect, useState, useCallback } from 'react'
import { useUpdateStore } from '@/stores/update'
import { useHealthCheck, isHealthy } from '@/hooks/useHealthCheck'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function UpdatesPage() {
  const releaseInfo = useUpdateStore((s) => s.releaseInfo)
  const hasUpdate = useUpdateStore((s) => s.hasUpdate)
  const isExternalUI = useUpdateStore((s) => s.isExternalUI)
  const checking = useUpdateStore((s) => s.checking)
  const applying = useUpdateStore((s) => s.applying)
  const applyingDist = useUpdateStore((s) => s.applyingDist)
  const error = useUpdateStore((s) => s.error)

  const health = useHealthCheck({ requireMihomo: false })

  const [overlayOpen, setOverlayOpen] = useState(false)
  const [overlayMode, setOverlayMode] = useState<'server' | 'dist'>('server')
  const [confirmAction, setConfirmAction] = useState<{ fn: () => void; title: string; description: string } | null>(null)

  // Fetch update check if not already loaded
  useEffect(() => {
    if (!releaseInfo) {
      useUpdateStore.getState().checkForUpdate()
    }
  }, [releaseInfo])

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
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-60 w-full rounded-lg" />
      </div>
    )
  }

  // No release info and not loading -- nothing to show yet
  if (!releaseInfo) {
    return (
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      {isExternalUI ? (
        <>
          {/* External-UI mode: two cards */}
          <UpdateStatusCard
            label="Сервер XMeow"
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
        </>
      ) : (
        /* Normal mode: single card */
        <UpdateStatusCard
          label="XMeow"
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
      )}

      {/* Changelog */}
      {releaseInfo.release_notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Что нового</CardTitle>
          </CardHeader>
          <CardContent>
            <UpdateChangelog releaseNotes={releaseInfo.release_notes} />
          </CardContent>
        </Card>
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
