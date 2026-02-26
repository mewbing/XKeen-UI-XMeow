import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface StepSuccessProps {
  installationType: 'local' | 'cdn'
  mihomoVersion: string
  mihomoUrl: string
  configUrl: string
  onFinish: () => void
}

const typeLabels: Record<string, string> = {
  local: 'Локальная',
  cdn: 'CDN / Удалённая',
}

export default function StepSuccess({
  installationType,
  mihomoVersion,
  mihomoUrl,
  configUrl,
  onFinish,
}: StepSuccessProps) {
  return (
    <div className="flex flex-col items-center gap-8">
      {/* Celebration icon */}
      <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/30">
        <CheckCircle2 className="size-12 text-green-500" strokeWidth={1.5} />
      </div>

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Готово!
        </h1>
        <p className="text-muted-foreground">
          Подключение настроено успешно
        </p>
      </div>

      {/* Connection info */}
      <div className="w-full rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Тип установки</span>
          <Badge variant="secondary">{typeLabels[installationType]}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Mihomo</span>
          <span className="text-sm font-mono">{mihomoUrl}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Версия</span>
          <span className="text-sm font-mono">v{mihomoVersion}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Config API</span>
          <span className="text-sm font-mono">{configUrl}</span>
        </div>
      </div>

      {/* Finish button */}
      <Button
        size="lg"
        className="w-full"
        onClick={onFinish}
      >
        Начать работу
      </Button>
    </div>
  )
}
