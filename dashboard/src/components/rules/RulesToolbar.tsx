/**
 * Toolbar for the rules page with toggle controls, search,
 * and Save/Apply/Reset/Undo/Redo action buttons.
 *
 * 3 toggle groups: grouping mode, layout mode, density mode.
 * Search input filters blocks by name or rule content.
 * Right side: Undo, Redo, Reset, Save, Apply buttons.
 */

import { useState } from 'react'
import {
  Layers, BookOpen, GitBranch, List, LayoutGrid, CreditCard,
  AlignJustify, FileText, Search, Undo2, Redo2, RotateCcw, Save, Play, Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { useSettingsStore } from '@/stores/settings'
import { useRulesEditorStore } from '@/stores/rules-editor'
import { saveConfig } from '@/lib/config-api'
import { restartMihomo } from '@/lib/mihomo-api'
import { RulesDiffPreview } from './RulesDiffPreview'
import { NewBlockDialog } from './NewBlockDialog'

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
  const rulesShowDiffBeforeApply = useSettingsStore((s) => s.rulesShowDiffBeforeApply)
  const rulesNewBlockMode = useSettingsStore((s) => s.rulesNewBlockMode)

  const dirty = useRulesEditorStore((s) => s.dirty)
  const changeCount = useRulesEditorStore((s) => s.changeCount)
  const originalYaml = useRulesEditorStore((s) => s.originalYaml)
  const currentYaml = useRulesEditorStore((s) => s.currentYaml)
  const proxyGroups = useRulesEditorStore((s) => s.proxyGroups)

  const [diffOpen, setDiffOpen] = useState(false)
  const [newBlockOpen, setNewBlockOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)

  // Temporal state for undo/redo
  const pastStates = useRulesEditorStore.temporal.getState().pastStates
  const futureStates = useRulesEditorStore.temporal.getState().futureStates

  const handleGroupingChange = (value: string) => {
    if (!value) return
    setGrouping(value as 'proxy-group' | 'sections' | 'two-level')
    onGroupingChange()
  }

  const handleUndo = () => useRulesEditorStore.temporal.getState().undo()
  const handleRedo = () => useRulesEditorStore.temporal.getState().redo()

  const handleReset = () => setResetConfirmOpen(true)
  const handleConfirmReset = () => {
    useRulesEditorStore.getState().resetChanges()
    setResetConfirmOpen(false)
  }
  const handleSave = async () => {
    setSaving(true)
    try {
      const yaml = useRulesEditorStore.getState().serialize()
      await saveConfig(yaml)
      useRulesEditorStore.getState().markSaved()
      toast.success("Конфигурация сохранена")
    } catch (err) {
      toast.error("Ошибка сохранения: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  const handleApply = () => {
    if (rulesShowDiffBeforeApply) {
      setDiffOpen(true)
    } else {
      executeApply()
    }
  }

  const executeApply = async () => {
    setDiffOpen(false)
    setApplying(true)
    try {
      const yaml = useRulesEditorStore.getState().serialize()
      await saveConfig(yaml)
      await restartMihomo()
      useRulesEditorStore.getState().markSaved()
      toast.success("Применено и перезапущено")
    } catch (err) {
      toast.error("Ошибка: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setApplying(false)
    }
  }
  return (
    <>
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
        <ToggleGroup type="single" value={grouping} onValueChange={handleGroupingChange} variant="outline" size="sm">
          <ToggleGroupItem value="proxy-group" title="По группам"><Layers className="size-4" /></ToggleGroupItem>
          <ToggleGroupItem value="sections" title="По секциям"><BookOpen className="size-4" /></ToggleGroupItem>
          <ToggleGroupItem value="two-level" title="Двухуровневая"><GitBranch className="size-4" /></ToggleGroupItem>
        </ToggleGroup>

        {/* Layout toggle */}
        <ToggleGroup type="single" value={layout} onValueChange={(v) => v && setLayout(v as 'list' | 'grid' | 'proxies')} variant="outline" size="sm">
          <ToggleGroupItem value="list" title="Список"><List className="size-4" /></ToggleGroupItem>
          <ToggleGroupItem value="grid" title="Сетка"><LayoutGrid className="size-4" /></ToggleGroupItem>
          <ToggleGroupItem value="proxies" title="Карточки"><CreditCard className="size-4" /></ToggleGroupItem>
        </ToggleGroup>

        {/* Density toggle */}
        <ToggleGroup type="single" value={density} onValueChange={(v) => v && setDensity(v as 'min' | 'detailed')} variant="outline" size="sm">
          <ToggleGroupItem value="min" title="Мин"><AlignJustify className="size-4" /></ToggleGroupItem>
          <ToggleGroupItem value="detailed" title="Подробно"><FileText className="size-4" /></ToggleGroupItem>
        </ToggleGroup>

        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-1">
          {rulesNewBlockMode === 'dialog' && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setNewBlockOpen(true)}>
              <Plus className="size-4" />
              Новый блок
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-8" title="Отменить (Ctrl+Z)" disabled={pastStates.length === 0} onClick={handleUndo}>
            <Undo2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" title="Повторить (Ctrl+Shift+Z)" disabled={futureStates.length === 0} onClick={handleRedo}>
            <Redo2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" title="Сбросить изменения" disabled={!dirty} onClick={handleReset}>
            <RotateCcw className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" title="Сохранить (Ctrl+S)" disabled={!dirty || saving} onClick={handleSave}>
            <Save className="size-4" />
            Сохранить
          </Button>
          <Button variant="default" size="sm" className="h-8 gap-1.5 relative" title="Применить и перезапустить" disabled={!dirty || applying} onClick={handleApply}>
            <Play className="size-4" />
            Применить
            {changeCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-[10px]">{changeCount}</Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Reset confirmation dialog */}
      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить все изменения?</AlertDialogTitle>
            <AlertDialogDescription>
              Все несохранённые изменения будут потеряны.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmReset}>Сбросить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diff preview */}
      {diffOpen && (
        <RulesDiffPreview open={diffOpen} onOpenChange={setDiffOpen} original={originalYaml} modified={currentYaml} onConfirmApply={executeApply} />
      )}

      {/* New block dialog */}
      <NewBlockDialog open={newBlockOpen} onOpenChange={setNewBlockOpen} proxyGroups={proxyGroups} />
    </>
  )
}
