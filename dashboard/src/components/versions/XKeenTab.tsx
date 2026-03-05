import { useEffect } from 'react'
import { Loader2, Terminal, ArrowUpCircle, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useReleasesStore } from '@/stores/releases'
import { useTerminalStore } from '@/stores/terminal'
import { CopyBtn, CmdLine } from './shared'

interface XKeenTabProps {
  active: boolean
  onClose: () => void
}

export function XKeenTab({ active, onClose }: XKeenTabProps) {
  const xkeenRelease = useReleasesStore((s) => s.xkeenRelease)
  const xkeenLoading = useReleasesStore((s) => s.xkeenLoading)
  const xkeenError = useReleasesStore((s) => s.xkeenError)
  const fetchXkeenRelease = useReleasesStore((s) => s.fetchXkeenRelease)
  const toggleTerminal = useTerminalStore((s) => s.toggleOpen)

  useEffect(() => {
    if (active && !xkeenRelease) {
      fetchXkeenRelease()
    }
  }, [active, xkeenRelease, fetchXkeenRelease])

  const current = xkeenRelease?.current_version || 'unknown'
  const latest = xkeenRelease?.latest
  const hasUpdate = latest?.has_update ?? false

  // GitHub tag may be shorter than full version (e.g. "1.1.3" vs "1.1.3.9").
  // Show current version if it starts with the tag (same release, just with build number).
  const latestDisplay = latest && !hasUpdate && current !== 'unknown'
    && current.startsWith(latest.tag_name.replace(/^v/, ''))
    ? current
    : latest?.tag_name

  const handleOpenTerminal = () => {
    onClose()
    toggleTerminal()
  }

  if (xkeenLoading && !xkeenRelease) {
    return (
      <div className="flex items-center justify-center py-8 animate-in fade-in-0 duration-200">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (xkeenError) {
    return (
      <p className="text-sm text-red-500 animate-in fade-in-0 duration-200">{xkeenError}</p>
    )
  }

  return (
    <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
      <div className="space-y-4 pb-2 animate-in fade-in-0 duration-200">
        {/* Version comparison */}
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Текущая версия</span>
            <span className="font-mono font-medium">{current}</span>
          </div>
          {latest && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Последняя версия</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{latestDisplay}</span>
                  {hasUpdate ? (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      <ArrowUpCircle className="h-2.5 w-2.5 mr-0.5" />
                      доступно
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      актуально
                    </Badge>
                  )}
                </div>
              </div>
              {latest.published_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Дата релиза</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(latest.published_at).toLocaleDateString('ru-RU', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Release notes */}
        {latest?.body && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Изменения ({latestDisplay})</p>
            <pre className="bg-muted rounded-md p-3 text-sm font-mono leading-relaxed overflow-y-auto max-h-[50vh] whitespace-pre-wrap break-all">
              {latest.body}
            </pre>
          </div>
        )}

        {/* Commands */}
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-sm font-medium">Команды терминала</p>
          {hasUpdate ? (
            <CmdLine cmd="xkeen -uk" label="-- обновить XKeen" />
          ) : (
            <CmdLine cmd="xkeen -i" label="-- установить XKeen" />
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleOpenTerminal}
          >
            <Terminal className="h-3 w-3 mr-1.5" />
            Открыть терминал
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}
