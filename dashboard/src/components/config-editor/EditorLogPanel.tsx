/**
 * Log panel for config editor — WebSocket-based real-time log streaming.
 *
 * Features:
 * - WebSocket streaming from backend (instant updates)
 * - Virtual scroll via @tanstack/react-virtual (handles 1000+ lines)
 * - Level badge filtering (INFO, WARN, ERROR, DEBUG)
 * - Text search with 200ms debounce
 * - Clear log, refresh, fullscreen toggle
 * - Auto-scroll to bottom with floating jump button
 * - 1000-line ring buffer
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  RefreshCw,
  ArrowDown,
  Trash2,
  Search,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLogWebSocket } from '@/hooks/useLogWebSocket'
import type { WsLogLine } from '@/hooks/useLogWebSocket'
import { fetchParsedLog } from '@/lib/config-api'

type LogName = 'error' | 'access'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface EditorLogPanelProps {}

interface ParsedLine extends WsLogLine {
  id: number
}

const MAX_LINES = 1000

const LEVEL_BADGES: Record<string, { label: string; cls: string; activeCls: string }> = {
  info:  { label: 'INFO', cls: 'text-blue-400/50',  activeCls: 'bg-blue-500/20 text-blue-400' },
  warn:  { label: 'WARN', cls: 'text-amber-400/50', activeCls: 'bg-amber-500/20 text-amber-400' },
  error: { label: 'ERR',  cls: 'text-red-400/50',   activeCls: 'bg-red-500/20 text-red-400' },
  debug: { label: 'DBG',  cls: 'text-gray-400/50',  activeCls: 'bg-gray-500/20 text-gray-400' },
}

const LEVEL_TEXT_COLOR: Record<string, string> = {
  info: 'text-blue-400',
  warn: 'text-amber-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
  debug: 'text-muted-foreground',
}

// ANSI color code → Tailwind text color
const ANSI_COLORS: Record<number, string> = {
  31: 'text-red-400',     // red
  32: 'text-green-400',   // green
  33: 'text-yellow-400',  // yellow
  34: 'text-blue-400',    // blue
  35: 'text-purple-400',  // magenta
  36: 'text-cyan-400',    // cyan
  91: 'text-red-400',     // bright red (остановлен)
  92: 'text-green-400',   // bright green (запущен)
  93: 'text-yellow-400',  // bright yellow (Mixed)
  96: 'text-cyan-400',    // bright cyan
}

/** Parse ANSI escape codes into React elements with colored spans. */
function renderAnsi(text: string): React.ReactNode {
  // eslint-disable-next-line no-control-regex
  const ANSI_RE = /\x1b\[(\d+)m/g
  const parts: React.ReactNode[] = []
  let last = 0
  let color: string | null = null
  let match: RegExpExecArray | null

  while ((match = ANSI_RE.exec(text)) !== null) {
    // Push text before this escape
    if (match.index > last) {
      const chunk = text.slice(last, match.index)
      parts.push(
        color
          ? <span key={last} className={color}>{chunk}</span>
          : chunk
      )
    }
    const code = parseInt(match[1], 10)
    color = code === 0 ? null : (ANSI_COLORS[code] ?? null)
    last = match.index + match[0].length
  }

  // Remaining text
  if (last < text.length) {
    const chunk = text.slice(last)
    parts.push(
      color
        ? <span key={last} className={color}>{chunk}</span>
        : chunk
    )
  }

  return parts.length > 0 ? <>{parts}</> : text
}

export function EditorLogPanel(_props: EditorLogPanelProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const nextIdRef = useRef(0)
  const isAtBottomRef = useRef(true)

  const [allLines, setAllLines] = useState<ParsedLine[]>([])
  const [activeLog, setActiveLog] = useState<LogName>('error')
  const [filterLevel, setFilterLevel] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)

  // --- WebSocket ---
  const { connected, switchFile } = useLogWebSocket({
    enabled: true,
    onInitial: useCallback((lines: WsLogLine[]) => {
      nextIdRef.current = 0
      setAllLines(lines.map((l) => ({ ...l, id: nextIdRef.current++ })))
      isAtBottomRef.current = true
    }, []),
    onAppend: useCallback((lines: WsLogLine[]) => {
      setAllLines((prev) => {
        const newLines = lines.map((l) => ({ ...l, id: nextIdRef.current++ }))
        const combined = [...prev, ...newLines]
        return combined.length > MAX_LINES ? combined.slice(-MAX_LINES) : combined
      })
    }, []),
    onClear: useCallback(() => {
      nextIdRef.current = 0
      setAllLines([])
    }, []),
  })

  // --- Clear: local state only (keeps file intact) ---
  const handleClear = useCallback(() => {
    nextIdRef.current = 0
    setAllLines([])
  }, [])

  // --- Reload: fetch parsed lines via HTTP ---
  const handleReload = useCallback(async () => {
    try {
      const data = await fetchParsedLog(activeLog, 500)
      nextIdRef.current = 0
      setAllLines(data.lines.map((l) => ({ ...l, id: nextIdRef.current++ })))
      isAtBottomRef.current = true
    } catch (err) {
      console.error('Reload log failed:', err)
    }
  }, [activeLog])

  // --- Switch log file ---
  const handleSwitchLog = useCallback(
    (name: LogName) => {
      setActiveLog(name)
      setAllLines([])
      nextIdRef.current = 0
      if (connected) {
        switchFile(name)
      }
    },
    [connected, switchFile],
  )

  // --- Debounced search ---
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText), 200)
    return () => clearTimeout(t)
  }, [searchText])

  // --- Filtered lines ---
  const filteredLines = useMemo(() => {
    let result = allLines
    if (filterLevel) {
      result = result.filter((l) => l.level === filterLevel)
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(
        (l) =>
          l.msg.toLowerCase().includes(q) ||
          (l.level && l.level.includes(q)),
      )
    }
    return result
  }, [allLines, filterLevel, debouncedSearch])

  // --- Virtual scroll ---
  const virtualizer = useVirtualizer({
    count: filteredLines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20,
    overscan: 20,
  })

  // --- Auto-scroll ---
  useEffect(() => {
    if (isAtBottomRef.current && filteredLines.length > 0) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(filteredLines.length - 1, { align: 'end' })
      })
    }
  }, [filteredLines.length, virtualizer])

  const handleScroll = useCallback(() => {
    const el = parentRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    isAtBottomRef.current = atBottom
    setIsAtBottom(atBottom)
  }, [])

  const scrollToBottom = useCallback(() => {
    if (filteredLines.length > 0) {
      virtualizer.scrollToIndex(filteredLines.length - 1, {
        align: 'end',
        behavior: 'smooth',
      })
      isAtBottomRef.current = true
      setIsAtBottom(true)
    }
  }, [filteredLines.length, virtualizer])

  // --- Toggle level filter ---
  const toggleLevel = useCallback((level: string) => {
    setFilterLevel((prev) => (prev === level ? null : level))
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 h-8 border-b border-border/50 shrink-0">
        {/* Log file tabs */}
        {(['error', 'access'] as const).map((name) => (
          <button
            key={name}
            onClick={() => handleSwitchLog(name)}
            className={cn(
              'text-[11px] font-medium px-2 py-0.5 rounded transition-colors',
              activeLog === name
                ? 'bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {name}.log
          </button>
        ))}

        {/* Connection indicator */}
        <div
          className={cn(
            'size-1.5 rounded-full ml-1',
            connected ? 'bg-green-500' : 'bg-red-500',
          )}
          title={connected ? 'Подключено' : 'Отключено'}
        />

        {/* Level badges */}
        <div className="flex items-center gap-0.5 ml-2">
          {Object.entries(LEVEL_BADGES).map(([level, { label, cls, activeCls }]) => (
            <button
              key={level}
              onClick={() => toggleLevel(level)}
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors',
                filterLevel === level ? activeCls : cls,
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => {
            setSearchOpen(!searchOpen)
            if (searchOpen) setSearchText('')
          }}
          title="Поиск"
        >
          <Search className="size-3" />
        </Button>

        {/* Clear */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleClear}
          title="Очистить лог"
        >
          <Trash2 className="size-3" />
        </Button>

        {/* Refresh */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleReload}
          title="Обновить"
        >
          <RefreshCw className="size-3" />
        </Button>

      </div>

      {/* Search bar — animated slide */}
      <div
        className="grid shrink-0 transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: searchOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="flex items-center gap-2 px-2 h-7 border-b border-border/50">
            <Search className="size-3 text-muted-foreground shrink-0" />
            <input
              autoFocus={searchOpen}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Поиск..."
              className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50"
            />
            {searchText && (
              <button onClick={() => setSearchText('')}>
                <X className="size-3 text-muted-foreground" />
              </button>
            )}
            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
              {filteredLines.length}/{allLines.length}
            </span>
          </div>
        </div>
      </div>

      {/* Log content (virtual scroll) */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={parentRef}
          className="h-full overflow-auto font-mono text-[11px] leading-relaxed"
          onScroll={handleScroll}
        >
          {filteredLines.length > 0 ? (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const line = filteredLines[virtualRow.index]
                return (
                  <div
                    key={line.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="px-2 py-px"
                  >
                    {line.time && (
                      <span className="text-muted-foreground tabular-nums">
                        {line.time}{' '}
                      </span>
                    )}
                    {line.level && (
                      <span
                        className={cn(
                          'font-bold uppercase',
                          LEVEL_TEXT_COLOR[line.level] ?? 'text-blue-400',
                        )}
                      >
                        {line.level}
                      </span>
                    )}
                    {line.level && '  '}
                    <span>{line.msg.includes('\x1b[') ? renderAnsi(line.msg) : line.msg}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-muted-foreground text-xs">
                {allLines.length === 0
                  ? connected
                    ? 'Лог пуст'
                    : 'Подключение...'
                  : 'Нет совпадений'}
              </span>
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        {!isAtBottom && filteredLines.length > 0 && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-primary text-primary-foreground text-[10px] shadow-lg hover:bg-primary/90 transition-colors"
          >
            <ArrowDown className="size-3" />
            Вниз
          </button>
        )}
      </div>
    </div>
  )
}
