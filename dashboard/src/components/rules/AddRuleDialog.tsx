/**
 * Dialog for adding a new rule to a block.
 *
 * Fields: rule type (select + info tooltip), value (input),
 * target proxy-group (select), no-resolve (switch),
 * inline comment (input).
 */

import { useState, useEffect } from 'react'
import { Info } from 'lucide-react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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

/** Descriptions for each rule type */
const RULE_TYPE_DESCRIPTIONS: Record<string, string> = {
  'DOMAIN-SUFFIX': 'Суффикс домена. Например, google.com сработает для mail.google.com, play.google.com и т.д.',
  'DOMAIN-KEYWORD': 'Ключевое слово в домене. Например, google сработает для любого домена содержащего "google".',
  'DOMAIN': 'Точное совпадение домена. Только для указанного домена без поддоменов.',
  'GEOSITE': 'База данных доменов по категориям (geosite.dat). Например, youtube, google, telegram.',
  'GEOIP': 'Определение страны по IP-адресу (geoip.dat). Например, RU, US, CN.',
  'IP-CIDR': 'IPv4 подсеть в формате CIDR. Например, 192.168.1.0/24.',
  'IP-CIDR6': 'IPv6 подсеть в формате CIDR. Например, 2001:db8::/32.',
  'SRC-IP-CIDR': 'Подсеть IP-адреса источника (клиента). Для маршрутизации по IP устройства.',
  'DST-PORT': 'Порт назначения. Например, 443 для HTTPS, 80 для HTTP.',
  'SRC-PORT': 'Порт источника (клиента). Используется редко.',
  'PROCESS-NAME': 'Имя процесса на устройстве. Например, chrome.exe, telegram-desktop.',
  'PROCESS-PATH': 'Полный путь к процессу. Например, /usr/bin/curl.',
  'RULE-SET': 'Внешний набор правил (rule-provider). Ссылка на файл или URL с правилами.',
  'MATCH': 'Правило по умолчанию (fallback). Срабатывает, если ни одно другое правило не подошло. Всегда последнее.',
}

/** Example placeholders for the value field */
const RULE_TYPE_PLACEHOLDERS: Record<string, string> = {
  'DOMAIN-SUFFIX': 'google.com',
  'DOMAIN-KEYWORD': 'google',
  'DOMAIN': 'www.google.com',
  'GEOSITE': 'youtube',
  'GEOIP': 'RU',
  'IP-CIDR': '192.168.1.0/24',
  'IP-CIDR6': '2001:db8::/32',
  'SRC-IP-CIDR': '192.168.1.0/24',
  'DST-PORT': '443',
  'SRC-PORT': '8080',
  'PROCESS-NAME': 'chrome.exe',
  'PROCESS-PATH': '/usr/bin/curl',
  'RULE-SET': 'my-ruleset',
  'MATCH': '',
}

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
  const [comment, setComment] = useState('')

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setType('')
      setValue('')
      setTarget(defaultTarget)
      setNoResolve(false)
      setComment('')
    }
  }, [open, defaultTarget])

  const isMatchType = type === 'MATCH'
  const showNoResolve = IP_BASED_TYPES.has(type)
  const isValid = type && (isMatchType || value.trim()) && target

  const handleSubmit = () => {
    if (!isValid) return
    const trimmedComment = comment.trim()
    useRulesEditorStore.getState().addRule(
      blockId,
      type,
      isMatchType ? '' : value.trim(),
      target,
      showNoResolve ? noResolve : false,
      trimmedComment || undefined,
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4">
        <DialogHeader>
          <DialogTitle>Добавить правило</DialogTitle>
          <DialogDescription>
            Выберите тип правила, укажите значение и целевую прокси-группу.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Rule type */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="rule-type">Тип правила</Label>
              {type && RULE_TYPE_DESCRIPTIONS[type] && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                        <Info className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[260px]">
                      {RULE_TYPE_DESCRIPTIONS[type]}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
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
              placeholder={isMatchType ? '(не требуется)' : (RULE_TYPE_PLACEHOLDERS[type] || 'example.com')}
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

          {/* no-resolve switch — always rendered, disabled when not IP-based */}
          <div className="flex items-center gap-3">
            <Switch
              id="rule-no-resolve"
              checked={noResolve}
              onCheckedChange={setNoResolve}
              disabled={!showNoResolve}
            />
            <Label
              htmlFor="rule-no-resolve"
              className={`text-sm cursor-pointer ${!showNoResolve ? 'text-muted-foreground/40' : ''}`}
            >
              no-resolve
            </Label>
            {!showNoResolve && type && (
              <span className="text-[10px] text-muted-foreground/50">
                (только для IP-правил)
              </span>
            )}
          </div>

          {/* Comment */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-comment" className="flex items-center gap-1.5">
              Комментарий
              <span className="text-muted-foreground/60 text-xs font-normal">(необязательно)</span>
            </Label>
            <Input
              id="rule-comment"
              placeholder="Заметка к правилу"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
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
