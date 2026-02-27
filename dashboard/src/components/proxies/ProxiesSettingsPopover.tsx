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
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
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
  const showAutoInfo = useSettingsStore((s) => s.proxiesShowAutoInfo)
  const setShowAutoInfo = useSettingsStore((s) => s.setProxiesShowAutoInfo)

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

      <PopoverContent className="w-[300px]" align="end">
        <div className="space-y-4">
          {/* Grid columns */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Сетка
            </label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={String(gridColumns)}
              onValueChange={(v) => {
                if (v) setGridColumns(Number(v) as 1 | 2 | 3)
              }}
            >
              <ToggleGroupItem value="1" aria-label="1 колонка">
                <LayoutList className="size-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="2" aria-label="2 колонки">
                <Columns2 className="size-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="3" aria-label="3 колонки">
                <Columns3 className="size-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator />

          {/* Density */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Плотность
            </label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={density}
              onValueChange={(v) => {
                if (v) setDensity(v as 'min' | 'mid' | 'max')
              }}
            >
              <ToggleGroupItem value="min">Мин</ToggleGroupItem>
              <ToggleGroupItem value="mid">Сред</ToggleGroupItem>
              <ToggleGroupItem value="max">Макс</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator />

          {/* Sort */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Сортировка прокси
            </label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={sort}
              onValueChange={(v) => {
                if (v) setSort(v as 'name' | 'delay' | 'default')
              }}
            >
              <ToggleGroupItem value="default">По умолч.</ToggleGroupItem>
              <ToggleGroupItem value="name">Имя</ToggleGroupItem>
              <ToggleGroupItem value="delay">Задержка</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator />

          {/* Type style */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Стиль типов групп
            </label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={typeStyle}
              onValueChange={(v) => {
                if (v) setTypeStyle(v as 'badge' | 'border' | 'icon')
              }}
            >
              <ToggleGroupItem value="badge">Бейдж</ToggleGroupItem>
              <ToggleGroupItem value="border">Рамка</ToggleGroupItem>
              <ToggleGroupItem value="icon">Иконка</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator />

          {/* Show auto info */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Инфо автогрупп
            </label>
            <Toggle
              variant="outline"
              size="sm"
              pressed={showAutoInfo}
              onPressedChange={setShowAutoInfo}
            >
              {showAutoInfo ? 'Вкл' : 'Выкл'}
            </Toggle>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
