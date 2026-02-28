import { useMemo } from 'react'
import { Search, Eraser, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogsStore } from '@/stores/logs'

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
  const entries = useLogsStore((s) => s.entries)
  const activeLevels = useLogsStore((s) => s.activeLevels)
  const searchQuery = useLogsStore((s) => s.searchQuery)
  const toggleLevel = useLogsStore((s) => s.toggleLevel)
  const setSearchQuery = useLogsStore((s) => s.setSearchQuery)
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
    <div className="flex items-center gap-2 p-2 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
      {/* Level badge toggles */}
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
              {levelLabels[level]} ({levelCounts[level]})
            </button>
          )
        })}
      </div>

      {/* Search input */}
      <div className="relative w-64">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск в логах..."
          className="pl-8 h-8 text-xs"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Entry count */}
      <span className="text-xs text-muted-foreground">
        {filteredCount}/{entries.length}
      </span>

      {/* Clear button */}
      <Button variant="outline" size="sm" onClick={clear} title="Очистить логи">
        <Eraser className="h-3.5 w-3.5" />
      </Button>

      {/* Export dropdown */}
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
    </div>
  )
}
