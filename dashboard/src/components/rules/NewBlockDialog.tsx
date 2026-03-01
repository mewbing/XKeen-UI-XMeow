/**
 * Dialog for creating a new rule block.
 *
 * Fields: block name (input), target proxy-group (select).
 * The inline variant is implemented in RuleBlockList.
 * This dialog is used when rulesNewBlockMode === 'dialog'.
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useRulesEditorStore } from '@/stores/rules-editor'

interface NewBlockDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  proxyGroups: string[]
}

export function NewBlockDialog({
  open,
  onOpenChange,
  proxyGroups,
}: NewBlockDialogProps) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName('')
      setTarget('')
    }
  }, [open])

  const isValid = name.trim() && target

  const handleSubmit = () => {
    if (!isValid) return
    useRulesEditorStore.getState().createBlock(name.trim(), target)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новый блок правил</DialogTitle>
          <DialogDescription>
            Создайте новый блок для группировки правил.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Block name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="block-name">Название блока</Label>
            <Input
              id="block-name"
              placeholder="напр. YouTube, Streaming"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Target proxy-group */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="block-target">Прокси-группа</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="block-target">
                <SelectValue placeholder="Выберите группу" />
              </SelectTrigger>
              <SelectContent>
                {proxyGroups.map((pg) => (
                  <SelectItem key={pg} value={pg}>
                    {pg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
