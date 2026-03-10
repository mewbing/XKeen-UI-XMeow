import {
  Settings2,
  LayoutList,
  Columns2,
  Columns3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useSettingsStore } from '@/stores/settings'

export function ProxiesSettingsPopover() {
  const gridColumns = useSettingsStore((s) => s.proxiesGridColumns)
  const setGridColumns = useSettingsStore((s) => s.setProxiesGridColumns)
  const density = useSettingsStore((s) => s.proxiesDensity)
  const setDensity = useSettingsStore((s) => s.setProxiesDensity)
  const sort = useSettingsStore((s) => s.proxiesSort)
  const setSort = useSettingsStore((s) => s.setProxiesSort)
  const typeStyle = useSettingsStore((s) => s.proxiesTypeStyle)
  const setTypeStyle = useSettingsStore((s) => s.setProxiesTypeStyle)

  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings2 className="size-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Настройки отображения</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent className="w-auto p-3" align="end">
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
          <label className="text-xs text-muted-foreground">Сетка</label>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={String(gridColumns)}
            onValueChange={(v) => { if (v) setGridColumns(Number(v) as 1 | 2 | 3) }}
          >
            <ToggleGroupItem value="1" aria-label="1 колонка" className="px-2">
              <LayoutList className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="2" aria-label="2 колонки" className="px-2">
              <Columns2 className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="3" aria-label="3 колонки" className="px-2">
              <Columns3 className="size-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>

          <label className="text-xs text-muted-foreground">Плотность</label>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={density}
            onValueChange={(v) => { if (v) setDensity(v as 'min' | 'mid' | 'max') }}
          >
            <ToggleGroupItem value="min" className="text-xs px-2">Мин</ToggleGroupItem>
            <ToggleGroupItem value="mid" className="text-xs px-2">Сред</ToggleGroupItem>
            <ToggleGroupItem value="max" className="text-xs px-2">Макс</ToggleGroupItem>
          </ToggleGroup>

          <label className="text-xs text-muted-foreground">Сортировка</label>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={sort}
            onValueChange={(v) => { if (v) setSort(v as 'name' | 'delay' | 'default') }}
          >
            <ToggleGroupItem value="default" className="text-xs px-2">Умлч</ToggleGroupItem>
            <ToggleGroupItem value="name" className="text-xs px-2">Имя</ToggleGroupItem>
            <ToggleGroupItem value="delay" className="text-xs px-2">Задержка</ToggleGroupItem>
          </ToggleGroup>

          <label className="text-xs text-muted-foreground">Тип</label>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={typeStyle}
            onValueChange={(v) => { if (v) setTypeStyle(v as 'badge' | 'border' | 'icon' | 'none') }}
          >
            <ToggleGroupItem value="badge" className="text-xs px-2">Бейдж</ToggleGroupItem>
            <ToggleGroupItem value="border" className="text-xs px-2">Рамка</ToggleGroupItem>
            <ToggleGroupItem value="icon" className="text-xs px-2">Иконка</ToggleGroupItem>
            <ToggleGroupItem value="none" className="text-xs px-2">Нет</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </PopoverContent>
    </Popover>
  )
}
