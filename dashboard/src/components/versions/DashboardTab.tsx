import { useState, useEffect, useCallback } from 'react'
import { Download, RotateCcw, Monitor, ChevronDown, ChevronUp, ServerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useReleasesStore } from '@/stores/releases'
import { useOverviewStore } from '@/stores/overview'
import { useUpdateStore } from '@/stores/update'
import { useBackendAvailable } from '@/hooks/useBackendAvailable'
import { ReleasesList } from './ReleasesList'
import { InstallProgress } from './InstallProgress'
import { UpdateChangelog } from '@/components/update/UpdateChangelog'
import { fmtVer } from './shared'
import type { XmeowRelease } from '@/lib/releases-api'

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
  const isExternalUI = useUpdateStore((s) => s.isExternalUI)
  const backendAvailable = useBackendAvailable()

  const xmeowReleases = useReleasesStore((s) => s.xmeowReleases) ?? []
  const xmeowLoading = useReleasesStore((s) => s.xmeowLoading)
  const xmeowInstalling = useReleasesStore((s) => s.xmeowInstalling)
  const xmeowInstallingVersion = useReleasesStore((s) => s.xmeowInstallingVersion)
  const xmeowInstallTarget = useReleasesStore((s) => s.xmeowInstallTarget)
  const xmeowError = useReleasesStore((s) => s.xmeowError)
  const xmeowInstallLog = useReleasesStore((s) => s.xmeowInstallLog) ?? []
  const xmeowInstallDone = useReleasesStore((s) => s.xmeowInstallDone)
  const xmeowDownloadProgress = useReleasesStore((s) => s.xmeowDownloadProgress)
  const fetchXmeowReleases = useReleasesStore((s) => s.fetchXmeowReleases)
  const installXmeowVersion = useReleasesStore((s) => s.installXmeowVersion)
  const resetXmeowInstallState = useReleasesStore((s) => s.resetXmeowInstallState)
  const clearErrors = useReleasesStore((s) => s.clearErrors)
  const setVersions = useOverviewStore((s) => s.setVersions)

  const [showVersions, setShowVersions] = useState(false)
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const showProgress = xmeowInstalling || xmeowInstallLog.length > 0

  useEffect(() => {
    if (active && xmeowReleases.length === 0) {
      fetchXmeowReleases()
    }
  }, [active, xmeowReleases.length, fetchXmeowReleases])

  // After server install completes → open overlay for health-poll + restart
  useEffect(() => {
    if (xmeowInstallDone && xmeowInstallTarget === 'server') {
      const ver = xmeowInstallingVersion
      if (ver) {
        const versionClean = ver.startsWith('v') ? ver.slice(1) : ver
        setVersions({ server: versionClean, dashboard: versionClean })
      }
      resetXmeowInstallState()
      clearErrors()
      onClose()
      onOverlay('server')
    }
  }, [xmeowInstallDone, xmeowInstallTarget, xmeowInstallingVersion, setVersions, resetXmeowInstallState, clearErrors, onClose, onOverlay])

  // After dist install completes → reload page
  useEffect(() => {
    if (xmeowInstallDone && xmeowInstallTarget === 'dist') {
      setTimeout(() => window.location.reload(), 2000)
    }
  }, [xmeowInstallDone, xmeowInstallTarget])

  const handleInstallServer = useCallback((version: string) => {
    onConfirm({
      fn: () => installXmeowVersion(version, 'server'),
      title: `Установить сервер ${version}?`,
      description: 'Сервер будет перезапущен после установки.',
    })
  }, [onConfirm, installXmeowVersion])

  const handleInstallDist = useCallback((version: string) => {
    onConfirm({
      fn: () => installXmeowVersion(version, 'dist'),
      title: `Обновить дашборд до ${version}?`,
      description: 'Файлы дашборда будут перезаписаны. Страница перезагрузится.',
    })
  }, [onConfirm, installXmeowVersion])

  const handleCloseProgress = useCallback(() => {
    resetXmeowInstallState()
    clearErrors()
  }, [resetXmeowInstallState, clearErrors])

  const latestNewer = xmeowReleases.find((r) => r.is_newer)
  const hasUpdate = !!latestNewer
  const currentRelease = xmeowReleases.find((r) => r.is_current)
  const latestWithDist = xmeowReleases.find((r) => r.dist_asset_name && r.is_newer)

  // Changelog: newer version if available, otherwise current, fallback to first
  const changelogRelease = latestNewer ?? currentRelease ?? xmeowReleases[0]

  if (showProgress) {
    return (
      <InstallProgress
        installing={xmeowInstalling}
        installingVersion={xmeowInstallingVersion}
        downloadProgress={xmeowDownloadProgress}
        installLog={xmeowInstallLog}
        installDone={xmeowInstallDone}
        error={xmeowError}
        onClose={handleCloseProgress}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3 pb-1">
      {/* Version header + action buttons */}
      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Dashboard</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium">{fmtVer(dashboardVersion)}</span>
            {hasUpdate && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">обновление</Badge>
            )}
            {!hasUpdate && currentRelease && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">актуально</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Server</span>
          {backendAvailable ? (
            <span className="font-mono font-medium">{fmtVer(serverVersion)}</span>
          ) : (
            <button
              className="font-mono font-medium text-muted-foreground/60 hover:text-foreground transition-colors"
              onClick={() => setShowInstallGuide(!showInstallGuide)}
            >
              --
            </button>
          )}
        </div>
        {!backendAvailable && (
          <div
            className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
            style={{
              gridTemplateRows: showInstallGuide ? '1fr' : '0fr',
              opacity: showInstallGuide ? 1 : 0,
            }}
          >
            <div className="overflow-hidden">
              <div className="rounded-md bg-muted/50 p-2.5 space-y-1.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground/80">Установка XMeow Server:</p>
                <code className="block bg-background/60 rounded px-2 py-1 text-[11px] font-mono select-all">
                  curl -sL https://raw.githubusercontent.com/mewbing/XKeen-UI-XMeow/master/setup.sh | sh
                </code>
                <p>Скрипт установит серверную часть и настроит автозапуск.</p>
              </div>
            </div>
          </div>
        )}

        {latestNewer && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Доступна</span>
            <span className="font-mono font-medium">{latestNewer.tag_name}</span>
          </div>
        )}

        {/* No-backend notice */}
        {!backendAvailable && latestNewer && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-md bg-muted/50 p-2">
            <ServerOff className="h-3.5 w-3.5 shrink-0" />
            <span>Для установки нужен XMeow Server</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {backendAvailable && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                if (!showVersions && xmeowReleases.length === 0) fetchXmeowReleases()
                setShowVersions(!showVersions)
              }}
            >
              {showVersions ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              Откатить
            </Button>
          )}
          {hasUpdate && latestNewer ? (
            <Button
              size="sm"
              className="text-xs"
              disabled={!backendAvailable}
              onClick={() => handleInstallServer(latestNewer.tag_name)}
            >
              <Download className="h-3 w-3 mr-1.5" />
              Обновить до {latestNewer.tag_name}
            </Button>
          ) : currentRelease && backendAvailable ? (
            <Button
              size="sm"
              variant="secondary"
              className="text-xs"
              onClick={() => onConfirm({
                fn: () => installXmeowVersion(currentRelease.tag_name, 'server'),
                title: `Переустановить сервер ${currentRelease.tag_name}?`,
                description: 'Сервер будет перезапущен после установки.',
              })}
            >
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Переустановить
            </Button>
          ) : null}
        </div>

        {/* "Обновить UI" button for external-ui mode */}
        {isExternalUI && latestWithDist && backendAvailable && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full text-xs"
            onClick={() => handleInstallDist(latestWithDist.tag_name)}
          >
            <Monitor className="h-3 w-3 mr-1.5" />
            Обновить UI до {latestWithDist.tag_name}
          </Button>
        )}
      </div>

      {/* Changelog OR version list — mutually exclusive */}
      {showVersions ? (
        <ReleasesList<XmeowRelease>
          releases={xmeowReleases}
          loading={xmeowLoading}
          error={xmeowError}
          onRefresh={fetchXmeowReleases}
          getSize={(rel) => rel.server_asset_size}
          renderAction={(rel) => {
            if (rel.is_current && backendAvailable) {
              return (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                  onClick={() => onConfirm({
                    fn: () => installXmeowVersion(rel.tag_name, 'server'),
                    title: `Переустановить сервер ${rel.tag_name}?`,
                    description: 'Сервер будет перезапущен после установки.',
                  })}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Переустановить
                </Button>
              )
            }
            if (!rel.server_asset_name) return null
            return (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs shrink-0"
                disabled={!backendAvailable}
                onClick={() => handleInstallServer(rel.tag_name)}
              >
                <Download className="h-3 w-3 mr-1" />
                Установить
              </Button>
            )
          }}
        />
      ) : changelogRelease?.body ? (
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Changelog — {changelogRelease.tag_name}
          </p>
          <div className="overflow-y-auto max-h-[40vh]">
            <UpdateChangelog releaseNotes={changelogRelease.body} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
