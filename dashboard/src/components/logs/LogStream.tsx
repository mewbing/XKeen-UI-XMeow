import { useRef, useState, useCallback, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown } from 'lucide-react'
import { useLogsStore } from '@/stores/logs'
import type { LogEntry } from '@/stores/logs'
import { LogCard } from './LogCard'

interface LogStreamProps {
  entries: LogEntry[]
}
export function LogStream({ entries }: LogStreamProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const isAtBottomRef = useRef(true)
  const setPaused = useLogsStore((s) => s.setPaused)

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 15,
  })

  const handleScroll = useCallback(() => {
    const el = parentRef.current
    if (!el) return
    const threshold = 50
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    const wasAtBottom = isAtBottomRef.current
    isAtBottomRef.current = atBottom
    setIsAtBottom(atBottom)

    // Auto-pause when user scrolls away from bottom, resume when back at bottom
    if (wasAtBottom && !atBottom) {
      setPaused(true)
    } else if (!wasAtBottom && atBottom) {
      setPaused(false)
    }
  }, [setPaused])

  useEffect(() => {
    if (isAtBottomRef.current && entries.length > 0) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(entries.length - 1, { align: "end" })
      })
    }
  }, [entries.length, virtualizer])

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-muted-foreground text-sm">Логи пусты. Ожидание данных...</span>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <div ref={parentRef} className="h-full overflow-auto" onScroll={handleScroll} data-scroll-container>
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={entries[virtualRow.index].id}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <LogCard entry={entries[virtualRow.index]} />
            </div>
          ))}
        </div>
      </div>
      {!isAtBottom && (
        <button
          onClick={() => {
            setPaused(false)
            virtualizer.scrollToIndex(entries.length - 1, { align: "end", behavior: "smooth" })
          }}
          className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs shadow-lg hover:bg-primary/90 transition-colors"
        >
          <ArrowDown className="h-3 w-3" />
          Вниз
        </button>
      )}
    </div>
  )
}
