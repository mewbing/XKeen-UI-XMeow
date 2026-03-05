import { useEffect, useCallback, useRef } from 'react'
import { Loader2, CheckCircle2, XCircle, Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useReleasesStore } from '@/stores/releases'
import { useOverviewStore } from '@/stores/overview'
import { formatBytes } from '@/lib/format'
import { formatDate } from './shared'

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
  const mihomoReleases = useReleasesStore((s) => s.mihomoReleases)
  const mihomoCurrentVersion = useReleasesStore((s) => s.mihomoCurrentVersion)
  const mihomoLoading = useReleasesStore((s) => s.mihomoLoading)
  const mihomoInstalling = useReleasesStore((s) => s.mihomoInstalling)
  const mihomoInstallingVersion = useReleasesStore((s) => s.mihomoInstallingVersion)
  const mihomoError = useReleasesStore((s) => s.mihomoError)
  const mihomoInstallLog = useReleasesStore((s) => s.mihomoInstallLog)
  const mihomoInstallDone = useReleasesStore((s) => s.mihomoInstallDone)
  const mihomoDownloadProgress = useReleasesStore((s) => s.mihomoDownloadProgress)
  const fetchMihomoReleases = useReleasesStore((s) => s.fetchMihomoReleases)
  const installMihomoVersion = useReleasesStore((s) => s.installMihomoVersion)
  const resetInstallState = useReleasesStore((s) => s.resetInstallState)
  const clearErrors = useReleasesStore((s) => s.clearErrors)
  const setVersions = useOverviewStore((s) => s.setVersions)

  const logRef = useRef<HTMLPreElement>(null)

  const showProgress = mihomoInstalling || mihomoInstallLog.length > 0

  // Fetch releases when tab becomes active
  useEffect(() => {
    if (active && mihomoReleases.length === 0) {
      fetchMihomoReleases()
    }
  }, [active, mihomoReleases.length, fetchMihomoReleases])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [mihomoInstallLog])

  const handleInstall = useCallback(async (version: string) => {
    await installMihomoVersion(version)
    // Update sidebar version on success
    if (useReleasesStore.getState().mihomoInstallDone) {
      const versionClean = version.startsWith('v') ? version.slice(1) : version
      setVersions({ mihomo: versionClean })
    }
  }, [installMihomoVersion, setVersions])

  const handleCloseProgress = useCallback(() => {
    resetInstallState()
    clearErrors()
  }, [resetInstallState, clearErrors])

  const hasError = !!mihomoError && !mihomoInstalling
  const showCloseBtn = mihomoInstallDone || hasError

  const titleIcon = mihomoInstalling
    ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
    : hasError
      ? <XCircle className="h-4 w-4 text-red-500" />
      : mihomoInstallDone
        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
        : null

  const titleText = showProgress
    ? mihomoInstalling
      ? `Установка ${mihomoInstallingVersion}...`
      : hasError
        ? 'Ошибка установки'
        : 'Установка завершена'
    : null

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Status title during install */}
      {titleText && (
        <div className="flex items-center gap-2 text-sm font-medium mb-3 shrink-0">
          {titleIcon}
          {titleText}
        </div>
      )}

      {/* --- Progress screen --- */}
      {showProgress ? (
        <div className="animate-in fade-in-0 duration-200 space-y-3">
          {/* Download progress bar */}
          {mihomoInstalling && mihomoDownloadProgress > 0 && mihomoDownloadProgress < 100 && (
            <div className="w-full bg-muted rounded-full h-1.5 animate-in fade-in-0 duration-150">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${mihomoDownloadProgress}%` }}
              />
            </div>
          )}

          <pre
            ref={logRef}
            className="bg-muted rounded-md p-3 text-xs font-mono overflow-y-auto max-h-48 whitespace-pre-wrap"
          >
            {mihomoInstallLog.join('\n')}
          </pre>

          {showCloseBtn && (
            <div className="flex justify-end animate-in fade-in-0 duration-150">
              <Button size="sm" onClick={handleCloseProgress}>Закрыть</Button>
            </div>
          )}
        </div>
      ) : (
        /* --- Releases list screen --- */
        <div className="animate-in fade-in-0 duration-200 flex flex-col flex-1 min-h-0 gap-3">
          <div className="space-y-3 shrink-0">
            {mihomoCurrentVersion && (
              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Текущая версия</span>
                  <span className="font-mono font-medium">{mihomoCurrentVersion}</span>
                </div>
              </div>
            )}

            {mihomoError && !mihomoLoading && (
              <p className="text-xs text-red-500 animate-in fade-in-0 duration-150">{mihomoError}</p>
            )}

            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Доступные версии</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => fetchMihomoReleases()}
                disabled={mihomoLoading}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${mihomoLoading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
            {mihomoLoading && mihomoReleases.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-1 pb-2">
                {mihomoReleases.map((rel) => (
                  <div
                    key={rel.tag_name}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors duration-150 ${
                      rel.is_current
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{rel.tag_name}</span>
                        {rel.is_current && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            текущая
                          </Badge>
                        )}
                        {!rel.is_current && rel.is_newer && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            новее
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{formatDate(rel.published_at)}</span>
                        {rel.asset_size > 0 && (
                          <span>{formatBytes(rel.asset_size)}</span>
                        )}
                      </div>
                    </div>

                    {!rel.is_current && rel.asset_name && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs shrink-0"
                        onClick={() => onConfirm({
                          fn: () => handleInstall(rel.tag_name),
                          title: `Установить mihomo ${rel.tag_name}?`,
                          description: `Текущая версия: ${mihomoCurrentVersion || 'unknown'}. Mihomo будет остановлен, бинарник заменён и запущен заново.`,
                        })}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Установить
                      </Button>
                    )}
                  </div>
                ))}

                {mihomoReleases.length === 0 && !mihomoLoading && (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    Релизы не найдены
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
