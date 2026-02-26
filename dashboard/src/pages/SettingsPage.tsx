import { Settings, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

export default function SettingsPage() {
  const {
    isConfigured,
    installationType,
    mihomoApiUrl,
    configApiUrl,
    startPage,
    setStartPage,
    resetConfig,
  } = useSettingsStore()

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted p-2">
          <Settings className="size-5 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
      </div>

      {/* Connection info */}
      <Card>
        <CardHeader>
          <CardTitle>Подключение</CardTitle>
          <CardDescription>Информация о текущем подключении к mihomo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Тип установки</Label>
              <span className="text-sm font-medium">
                {installationType
                  ? installationTypeLabels[installationType]
                  : 'Не настроено'}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Mihomo API</Label>
              <span className="text-sm font-mono">
                {mihomoApiUrl || '---'}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Config API</Label>
              <span className="text-sm font-mono">
                {configApiUrl || '---'}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Статус</Label>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                isConfigured
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}>
                {isConfigured ? 'Подключено' : 'Не настроено'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Start page */}
      <Card>
        <CardHeader>
          <CardTitle>Стартовая страница</CardTitle>
          <CardDescription>
            Страница, на которую вы попадёте при открытии дашборда
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={startPage} onValueChange={setStartPage}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Выберите стартовую страницу" />
            </SelectTrigger>
            <SelectContent>
              {startPageOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Reset */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Сброс настроек</CardTitle>
          <CardDescription>
            Очистить все сохранённые настройки и вернуться к мастеру первоначальной настройки
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => {
              resetConfig()
              window.location.href = '/'
            }}
          >
            <RotateCcw className="size-4" />
            Сбросить настройки
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
