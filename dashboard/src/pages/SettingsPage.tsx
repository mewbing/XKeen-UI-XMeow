import { useState } from 'react'
import { Settings, RotateCcw, RefreshCw, Trash2, Globe, Loader2, Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reloadConfig, flushFakeIP, updateGeoData, restartMihomo } from '@/lib/mihomo-api'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useSettingsStore } from '@/stores/settings'

const startPageOptions = [
  { value: 'overview', label: 'Обзор' },
  { value: 'last-visited', label: 'Последняя посещённая' },
  { value: '/proxies', label: 'Прокси' },
  { value: '/connections', label: 'Подключения' },
  { value: '/logs', label: 'Логи' },
  { value: '/config-editor', label: 'Редактор конфига' },
  { value: '/rules', label: 'Правила' },
  { value: '/groups', label: 'Группы' },
  { value: '/providers', label: 'Провайдеры' },
  { value: '/geodata', label: 'Геоданные' },
] as const

const installationTypeLabels: Record<string, string> = {
  local: 'Локальная',
  cdn: 'CDN',
}

const coreActions = [
  { id: 'reload', icon: RefreshCw, label: 'Перезагрузить конфиг', action: reloadConfig },
  { id: 'fakeip', icon: Trash2, label: 'Очистить fake-IP', action: flushFakeIP },
  { id: 'geodata', icon: Globe, label: 'Обновить геоданные', action: updateGeoData },
  { id: 'restart', icon: RotateCcw, label: 'Перезапуск ядра', action: restartMihomo },
] as const

function CoreManagementSection() {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleAction(id: string, action: () => Promise<void>, label: string) {
    setLoadingId(id)
    try {
      await action()
      toast.success(label)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {coreActions.map((a) => {
        const Icon = a.icon
        const isLoading = loadingId === a.id
        return (
          <Button
            key={a.id}
            variant="outline"
            size="sm"
            className="h-auto py-2 px-2 flex flex-col items-center gap-1"
            disabled={loadingId !== null}
            onClick={() => handleAction(a.id, a.action, a.label)}
          >
            {isLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Icon className="size-3.5" />
            )}
            <span className="text-[11px] leading-tight text-center">{a.label}</span>
          </Button>
        )
      })}
    </div>
  )
}

