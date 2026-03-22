import { useEffect, useCallback } from 'react'
import { Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useReleasesStore } from '@/stores/releases'
import { useOverviewStore } from '@/stores/overview'
import { useTerminalStore } from '@/stores/terminal'
import { useBackendAvailable } from '@/hooks/useBackendAvailable'
import { useRemoteStore } from '@/stores/remote'
import { UpdateChangelog } from '@/components/update/UpdateChangelog'
import { CmdLine, fmtVer } from './shared'

interface XKeenTabProps {
  active: boolean
  onClose: () => void
}

export function XKeenTab({ active, onClose }: XKeenTabProps) {
  const xkeenReleases = useReleasesStore((s) => s.xkeenReleases) ?? []
  const xkeenCurrentVersion = useReleasesStore((s) => s.xkeenCurrentVersion) ?? ''
  const xkeenVersion = useOverviewStore((s) => s.xkeenVersion)
  const fetchXkeenReleases = useReleasesStore((s) => s.fetchXkeenReleases)
  const backendAvailable = useBackendAvailable()
  const isRemote = !!useRemoteStore((s) => s.activeAgentId)
  const showCommands = backendAvailable || isRemote

  // Use overview store version as fallback
  const displayVersion = xkeenCurrentVersion || xkeenVersion

  useEffect(() => {
    if (active && xkeenReleases.length === 0) {
      fetchXkeenReleases()
    }
  }, [active, xkeenReleases.length, fetchXkeenReleases])

  const handleOpenTerminal = useCallback(() => {
    onClose()
    useTerminalStore.getState().toggleOpen()
  }, [onClose])

  const latestNewer = xkeenReleases.find((r) => r.is_newer)
  const hasUpdate = !!latestNewer
  const currentRelease = xkeenReleases.find((r) => r.is_current)

  // Changelog: newer version if available, otherwise current, fallback to first
  const changelogRelease = latestNewer ?? currentRelease ?? xkeenReleases[0]

  return (
    <div className="flex flex-col gap-3">
      {/* Version header */}
      <div className="rounded-md border p-3 space-y-3">
        {displayVersion && (
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
        )}

        {latestNewer && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Доступна</span>
            <span className="font-mono font-medium">{latestNewer.tag_name}</span>
          </div>
        )}
      </div>

      {/* Changelog */}
      {changelogRelease?.body ? (
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Changelog — {changelogRelease.tag_name}
          </p>
          <div className="overflow-y-auto max-h-[40vh]">
            <UpdateChangelog releaseNotes={changelogRelease.body} />
          </div>
        </div>
      ) : null}

      {/* Commands section — available with backend or in remote mode (SSH terminal) */}
      {showCommands && (
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Команды</p>
          <CmdLine cmd="xkeen -uk" label="— обновить XKeen" />
          <CmdLine cmd="xkeen -i" label="— установить XKeen" />
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs mt-1"
            onClick={handleOpenTerminal}
          >
            <Terminal className="h-3 w-3 mr-1.5" />
            Открыть терминал
          </Button>
        </div>
      )}
    </div>
  )
}
