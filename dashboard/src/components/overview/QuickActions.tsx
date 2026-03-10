import { useState } from 'react'
import { RefreshCw, Trash2, Globe, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reloadConfig, flushFakeIP, updateGeoData, restartMihomo } from '@/lib/mihomo-api'
import { toast } from 'sonner'

interface ActionItem {
  id: string
  icon: React.ElementType
  label: string
  action: () => Promise<void>
}

const actions: ActionItem[] = [
  {
    id: 'reload',
    icon: RefreshCw,
    label: 'Перезагрузить конфиг',
    action: reloadConfig,
  },
  {
    id: 'fakeip',
    icon: Trash2,
    label: 'Очистить fake-IP',
    action: flushFakeIP,
  },
  {
    id: 'geodata',
    icon: Globe,
    label: 'Обновить геоданные',
    action: updateGeoData,
  },
  {
    id: 'restart',
    icon: RotateCcw,
    label: 'Перезапуск ядра',
    action: restartMihomo,
  },
]

export function QuickActionsCard() {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleAction(item: ActionItem) {
    setLoadingId(item.id)
    try {
      await item.action()
      toast.success(item.label)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 min-w-0 overview-card">
      <div className="flex items-center gap-2 mb-3">
        <RefreshCw className="size-4" />
        <span className="text-sm font-medium">Быстрые действия</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => {
          const Icon = a.icon
          const isLoading = loadingId === a.id
          return (
            <Button
              key={a.id}
              variant="outline"
              size="sm"
              className="h-auto py-2.5 px-3 flex flex-col items-center gap-1.5"
              disabled={loadingId !== null}
              onClick={() => handleAction(a)}
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Icon className="size-4" />
              )}
              <span className="text-xs leading-tight text-center">
                {a.label}
              </span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
