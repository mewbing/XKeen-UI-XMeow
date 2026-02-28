/**
 * Log panel with on-demand WebSocket streaming for config editor.
 *
 * Subscribes to `logStreaming` from config-editor store. When true,
 * connects a manual WebSocket to mihomo /logs endpoint. When false,
 * disconnects. Shows log entries with colored level badges, auto-scroll,
 * and level filtering.
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Square, ChevronDown, ChevronUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useConfigEditorStore, type LogEntry } from '@/stores/config-editor'
import { useSettingsStore } from '@/stores/settings'

const LEVELS = ['info', 'warning', 'error'] as const

const levelColors: Record<string, { active: string; inactive: string }> = {
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

const levelTextColors: Record<string, string> = {
  debug: 'text-muted-foreground',
  info: 'text-blue-600 dark:text-blue-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
}

interface EditorLogPanelProps {
  onToggleCollapse: () => void
  collapsed: boolean
}

export function EditorLogPanel({ onToggleCollapse, collapsed }: EditorLogPanelProps) {
  const wsRef = useRef<WebSocket | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  const logStreaming = useConfigEditorStore((s) => s.logStreaming)
  const logEntries = useConfigEditorStore((s) => s.logEntries)
  const addLogEntry = useConfigEditorStore((s) => s.addLogEntry)
  const stopLogStream = useConfigEditorStore((s) => s.stopLogStream)
  const mihomoApiUrl = useSettingsStore((s) => s.mihomoApiUrl)
  const mihomoSecret = useSettingsStore((s) => s.mihomoSecret)

  const [activeLevels, setActiveLevels] = useState<Set<string>>(
    () => new Set(['info', 'warning', 'error'])
  )

  const toggleLevel = useCallback((level: string) => {
    setActiveLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) {
        next.delete(level)
      } else {
        next.add(level)
      }
      return next
    })
  }, [])

  // WebSocket connect/disconnect driven by logStreaming store flag
  useEffect(() => {
    if (!logStreaming || !mihomoApiUrl) {
      // Disconnect if streaming stopped
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
      return
    }

    // Build WS URL
    const wsUrl = mihomoApiUrl.replace(/^http/, 'ws')
    const params = new URLSearchParams()
    if (mihomoSecret) params.set('token', mihomoSecret)
    params.set('level', 'debug')
    const fullUrl = `${wsUrl}/logs?${params.toString()}`

    const ws = new WebSocket(fullUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type: string; payload: string }
        addLogEntry({
          time: new Date().toLocaleTimeString(),
          level: data.type,
          message: data.payload,
        })
      } catch {
        // Ignore parse errors
      }
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onclose = () => {
      wsRef.current = null
    }

    return () => {
      ws.onclose = null
      ws.close()
      wsRef.current = null
    }
  }, [logStreaming, mihomoApiUrl, mihomoSecret, addLogEntry])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (isAtBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logEntries.length])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const threshold = 40
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }, [])

  // Filter entries by active levels
  const filteredEntries = useMemo(
    () => logEntries.filter((e) => activeLevels.has(e.level)),
    [logEntries, activeLevels]
  )

  // Level counts
  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { info: 0, warning: 0, error: 0 }
    for (const entry of logEntries) {
      if (entry.level in counts) counts[entry.level]++
    }
    return counts
  }, [logEntries])

  const handleStop = useCallback(() => {
    stopLogStream()
  }, [stopLogStream])

  if (collapsed) return null

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Log panel toolbar */}
      <div className="flex items-center gap-2 px-2 h-8 border-b shrink-0">
        {/* Left: title + count */}
        <span className="text-xs font-medium">Логи</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {filteredEntries.length}/{logEntries.length}
        </span>

        {/* Level filter badges */}
        <div className="flex items-center gap-1 ml-2">
          {LEVELS.map((level) => {
            const isActive = activeLevels.has(level)
            const colors = levelColors[level]
            return (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  isActive ? colors.active : colors.inactive
                }`}
              >
                {level}
                <span className="tabular-nums inline-block min-w-[2ch] text-right">
                  {levelCounts[level]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Stop button */}
        {logStreaming && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={handleStop}
            title="Остановить стрим"
          >
            <Square className="size-3" />
            Стоп
          </Button>
        )}

        {/* Collapse toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onToggleCollapse}
          title={collapsed ? 'Развернуть логи' : 'Свернуть логи'}
        >
          {collapsed ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </Button>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto font-mono text-xs p-2 min-h-0"
        onScroll={handleScroll}
      >
        {filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-muted-foreground text-xs">
              {logEntries.length === 0
                ? 'Логи появятся после Apply'
                : 'Нет записей для выбранных фильтров'}
            </span>
          </div>
        ) : (
          filteredEntries.map((entry: LogEntry) => (
            <div key={entry.id} className="flex gap-2 py-0.5 leading-relaxed">
              <span className="text-muted-foreground shrink-0">{entry.time}</span>
              <span
                className={`shrink-0 font-medium uppercase w-[5ch] ${
                  levelTextColors[entry.level] ?? 'text-muted-foreground'
                }`}
              >
                {entry.level === 'warning' ? 'WARN' : entry.level.toUpperCase()}
              </span>
              <span className="break-all">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
