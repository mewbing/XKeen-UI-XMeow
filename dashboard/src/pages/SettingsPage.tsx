import { useState } from 'react'
import { Settings, RotateCcw, RefreshCw, Trash2, Globe, Loader2 } from 'lucide-react'
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
  { value: '/updates', label: 'Обновления' },
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
    configApiUrl,
    startPage,
    reduceMotion,
    maxLogEntries,
    showDiffBeforeApply,
    setStartPage,
    setReduceMotion,
    setMaxLogEntries,
    setShowDiffBeforeApply,
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
          {/* Connection info */}
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

          {/* Start page */}
          <section className="rounded-lg border p-3 space-y-2">
            <h3 className="text-sm font-medium">Стартовая страница</h3>
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
          </section>

          {/* Appearance */}
          <section className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="reduce-motion" className="text-sm font-medium">Анимации</Label>
                <p className="text-[11px] text-muted-foreground">Отключите для слабых систем</p>
              </div>
              <Switch
                id="reduce-motion"
                checked={!reduceMotion}
                onCheckedChange={(checked) => setReduceMotion(!checked)}
              />
            </div>
          </section>

          {/* Log buffer size */}
          <section className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="max-log-entries" className="text-sm font-medium">Буфер логов</Label>
                <p className="text-[11px] text-muted-foreground">Макс. количество записей (100–10000)</p>
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
          </section>

          {/* Config editor */}
          <section className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="diff-before-apply" className="text-sm font-medium">Diff перед Apply</Label>
                <p className="text-[11px] text-muted-foreground">Показывать изменения перед применением конфига</p>
              </div>
              <Switch
                id="diff-before-apply"
                checked={showDiffBeforeApply}
                onCheckedChange={setShowDiffBeforeApply}
              />
            </div>
          </section>

          {/* Core management */}
          <section className="rounded-lg border p-3 space-y-2">
            <h3 className="text-sm font-medium">Управление ядром</h3>
            <CoreManagementSection />
          </section>

          {/* Reset */}
          <section className="rounded-lg border border-destructive/30 p-3 space-y-2">
            <h3 className="text-sm font-medium">Сброс настроек</h3>
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
              Сбросить
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
