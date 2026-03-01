/**
 * Rule block card with collapse/expand, editing controls,
 * and nested Dnd for intra-block rule reordering.
 *
 * Collapsed: block name, rule count, target dropdown, delete button.
 * Expanded: all rules as sortable RuleRow + add rule button.
 */

import { useState, memo, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useRulesEditorStore } from '@/stores/rules-editor'
import { useSettingsStore } from '@/stores/settings'
import { RuleRow } from './RuleRow'
import { AddRuleDialog } from './AddRuleDialog'
import type { RuleBlock } from '@/lib/rules-parser'

interface RuleBlockCardProps {
  block: RuleBlock
  index: number
  density: 'min' | 'detailed'
  isExpanded: boolean
  onToggleExpand: () => void
  isDragging?: boolean
  style?: React.CSSProperties
  proxyGroups: string[]
}

function pluralRules(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return count + ' правило'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return count + ' правила'
  return count + ' правил'
}

export const RuleBlockCard = memo(function RuleBlockCard({ block, index, density, isExpanded, onToggleExpand, isDragging = false, style, proxyGroups }: RuleBlockCardProps) {
  const [addRuleOpen, setAddRuleOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteRuleConfirm, setDeleteRuleConfirm] = useState<{ blockId: string; ruleId: string; label: string } | null>(null)
  const [dontAskAgain, setDontAskAgain] = useState(false)
  const rulesConfirmDelete = useSettingsStore((s) => s.rulesConfirmDelete)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const ruleIds = useMemo(() => block.rules.map((r) => r.id), [block.rules])

  const handleRuleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldI = block.rules.findIndex((r) => r.id === active.id)
    const newI = block.rules.findIndex((r) => r.id === over.id)
    if (oldI !== -1 && newI !== -1) useRulesEditorStore.getState().reorderRules(block.id, oldI, newI)
  }

  const handleDeleteBlock = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (rulesConfirmDelete) setDeleteConfirmOpen(true)
    else useRulesEditorStore.getState().removeBlock(block.id)
  }

  const handleConfirmDeleteBlock = () => {
    if (dontAskAgain) useSettingsStore.getState().setRulesConfirmDelete(false)
    useRulesEditorStore.getState().removeBlock(block.id)
    setDeleteConfirmOpen(false); setDontAskAgain(false)
  }

  const handleRemoveRule = (ruleId: string) => {
    if (rulesConfirmDelete) {
      const rule = block.rules.find((r) => r.id === ruleId)
      setDeleteRuleConfirm({ blockId: block.id, ruleId, label: rule ? `${rule.type},${rule.value}` : ruleId })
    } else {
      useRulesEditorStore.getState().removeRule(block.id, ruleId)
    }
  }

  const handleConfirmDeleteRule = () => {
    if (!deleteRuleConfirm) return
    if (dontAskAgain) useSettingsStore.getState().setRulesConfirmDelete(false)
    useRulesEditorStore.getState().removeRule(deleteRuleConfirm.blockId, deleteRuleConfirm.ruleId)
    setDeleteRuleConfirm(null); setDontAskAgain(false)
  }

  const handleChangeRuleTarget = (ruleId: string, newT: string) => useRulesEditorStore.getState().changeRuleTarget(block.id, ruleId, newT)
  const handleChangeBlockTarget = (newT: string) => useRulesEditorStore.getState().changeBlockTarget(block.id, newT)

  const hasMixedTargets = useMemo(() => block.rules.some((r) => r.target !== block.target), [block.rules, block.target])

  return (
    <>
      <Card className={cn('transition-all duration-200 overflow-hidden py-0 gap-0', isDragging && 'opacity-50')} style={style}>
        <CardHeader className={cn('select-none px-4 !gap-0 transition-[padding] duration-200', isExpanded ? 'pt-3 pb-2' : 'py-3')}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center justify-center size-6 rounded-md bg-muted text-muted-foreground text-xs font-medium tabular-nums shrink-0">#{index + 1}</span>
            <button className="font-medium text-sm truncate min-w-0 flex-1 text-left cursor-pointer hover:text-primary transition-colors" onClick={onToggleExpand}>{block.name}</button>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 leading-none shrink-0">{pluralRules(block.rules.length)}</Badge>
            <Select value={block.target} onValueChange={handleChangeBlockTarget}>
              <SelectTrigger className="h-7 text-xs w-auto min-w-[80px] max-w-[140px] shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>{proxyGroups.map((pg) => (<SelectItem key={pg} value={pg}>{pg}</SelectItem>))}</SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={handleDeleteBlock}><Trash2 className="size-4" /></Button>
            <button onClick={onToggleExpand} className="shrink-0 cursor-pointer"><ChevronDown className={cn('size-4 text-muted-foreground transition-transform duration-200', isExpanded && 'rotate-180')} /></button>
          </div>
          {density === 'detailed' && !isExpanded && block.rules.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground overflow-hidden">
              {block.rules.slice(0, 3).map((rule) => (<span key={rule.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 shrink-0 max-w-[180px] truncate"><span className="font-mono text-[10px] opacity-70">{rule.type}</span><span className="truncate">{rule.value}</span></span>))}
              {block.rules.length > 3 && (<span className="text-muted-foreground/50 shrink-0">+{block.rules.length - 3}</span>)}
            </div>
          )}
        </CardHeader>
        <div className={cn('grid transition-[grid-template-rows] duration-300 ease-out', isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
          <div className={cn('overflow-hidden transition-opacity duration-200', isExpanded ? 'opacity-100 delay-100' : 'opacity-0')}>
            <CardContent className="px-4 pb-3 pt-0">
              <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleRuleDragEnd}>
                <SortableContext items={ruleIds} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-0.5">
                    {block.rules.map((rule, ri) => (<RuleRow key={rule.id} rule={rule} index={ri} showTarget={hasMixedTargets} blockId={block.id} proxyGroups={proxyGroups} onChangeTarget={handleChangeRuleTarget} onRemove={handleRemoveRule} />))}
                  </div>
                </SortableContext>
              </DndContext>
              <Button variant="ghost" size="sm" className="w-full mt-2 text-muted-foreground hover:text-primary" onClick={() => setAddRuleOpen(true)}><Plus className="size-4" />Добавить правило</Button>
            </CardContent>
          </div>
        </div>
      </Card>

      <AddRuleDialog open={addRuleOpen} onOpenChange={setAddRuleOpen} blockId={block.id} proxyGroups={proxyGroups} defaultTarget={block.target} />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить блок «{block.name}».</AlertDialogTitle>
            <AlertDialogDescription>Будут цдалены все {pluralRules(block.rules.length)} в этом блоке.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2">
            <Switch id="dont-ask-block" size="sm" checked={dontAskAgain} onCheckedChange={setDontAskAgain} />
            <Label htmlFor="dont-ask-block" className="text-sm cursor-pointer">Больше не спрашивать</Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteConfirmOpen(false); setDontAskAgain(false) }}>Отмена</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDeleteBlock}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteRuleConfirm !== null} onOpenChange={() => { setDeleteRuleConfirm(null); setDontAskAgain(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить правило?</AlertDialogTitle>
            <AlertDialogDescription>{deleteRuleConfirm?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2">
            <Switch id="dont-ask-rule" size="sm" checked={dontAskAgain} onCheckedChange={setDontAskAgain} />
            <Label htmlFor="dont-ask-rule" className="text-sm cursor-pointer">Больше не спрашивать</Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteRuleConfirm(null); setDontAskAgain(false) }}>Отмена</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDeleteRule}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
})
