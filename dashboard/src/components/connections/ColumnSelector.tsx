import { SlidersHorizontal, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { useConnectionsStore } from '@/stores/connections'

const ALL_COLUMNS = [
  { id: 'host', label: 'Host' },
  { id: 'network', label: 'Network' },
  { id: 'source', label: 'Source' },
  { id: 'destination', label: 'Destination' },
  { id: 'rule', label: 'Rule' },
  { id: 'chains', label: 'Chains' },
  { id: 'dlSpeed', label: 'DL Speed' },
  { id: 'ulSpeed', label: 'UL Speed' },
  { id: 'dlTotal', label: 'DL Total' },
  { id: 'ulTotal', label: 'UL Total' },
  { id: 'start', label: 'Start Time' },
  { id: 'type', label: 'Type' },
] as const

export type ColumnId = (typeof ALL_COLUMNS)[number]['id']

export { ALL_COLUMNS }

export function ColumnSelector() {
  const visibleColumns = useConnectionsStore((s) => s.visibleColumns)
  const setVisibleColumns = useConnectionsStore((s) => s.setVisibleColumns)

  function toggleColumn(id: string) {
    if (visibleColumns.includes(id)) {
      if (visibleColumns.length <= 1) return
      setVisibleColumns(visibleColumns.filter((c) => c !== id))
    } else {
      setVisibleColumns([...visibleColumns, id])
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon-sm" title="Столбцы">
          <SlidersHorizontal className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-2">
        <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
          Столбцы
        </div>
        {ALL_COLUMNS.map((col) => {
          const isVisible = visibleColumns.includes(col.id)
          return (
            <div
              key={col.id}
              className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-accent rounded-sm"
              onClick={() => toggleColumn(col.id)}
            >
              <div className="size-4 flex items-center justify-center">
                {isVisible && <Check className="size-3" />}
              </div>
              <span>{col.label}</span>
            </div>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
