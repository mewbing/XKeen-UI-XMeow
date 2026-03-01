/**
 * Dialog for adding a new rule to a block.
 *
 * Fields: rule type (select), value (input), target proxy-group (select),
 * no-resolve (switch, only for IP-based types).
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
import { Switch } from '@/components/ui/switch'
import { useRulesEditorStore } from '@/stores/rules-editor'

const RULE_TYPES = [
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'DOMAIN',
  'GEOSITE',
  'GEOIP',
  'IP-CIDR',
  'IP-CIDR6',
  'SRC-IP-CIDR',
  'DST-PORT',
  'SRC-PORT',
  'PROCESS-NAME',
  'PROCESS-PATH',
  'RULE-SET',
  'MATCH',
] as const

/** Rule types that support the no-resolve flag */
const IP_BASED_TYPES = new Set(['IP-CIDR', 'IP-CIDR6', 'SRC-IP-CIDR', 'GEOIP'])

interface AddRuleDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  blockId: string
  proxyGroups: string[]
  defaultTarget: string
}

export function AddRuleDialog({
  open,
  onOpenChange,
  blockId,
  proxyGroups,
  defaultTarget,
}: AddRuleDialogProps) {
  const [type, setType] = useState<string>('')
  const [value, setValue] = useState('')
  const [target, setTarget] = useState(defaultTarget)
  const [noResolve, setNoResolve] = useState(false)

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setType('')
      setValue('')
      setTarget(defaultTarget)
      setNoResolve(false)
    }
  }, [open, defaultTarget])

  const isMatchType = type === 'MATCH'
  const showNoResolve = IP_BASED_TYPES.has(type)
  const isValid = type && (isMatchType || value.trim()) && target

  const handleSubmit = () => {
    if (!isValid) return
    useRulesEditorStore.getState().addRule(
      blockId,
      type,
      isMatchType ? '' : value.trim(),
      target,
      showNoResolve ? noResolve : false,
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить правило</DialogTitle>
          <DialogDescription>
            Выберите тип правила, укажите значение и целевую прокси-группу.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Rule type */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-type">Тип правила</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="rule-type">
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent>
                {RULE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-value">Значение</Label>
            <Input
              id="rule-value"
              placeholder={isMatchType ? '(не требуется)' : 'example.com'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isMatchType}
            />
          </div>

          {/* Target proxy-group */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-target">Прокси-группа</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="rule-target">
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

          {/* no-resolve switch (only for IP-based types) */}
          {showNoResolve && (
            <div className="flex items-center gap-3">
              <Switch
                id="rule-no-resolve"
                checked={noResolve}
                onCheckedChange={setNoResolve}
              />
              <Label htmlFor="rule-no-resolve" className="text-sm cursor-pointer">
                no-resolve
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
