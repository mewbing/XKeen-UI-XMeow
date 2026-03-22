import { useState, useEffect, useCallback } from 'react'
import { Download, RotateCcw, Monitor, ChevronDown, ChevronUp, Loader2, Copy, CheckCircle2, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useReleasesStore } from '@/stores/releases'
import { useOverviewStore } from '@/stores/overview'
import { useUpdateStore } from '@/stores/update'
import { useBackendAvailable } from '@/hooks/useBackendAvailable'
import { useRemoteStore } from '@/stores/remote'
import { useTerminalStore } from '@/stores/terminal'
import { upgradeUI } from '@/lib/mihomo-api'
import { ReleasesList } from './ReleasesList'
import { InstallProgress } from './InstallProgress'
import { UpdateChangelog } from '@/components/update/UpdateChangelog'
import { fmtVer } from './shared'
import type { XmeowRelease } from '@/lib/releases-api'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [text])
  return (
    <button
      onClick={handleCopy}
      className="absolute top-1.5 right-1.5 p-1 rounded bg-background/80 backdrop-blur-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      title="Копировать"
    >
      {copied ? <CheckCircle2 className="size-3" /> : <Copy className="size-3" />}
    </button>
  )
}

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
  const activeAgentId = useRemoteStore((s) => s.activeAgentId)
  const agents = useRemoteStore((s) => s.agents)
  const activeAgent = activeAgentId ? agents.find((a) => a.id === activeAgentId) : null
  const isRemote = !!activeAgentId

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
  const [upgradeUILoading, setUpgradeUILoading] = useState(false)
  const [upgradeUIError, setUpgradeUIError] = useState<string | null>(null)
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

  const handleUpgradeUI = useCallback(() => {
    onConfirm({
      fn: async () => {
        setUpgradeUILoading(true)
        setUpgradeUIError(null)
        try {
          await upgradeUI()
          setTimeout(() => window.location.reload(), 1500)
        } catch (err) {
          setUpgradeUIError(err instanceof Error ? err.message : 'Ошибка обновления')
          setUpgradeUILoading(false)
        }
      },
      title: 'Обновить дашборд?',
      description: 'Mihomo скачает UI из external-ui-url. Страница перезагрузится.',
    })
  }, [onConfirm])

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
            <span className="font-mono font-medium text-muted-foreground/60">--</span>
          )}
        </div>
        {!backendAvailable && !isRemote && (
          <div className="rounded-md bg-muted/50 p-2.5 space-y-1.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground/80">Установка XMeow Server:</p>
            <div className="relative">
              <code className="block bg-background/60 rounded pl-2 pr-7 py-1 text-[11px] font-mono select-all overflow-x-auto">
                curl -sL https://raw.githubusercontent.com/mewbing/XKeen-UI-XMeow/master/setup.sh | sh
              </code>
              <CopyButton text="curl -sL https://raw.githubusercontent.com/mewbing/XKeen-UI-XMeow/master/setup.sh | sh" />
            </div>
            <p>Скрипт установит серверную часть и настроит автозапуск.</p>
          </div>
        )}

        {/* Agent info — remote mode only */}
        {isRemote && activeAgent && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Agent</span>
              <span className="font-mono font-medium">{fmtVer(activeAgent.agent_ver || '')}</span>
            </div>
            {!backendAvailable && (
              <div className="rounded-md bg-muted/50 p-2.5 space-y-1.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground/80">Установка/обновление через терминал:</p>
                <div className="relative">
                  <code className="block bg-background/60 rounded pl-2 pr-7 py-1 text-[11px] font-mono select-all overflow-x-auto">
                    curl -sL https://raw.githubusercontent.com/mewbing/XKeen-UI-XMeow/master/setup.sh | sh
                  </code>
                  <CopyButton text="curl -sL https://raw.githubusercontent.com/mewbing/XKeen-UI-XMeow/master/setup.sh | sh" />
                </div>
                <p>Установит или обновит сервер и агент на удалённом роутере.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs mt-1"
                  onClick={() => {
                    onClose()
                    useTerminalStore.getState().toggleOpen()
                  }}
                >
                  <Terminal className="h-3 w-3 mr-1.5" />
                  Открыть терминал
                </Button>
              </div>
            )}
          </>
        )}

        {latestNewer && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Доступна</span>
            <span className="font-mono font-medium">{latestNewer.tag_name}</span>
          </div>
        )}

        {/* upgradeUI error */}
        {upgradeUIError && (
          <div className="text-xs text-destructive rounded-md bg-destructive/10 p-2">
            {upgradeUIError}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {/* Primary action */}
          {hasUpdate && latestNewer ? (
            backendAvailable ? (
              <Button
                size="sm"
                className="w-full text-xs"
                onClick={() => handleInstallServer(latestNewer.tag_name)}
              >
                <Download className="h-3 w-3 mr-1.5" />
                Обновить сервер до {latestNewer.tag_name}
              </Button>
            ) : (
              <Button
                size="sm"
                className="w-full text-xs"
                disabled={upgradeUILoading}
                onClick={handleUpgradeUI}
              >
                {upgradeUILoading ? (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <Download className="h-3 w-3 mr-1.5" />
                )}
                Обновить дашборд
              </Button>
            )
          ) : currentRelease && backendAvailable ? (
            <Button
              size="sm"
              variant="secondary"
              className="w-full text-xs"
              onClick={() => onConfirm({
                fn: () => installXmeowVersion(currentRelease.tag_name, 'server'),
                title: `Переустановить сервер ${currentRelease.tag_name}?`,
                description: 'Сервер будет перезапущен после установки.',
              })}
            >
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Переустановить сервер
            </Button>
          ) : null}

          {/* Secondary row */}
          <div className="flex gap-2">
            {isExternalUI && latestWithDist && backendAvailable && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => handleInstallDist(latestWithDist.tag_name)}
              >
                <Monitor className="h-3 w-3 mr-1.5" />
                Обновить UI
              </Button>
            )}
            {backendAvailable && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => {
                  if (!showVersions && xmeowReleases.length === 0) fetchXmeowReleases()
                  setShowVersions(!showVersions)
                }}
              >
                {showVersions ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                Откатить
              </Button>
            )}
          </div>
        </div>
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
