import { useRef, useMemo, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown } from 'lucide-react'
import { ConnectionRow } from './ConnectionRow'
import { ALL_COLUMNS } from './ColumnSelector'
import type { ConnectionWithSpeed } from '@/stores/connections'

interface ConnectionsTableProps {
  connections: ConnectionWithSpeed[]
  visibleColumns: string[]
  expandedId: string | null
}

const columnWidths: Record<string, string> = {
  host: 'minmax(120px, 2fr)',
  network: '60px',
  source: 'minmax(100px, 1fr)',
  destination: 'minmax(100px, 1fr)',
  rule: 'minmax(80px, 1fr)',
  chains: 'minmax(80px, 1fr)',
  dlSpeed: '80px',
  ulSpeed: '80px',
  dlTotal: '80px',
  ulTotal: '80px',
  start: '80px',
  type: '60px',
}

function getGridTemplate(visibleColumns: string[]): string {
  return visibleColumns.map((col) => columnWidths[col] || '80px').join(' ')
}

function getColumnLabel(id: string): string {
  const col = ALL_COLUMNS.find((c) => c.id === id)
  return col ? col.label : id
}

export function ConnectionsTable({ connections, visibleColumns, expandedId }: ConnectionsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const gridTemplate = useMemo(() => getGridTemplate(visibleColumns), [visibleColumns])

  const handleScroll = useCallback(() => {
    const el = parentRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    setIsAtBottom(atBottom)
  }, [])

  const virtualizer = useVirtualizer({
    count: connections.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) =>
      expandedId === connections[index]?.id ? 160 : 32,
    overscan: 20,
    getItemKey: (index) => connections[index]?.id ?? index,
  })

  return (
    <div className="relative flex flex-col h-full">
      {/* Header */}
      <div
        className="grid items-center h-8 px-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground sticky top-0 z-[5]"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {visibleColumns.map((col) => (
          <div key={col} className="px-1 truncate">
            {getColumnLabel(col)}
          </div>
        ))}
      </div>

      {/* Virtualized body */}
      <div ref={parentRef} className="flex-1 overflow-auto min-h-0" data-scroll-container onScroll={handleScroll}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const connection = connections[virtualRow.index]
            if (!connection) return null
            return (
              <div
                key={virtualRow.key}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <ConnectionRow
                  connection={connection}
                  visibleColumns={visibleColumns}
                  isExpanded={expandedId === connection.id}
                  gridTemplate={gridTemplate}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Empty state */}
      {connections.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Нет активных подключений
        </div>
      )}

      {/* Scroll to bottom */}
      {!isAtBottom && connections.length > 0 && (
        <button
          onClick={() => {
            virtualizer.scrollToIndex(connections.length - 1, { align: 'end', behavior: 'smooth' })
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