export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const {
    isConfigured,
    installationType,
    mihomoApiUrl,
    mihomoSecret,
    configApiUrl,
    startPage,
    theme,
    reduceMotion,
    maxLogEntries,
    showDiffBeforeApply,
    autoCheckUpdates,
    rulesConfirmDelete,
    rulesShowDiffBeforeApply,
    setStartPage,
    setTheme,
    setReduceMotion,
    setMaxLogEntries,
    setShowDiffBeforeApply,
    setAutoCheckUpdates,
    setRulesConfirmDelete,
    setRulesShowDiffBeforeApply,
    setMihomoSecret,
    resetConfig,
  } = useSettingsStore()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm overflow-y-auto">
        <SheetHeader className="pb-1">
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-muted-foreground" />
            <div>
              <SheetTitle className="text-sm">Настройки</SheetTitle>
              <SheetDescription className="text-xs">Параметры дашборда</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pb-4">
          {/* ── Подключение ── */}
          <section className="rounded-lg border p-3 space-y-2">
            <h3 className="text-sm font-medium">Подключение</h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Тип установки</span>
                <span className="font-medium">
                  {installationType ? installationTypeLabels[installationType] : '---'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mihomo API</span>
                <span className="font-mono truncate max-w-[55%] text-right">
                  {mihomoApiUrl || '---'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Config API</span>
                <span className="font-mono truncate max-w-[55%] text-right">
                  {configApiUrl || '---'}
                </span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mihomo-secret" className="text-xs text-muted-foreground">Secret</Label>
                <Input
                  id="mihomo-secret"
                  type="password"
                  placeholder="Пароль mihomo API"
                  value={mihomoSecret}
                  onChange={(e) => setMihomoSecret(e.target.value)}
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Статус</span>
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                  isConfigured
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>
                  {isConfigured ? 'Подключено' : 'Не настроено'}
                </span>
              </div>
            </div>
          </section>

          {/* ── Интерфейс ── */}
          <section className="rounded-lg border p-3 space-y-3">
            <h3 className="text-sm font-medium">Интерфейс</h3>

            {/* Theme */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Тема</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { value: 'light', label: 'Светлая', Icon: Sun },
                  { value: 'dark', label: 'Тёмная', Icon: Moon },
                  { value: 'system', label: 'Авто', Icon: Monitor },
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex flex-col items-center gap-1 rounded-md border py-2 px-1 text-[11px] transition-colors ${
                      theme === value
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Start page */}
            <div className="space-y-1.5 pt-1 border-t">
              <Label className="text-xs text-muted-foreground">Стартовая страница</Label>
              <Select value={startPage} onValueChange={setStartPage}>
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Выберите страницу" />
                </SelectTrigger>
                <SelectContent>
                  {startPageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Animations */}
            <div className="flex items-center justify-between pt-1 border-t">
              <div>
                <Label htmlFor="reduce-motion" className="text-sm font-medium">Анимации</Label>
                <p className="text-[11px] text-muted-foreground">Отключите для слабых систем</p>
              </div>
              <Switch
                id="reduce-motion"
                checked={!reduceMotion}
                onCheckedChange={(checked: boolean) => setReduceMotion(!checked)}
              />
            </div>
          </section>

          {/* ── Редактор ── */}
          <section className="rounded-lg border p-3 space-y-3">
            <h3 className="text-sm font-medium">Редактор</h3>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="max-log-entries" className="text-sm font-medium">Буфер логов</Label>
                <p className="text-[11px] text-muted-foreground">Макс. записей в памяти (100–10 000)</p>
              </div>
              <Input
                id="max-log-entries"
                type="number"
                min={100}
                max={10000}
                step={100}
                value={maxLogEntries}
                onChange={(e) => setMaxLogEntries(Number(e.target.value))}
                className="w-24 h-8 text-xs text-right"
              />
            </div>

            <div className="flex items-center justify-between pt-1 border-t">
              <div>
                <Label htmlFor="diff-before-apply" className="text-sm font-medium">Просмотр перед применением</Label>
                <p className="text-[11px] text-muted-foreground">Показывать diff при сохранении конфига</p>
              </div>
              <Switch
                id="diff-before-apply"
                checked={showDiffBeforeApply}
                onCheckedChange={setShowDiffBeforeApply}
              />
            </div>
          </section>

          {/* ── Правила ── */}
          <section className="rounded-lg border p-3 space-y-3">
            <h3 className="text-sm font-medium">Правила</h3>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="rules-confirm-delete" className="text-sm font-medium">Подтверждать удаление</Label>
                <p className="text-[11px] text-muted-foreground">Спрашивать перед удалением правила или блока</p>
              </div>
              <Switch
                id="rules-confirm-delete"
                checked={rulesConfirmDelete}
                onCheckedChange={setRulesConfirmDelete}
              />
            </div>

            <div className="flex items-center justify-between pt-1 border-t">
              <div>
                <Label htmlFor="rules-diff-before-apply" className="text-sm font-medium">Просмотр перед применением</Label>
                <p className="text-[11px] text-muted-foreground">Показывать diff при сохранении правил</p>
              </div>
              <Switch
                id="rules-diff-before-apply"
                checked={rulesShowDiffBeforeApply}
                onCheckedChange={setRulesShowDiffBeforeApply}
              />
            </div>
          </section>

          {/* ── Система ── */}
          <section className="rounded-lg border p-3 space-y-3">
            <h3 className="text-sm font-medium">Система</h3>

            {/* Auto-check updates */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-check-updates" className="text-sm font-medium">Автообновления</Label>
                <p className="text-[11px] text-muted-foreground">Проверять обновления автоматически</p>
              </div>
              <Switch
                id="auto-check-updates"
                checked={autoCheckUpdates}
                onCheckedChange={setAutoCheckUpdates}
              />
            </div>

            {/* Core management */}
            <div className="pt-1 border-t space-y-2">
              <span className="text-xs text-muted-foreground">Управление ядром</span>
              <CoreManagementSection />
            </div>

            {/* Reset */}
            <div className="flex justify-center pt-2 border-t">
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  resetConfig()
                  window.location.href = '/'
                }}
              >
                <RotateCcw className="size-3" />
                Сбросить все настройки
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
