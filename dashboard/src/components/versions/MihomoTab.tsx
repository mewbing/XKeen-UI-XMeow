import { useState, useEffect, useCallback } from 'react'
import { Download, RotateCcw, ChevronDown, ChevronUp, Loader2, ServerOff } from 'lucide-react'
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
import { fmtVer, CopyBtn } from './shared'
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
  const [directUpgradeError, setDirectUpgradeError] = useState<string | null>(null)
  const handleDirectUpgrade = useCallback(async () => {
    setDirectUpgradeError(null)
    const prevVersion = displayVersion
    setDirectUpgrading(true)
    let shouldPoll = false
    try {
      // Race upgradeCore against a 30s timeout —
      // mihomo may restart mid-request (dropping connection) or take long to download
      await Promise.race([
        upgradeCore('release'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000)),
      ])
      // mihomo responded 200 OK — upgrade accepted, will restart
      shouldPoll = true
      toast.success('Mihomo обновлён. Перезапуск...')
    } catch (err) {
      // TypeError = network error (connection dropped, mihomo restarting after upgrade)
      // 'timeout' = 30s race timeout (mihomo still downloading/installing)
      // Other Error = HTTP error response from mihomo (still running, returned error)
      if (err instanceof TypeError || (err instanceof Error && err.message === 'timeout')) {
        shouldPoll = true
        toast.info('Mihomo обновляется, ожидание перезапуска...')
      } else {
        const msg = err instanceof Error ? err.message : 'Ошибка обновления'
        if (msg.includes('already using latest')) {
          toast.info('Установлена последняя версия mihomo')
        } else {
          setDirectUpgradeError(msg)
        }
        setDirectUpgrading(false)
        return
      }
    }
    if (!shouldPoll) {
      setDirectUpgrading(false)
      return
    }
    // Poll for mihomo to restart with new version.
    // Mihomo download can take 60-90s on a router, so we need patience.
    // Wait for: mihomo goes down (restarting) → comes back with new version.
    const pollVersion = async (retries: number, delay: number) => {
      let wentDown = false
      for (let i = 0; i < retries; i++) {
        await new Promise((r) => setTimeout(r, delay))
        try {
          const data = await fetchMihomoVersion()
          const newVer = data.version
          if (prevVersion && newVer !== prevVersion) {
            // Version changed — upgrade successful
            setVersions({ mihomo: newVer })
            fetchMihomoReleases()
            toast.success(`Mihomo обновлён: ${prevVersion} → ${newVer}`)
            setDirectUpgrading(false)
            return
          }
          if (wentDown) {
            // Mihomo restarted but version unchanged — upgrade failed
            setVersions({ mihomo: newVer })
            fetchMihomoReleases()
            toast.warning('Mihomo перезапущен, но версия не изменилась')
            setDirectUpgrading(false)
            return
          }
          // Same version, mihomo still running — still downloading, keep waiting
        } catch {
          // mihomo is down — restarting
          wentDown = true
        }
      }
      toast.error('Не удалось дождаться обновления mihomo. Проверьте вручную.')
      setDirectUpgrading(false)
    }
    // 15 retries × 5s = 75s polling after initial 30s timeout = ~105s total
    pollVersion(15, 5000)
  }, [setVersions, fetchMihomoReleases, displayVersion])

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

      {/* Direct upgrade error with backend install suggestion */}
      {directUpgradeError && !backendAvailable && (
        <DirectUpgradeErrorPanel
          error={directUpgradeError}
          onDismiss={() => setDirectUpgradeError(null)}
        />
      )}

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

/** Compact error with expandable install instructions. */
function DirectUpgradeErrorPanel({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const setupCmd = "curl -sL https://raw.githubusercontent.com/mewbing/XKeen-UI-XMeow/master/setup.sh | sh"

  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <ServerOff className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium hover:underline cursor-pointer text-left"
          >
            Не удалось обновить mihomo
          </button>
          <p className="text-[11px] text-muted-foreground break-all mt-0.5">{error}</p>
        </div>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={onDismiss}>
          <span className="text-xs text-muted-foreground">&times;</span>
        </Button>
      </div>

      {expanded && (
        <div className="space-y-2 pt-1 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Установите XMeow Server — он обновляет mihomo через RAM, без ограничений по месту на диске.
          </p>
          <p className="text-[11px] text-muted-foreground">SSH на роутере:</p>
          <div className="flex items-center gap-1.5 bg-muted/50 rounded px-2 py-1.5">
            <code className="text-[11px] font-mono break-all flex-1 select-all">{setupCmd}</code>
            <CopyBtn text={setupCmd} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            После установки перезагрузите страницу — кнопка обновления заработает.
          </p>
        </div>
      )}

      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-[11px] text-primary/70 hover:text-primary hover:underline cursor-pointer pl-6"
        >
          Как исправить?
        </button>
      )}
    </div>
  )
}
