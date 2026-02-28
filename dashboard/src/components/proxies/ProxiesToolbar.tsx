import { Search, Zap, Loader2 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { useProxiesStore } from '@/stores/proxies'
import { ProxiesSettingsPopover } from './ProxiesSettingsPopover'

interface ProxiesToolbarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  typeFilter: string
  onTypeFilterChange: (value: string) => void
}

export function ProxiesToolbar({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
}: ProxiesToolbarProps) {
  const testingGroups = useProxiesStore((s) => s.testingGroups)

  return (
    <div className="flex items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Поиск группы или прокси..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Type filter */}
      <Select value={typeFilter} onValueChange={onTypeFilterChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все типы</SelectItem>
          <SelectItem value="Selector">Selector</SelectItem>
          <SelectItem value="URLTest">URLTest</SelectItem>
          <SelectItem value="Fallback">Fallback</SelectItem>
          <SelectItem value="LoadBalance">LoadBalance</SelectItem>
        </SelectContent>
      </Select>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Test all button */}
      <Button
        variant="outline"
        size="sm"
        className="active:scale-95 transition-transform"
        onClick={() => useProxiesStore.getState().testAllGroups()}
        disabled={testingGroups.size > 0}
      >
        {testingGroups.size > 0
          ? <Loader2 className="size-4 animate-spin" />
          : <Zap className="size-4" />
        }
        {testingGroups.size > 0 ? 'Тестирование...' : 'Тестировать все'}
      </Button>

      {/* Settings popover */}
      <ProxiesSettingsPopover />
    </div>
  )
}
