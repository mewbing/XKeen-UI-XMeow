import { useState, useEffect, useCallback } from 'react'
import { Download, RotateCcw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useReleasesStore } from '@/stores/releases'
import { useOverviewStore } from '@/stores/overview'
import { useBackendAvailable } from '@/hooks/useBackendAvailable'
import { upgradeCore, fetchMihomoVersion } from '@/lib/mihomo-api'
import { ReleasesList } from './ReleasesList'
import { InstallProgress } from './InstallProgress'
import { UpdateChangelog } from '@/components/update/UpdateChangelog'
import { fmtVer } from './shared'
import type { MihomoRelease } from '@/lib/releases-api'

interface ConfirmAction {
  fn: () => void
  title: string
  description: string
}

interface MihomoTabProps {
  active: boolean
  onConfirm: (action: ConfirmAction) => void
}

export function MihomoTab({ active, onConfirm }: MihomoTabProps) {
  const mihomoReleases = useReleasesStore((s) => s.mihomoReleases) ?? []
  const mihomoCurrentVersion = useReleasesStore((s) => s.mihomoCurrentVersion) ?? ''
  const mihomoLoading = useReleasesStore((s) => s.mihomoLoading)
  const mihomoInstalling = useReleasesStore((s) => s.mihomoInstalling)
  const mihomoInstallingVersion = useReleasesStore((s) => s.mihomoInstallingVersion)
  const mihomoError = useReleasesStore((s) => s.mihomoError)
  const mihomoInstallLog = useReleasesStore((s) => s.mihomoInstallLog) ?? []
  const mihomoInstallDone = useReleasesStore((s) => s.mihomoInstallDone)
  const mihomoDownloadProgress = useReleasesStore((s) => s.mihomoDownloadProgress)
  const fetchMihomoReleases = useReleasesStore((s) => s.fetchMihomoReleases)
  const installMihomoVersion = useReleasesStore((s) => s.installMihomoVersion)
  const resetInstallState = useReleasesStore((s) => s.resetMihomoInstallState)
  const clearErrors = useReleasesStore((s) => s.clearErrors)
  const setVersions = useOverviewStore((s) => s.setVersions)
  const mihomoVersion = useOverviewStore((s) => s.mihomoVersion)
  const backendAvailable = useBackendAvailable()

  // Use overview store version as fallback (fetched directly from mihomo API)
  const displayVersion = mihomoCurrentVersion || mihomoVersion

  const [showVersions, setShowVersions] = useState(false)
  const showProgress = mihomoInstalling || mihomoInstallLog.length > 0

  useEffect(() => {
    if (active && mihomoReleases.length === 0) {
      fetchMihomoReleases()
    }
  }, [active, mihomoReleases.length, fetchMihomoReleases])

  const handleInstall = useCallback(async (version: string) => {
    await installMihomoVersion(version)
    if (useReleasesStore.getState().mihomoInstallDone) {
      const versionClean = version.startsWith('v') ? version.slice(1) : version
      setVersions({ mihomo: versionClean })
    }
  }, [installMihomoVersion, setVersions])

  // Direct upgrade via mihomo API (no Go backend needed)
  const [directUpgrading, setDirectUpgrading] = useState(false)
  const handleDirectUpgrade = useCallback(async () => {
    setDirectUpgrading(true)
    try {
      await upgradeCore('release')
      toast.success('Mihomo обновлён. Перезапуск...')
      // Wait for mihomo to restart, then refresh version
      setTimeout(async () => {
        try {
          const data = await fetchMihomoVersion()
          setVersions({ mihomo: data.version })
          fetchMihomoReleases()
        } catch { /* mihomo may still be restarting */ }
        setDirectUpgrading(false)
      }, 5000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка обновления')
      setDirectUpgrading(false)
    }
  }, [setVersions, fetchMihomoReleases])

  const handleCloseProgress = useCallback(() => {
    resetInstallState()
    clearErrors()
  }, [resetInstallState, clearErrors])

  const latestNewer = mihomoReleases.find((r) => r.is_newer)
  const hasUpdate = !!latestNewer
  const currentRelease = mihomoReleases.find((r) => r.is_current)

  // Changelog: newer version if available, otherwise current, fallback to first
  const changelogRelease = latestNewer ?? currentRelease ?? mihomoReleases[0]

  if (showProgress) {
    return (
      <InstallProgress
        installing={mihomoInstalling}
        installingVersion={mihomoInstallingVersion}
        downloadProgress={mihomoDownloadProgress}
        installLog={mihomoInstallLog}
        installDone={mihomoInstallDone}
        error={mihomoError}
        onClose={handleCloseProgress}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Version header + action buttons */}
      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Текущая версия</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium">{fmtVer(displayVersion)}</span>
            {hasUpdate && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">обновление</Badge>
            )}
            {!hasUpdate && currentRelease && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">актуально</Badge>
            )}
          </div>
        </div>

        {latestNewer && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Доступна</span>
            <span className="font-mono font-medium">{latestNewer.tag_name}</span>
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
                if (!showVersions && mihomoReleases.length === 0) fetchMihomoReleases()
                setShowVersions(!showVersions)
              }}
            >
              {showVersions ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              Откатить
            </Button>
          )}
          {hasUpdate && latestNewer ? (
            backendAvailable ? (
              <Button
                size="sm"
                className="text-xs"
                onClick={() => onConfirm({
                  fn: () => handleInstall(latestNewer.tag_name),
                  title: `Установить mihomo ${latestNewer.tag_name}?`,
                  description: `Текущая версия: ${displayVersion || 'unknown'}. Mihomo будет остановлен, бинарник заменён и запущен заново.`,
                })}
              >
                <Download className="h-3 w-3 mr-1.5" />
                Обновить до {latestNewer.tag_name}
              </Button>
            ) : (
              <Button
                size="sm"
                className="text-xs"
                disabled={directUpgrading}
                onClick={() => onConfirm({
                  fn: handleDirectUpgrade,
                  title: `Обновить mihomo до последней версии?`,
                  description: `Текущая версия: ${displayVersion || 'unknown'}. Mihomo сам скачает обновление и перезапустится.`,
                })}
              >
                {directUpgrading ? (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <Download className="h-3 w-3 mr-1.5" />
                )}
                {directUpgrading ? 'Обновление...' : 'Обновить'}
              </Button>
            )
          ) : currentRelease && backendAvailable ? (
            <Button
              size="sm"
              variant="secondary"
              className="text-xs"
              onClick={() => onConfirm({
                fn: () => handleInstall(currentRelease.tag_name),
                title: `Переустановить mihomo ${currentRelease.tag_name}?`,
                description: 'Mihomo будет остановлен, бинарник заменён и запущен заново.',
              })}
            >
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Переустановить
            </Button>
          ) : null}
        </div>
      </div>

      {/* Changelog OR version list — mutually exclusive */}
      {showVersions ? (
        <ReleasesList<MihomoRelease>
          releases={mihomoReleases}
          loading={mihomoLoading}
          error={mihomoError}
          onRefresh={fetchMihomoReleases}
          getSize={(rel) => rel.asset_size}
          renderAction={(rel) => {
            if (rel.is_current && backendAvailable) {
              return (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                  onClick={() => onConfirm({
                    fn: () => handleInstall(rel.tag_name),
                    title: `Переустановить mihomo ${rel.tag_name}?`,
                    description: 'Mihomo будет остановлен, бинарник заменён и запущен заново.',
                  })}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Переустановить
                </Button>
              )
            }
            if (!rel.asset_name) return null
            return (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs shrink-0"
                disabled={!backendAvailable}
                onClick={() => onConfirm({
                  fn: () => handleInstall(rel.tag_name),
                  title: `Установить mihomo ${rel.tag_name}?`,
                  description: `Текущая версия: ${displayVersion || 'unknown'}. Mihomo будет остановлен, бинарник заменён и запущен заново.`,
                })}
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
