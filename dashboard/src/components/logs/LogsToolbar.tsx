import { useMemo } from 'react'
import { Search, Eraser, Download, Pause, Play, Link, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogsStore } from '@/stores/logs'
import { useSettingsStore } from '@/stores/settings'

const LEVELS = ['debug', 'info', 'warning', 'error'] as const

const levelColors: Record<string, { active: string; inactive: string }> = {
  debug: {
    active: 'bg-muted text-muted-foreground',
    inactive: 'bg-muted/40 text-muted-foreground/40',
  },
  info: {
    active: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    inactive: 'bg-blue-500/5 text-blue-600/40 dark:text-blue-400/40',
  },
  warning: {
    active: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    inactive: 'bg-amber-500/5 text-amber-600/40 dark:text-amber-400/40',
  },
  error: {
    active: 'bg-red-500/15 text-red-600 dark:text-red-400',
    inactive: 'bg-red-500/5 text-red-600/40 dark:text-red-400/40',
  },
}

const levelLabels: Record<string, string> = {
  debug: 'Debug',
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
}

export function LogsToolbar() {
  const splitMode = useSettingsStore((s) => s.splitMode)
  const syncScroll = useSettingsStore((s) => s.syncScroll)
  const toggleSyncScroll = useSettingsStore((s) => s.toggleSyncScroll)
  const entries = useLogsStore((s) => s.entries)
  const activeLevels = useLogsStore((s) => s.activeLevels)
  const searchQuery = useLogsStore((s) => s.searchQuery)
  const toggleLevel = useLogsStore((s) => s.toggleLevel)
  const setSearchQuery = useLogsStore((s) => s.setSearchQuery)
  const paused = useLogsStore((s) => s.paused)
  const setPaused = useLogsStore((s) => s.setPaused)
  const clear = useLogsStore((s) => s.clear)
  const exportTxt = useLogsStore((s) => s.exportTxt)
  const exportJson = useLogsStore((s) => s.exportJson)
  const filteredEntries = useLogsStore((s) => s.filteredEntries)

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { debug: 0, info: 0, warning: 0, error: 0 }
    for (const entry of entries) {
      if (entry.level in counts) { counts[entry.level]++ }
    }
    return counts
  }, [entries])

  const filteredCount = filteredEntries().length

  return (
    <div className="space-y-1.5 p-2 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
      {/* Row 1: Search + actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск..."
            className="pl-8 h-8 text-xs"
          />
        </div>

        <span className="text-xs text-muted-foreground shrink-0">
          {filteredCount}/{entries.length}
        </span>

        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setPaused(!paused)}
          title={paused ? 'Возобновить' : 'Пауза'}
          className={paused ? 'animate-pulse' : ''}
        >
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" title="Экспорт">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportTxt}>Экспорт TXT</DropdownMenuItem>
            <DropdownMenuItem onClick={exportJson}>Экспорт JSON</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {splitMode !== 'none' && (
          <Button
            variant="outline"
            size="icon-sm"
            onClick={toggleSyncScroll}
            title={syncScroll ? 'Раздельная прокрутка' : 'Синхронная прокрутка'}
            className={syncScroll ? 'border-green-500/50 bg-green-500/10' : ''}
          >
            {syncScroll
              ? <Link className="size-3.5 text-green-600 dark:text-green-400" />
              : <Unlink className="size-3.5 text-muted-foreground" />}
          </Button>
        )}

        <Button variant="destructive" size="icon-sm" onClick={clear} title="Очистить логи">
          <Eraser className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Row 2: Level badges */}
      <div className="flex items-center gap-1">
        {LEVELS.map((level) => {
          const isActive = activeLevels.has(level)
          const colors = levelColors[level]
          return (
            <button
              key={level}
              onClick={() => toggleLevel(level)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer ${isActive ? colors.active : colors.inactive}`}
            >
              {levelLabels[level]}{' '}<span className="tabular-nums inline-block min-w-[2ch] text-right">{levelCounts[level]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
