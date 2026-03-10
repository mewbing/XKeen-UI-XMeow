/**
 * Terminal toolbar with connection controls, clear, search, font size, fullscreen.
 *
 * Follows the same layout conventions as LogsToolbar / ConnectionsToolbar:
 * - left side: action buttons + status
 * - right side: utility controls
 */

import { useState } from 'react'
import {
  Eraser,
  Search,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
  X,
  Loader2,
  Plug,
  Unplug,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useTerminalStore } from '@/stores/terminal'
import { cn } from '@/lib/utils'

interface TerminalToolbarProps {
  onConnect: () => void
  onDisconnect: () => void
  onClear: () => void
  onSearchNext: (q: string) => void
  onSearchPrev: (q: string) => void
  onFontIncrease: () => void
  onFontDecrease: () => void
  onFullscreenToggle: () => void
}

export function TerminalToolbar({
  onConnect,
  onDisconnect,
  onClear,
  onSearchNext,
  onSearchPrev,
  onFontIncrease,
  onFontDecrease,
  onFullscreenToggle,
}: TerminalToolbarProps) {
  const isConnected = useTerminalStore((s) => s.isConnected)
  const isConnecting = useTerminalStore((s) => s.isConnecting)
  const sessionType = useTerminalStore((s) => s.sessionType)
  const isSearchOpen = useTerminalStore((s) => s.isSearchOpen)
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen)
  const fontSize = useTerminalStore((s) => s.fontSize)
  const isFullscreen = useTerminalStore((s) => s.isFullscreen)
  const [searchQuery, setSearchQuery] = useState('')

  const isExec = sessionType === 'exec'

  return (
    <div className="flex flex-col border-b bg-background/95">
      {/* Main toolbar row */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* Connect/Disconnect */}
        {isConnected ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDisconnect}
            className="h-7 text-xs shrink-0"
          >
            <Unplug className="mr-1.5 size-3.5" />
            {isExec ? 'Остановить' : 'Отключить'}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onConnect}
            disabled={isConnecting}
            className="h-7 text-xs shrink-0"
          >
            {isConnecting ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Plug className="mr-1.5 size-3.5" />
            )}
            {isConnecting ? 'Подключение...' : 'Подключить'}
          </Button>
        )}

        {/* Connection status */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={cn(
              'size-2 rounded-full shrink-0',
              isConnected
                ? 'bg-green-500'
                : isConnecting
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-muted-foreground/40',
            )}
          />
          <span className="text-xs text-muted-foreground truncate">
            {isConnected
              ? isExec
                ? 'Выполняется команда'
                : 'Подключено (SSH)'
              : isConnecting
                ? 'Подключение...'
                : 'Отключено'}
          </span>
        </div>

        <div className="flex-1" />

        {/* Utility controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon-sm" onClick={onClear} title="Очистить">
            <Eraser className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSearchOpen(!isSearchOpen)}
            title="Поиск (Ctrl+F)"
            className={isSearchOpen ? 'bg-accent' : ''}
          >
            <Search className="size-3.5" />
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-4" />

          <Button variant="ghost" size="icon-sm" onClick={onFontDecrease} title="Уменьшить шрифт">
            <Minus className="size-3.5" />
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground min-w-[2ch] text-center">
            {fontSize}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={onFontIncrease} title="Увеличить шрифт">
            <Plus className="size-3.5" />
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-4" />

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onFullscreenToggle}
            title={isFullscreen ? 'Выйти из полноэкранного' : 'Полноэкранный'}
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
        </div>
      </div>

      {/* Search bar (conditional) */}
      {isSearchOpen && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-t bg-muted/30">
          <Search className="size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.shiftKey
                  ? onSearchPrev(searchQuery)
                  : onSearchNext(searchQuery)
              }
              if (e.key === 'Escape') {
                setSearchOpen(false)
              }
            }}
            placeholder="Поиск..."
            className="h-7 flex-1 text-xs"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onSearchPrev(searchQuery)}
            title="Предыдущее совпадение"
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onSearchNext(searchQuery)}
            title="Следующее совпадение"
          >
            <ChevronDown className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSearchOpen(false)}
            title="Закрыть поиск"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
