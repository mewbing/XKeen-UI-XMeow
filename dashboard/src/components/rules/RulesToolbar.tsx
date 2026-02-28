/**
 * Toolbar for the rules page with toggle controls and search.
 *
 * 3 toggle groups: grouping mode, layout mode, density mode.
 * Search input filters blocks by name or rule content.
 */

import {
  Layers,
  BookOpen,
  GitBranch,
  List,
  LayoutGrid,
  CreditCard,
  AlignJustify,
  FileText,
  Search,
} from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { useSettingsStore } from '@/stores/settings'

interface RulesToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onGroupingChange: () => void
}

export function RulesToolbar({ searchQuery, onSearchChange, onGroupingChange }: RulesToolbarProps) {
  const grouping = useSettingsStore((s) => s.rulesGrouping)
  const layout = useSettingsStore((s) => s.rulesLayout)
  const density = useSettingsStore((s) => s.rulesDensity)
  const setGrouping = useSettingsStore((s) => s.setRulesGrouping)
  const setLayout = useSettingsStore((s) => s.setRulesLayout)
  const setDensity = useSettingsStore((s) => s.setRulesDensity)

  const handleGroupingChange = (value: string) => {
    if (!value) return
    setGrouping(value as 'proxy-group' | 'sections' | 'two-level')
    onGroupingChange()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[150px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Поиск правил..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grouping toggle */}
      <ToggleGroup
        type="single"
        value={grouping}
        onValueChange={handleGroupingChange}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="proxy-group" title="По группам">
          <Layers className="size-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="sections" title="По секциям">
          <BookOpen className="size-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="two-level" title="Двухуровневая">
          <GitBranch className="size-4" />
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Layout toggle */}
      <ToggleGroup
        type="single"
        value={layout}
        onValueChange={(v) => v && setLayout(v as 'list' | 'grid' | 'proxies')}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="list" title="Список">
          <List className="size-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="grid" title="Сетка">
          <LayoutGrid className="size-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="proxies" title="Карточки">
          <CreditCard className="size-4" />
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Density toggle */}
      <ToggleGroup
        type="single"
        value={density}
        onValueChange={(v) => v && setDensity(v as 'min' | 'detailed')}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="min" title="Мин">
          <AlignJustify className="size-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="detailed" title="Подробно">
          <FileText className="size-4" />
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Placeholder for Save/Apply/Reset buttons (Plan 04) */}
      <div className="ml-auto flex gap-2" />
    </div>
  )
}
