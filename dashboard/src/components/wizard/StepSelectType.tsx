import { useState } from 'react'
import { Monitor, Cloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface StepSelectTypeProps {
  initialType?: 'local' | 'cdn' | null
  initialRouterIp?: string
  initialSecret?: string
  onNext: (type: 'local' | 'cdn', routerIp?: string, secret?: string) => void
}

const installOptions = [
  {
    value: 'local' as const,
    icon: Monitor,
    title: 'Локальная установка',
    description: 'Дашборд установлен на роутере. API адреса определятся автоматически.',
  },
  {
    value: 'cdn' as const,
    icon: Cloud,
    title: 'CDN / Удалённая',
    description: 'Дашборд на внешнем сервере. Потребуется указать IP роутера.',
  },
] as const

export default function StepSelectType({
  initialType,
  initialRouterIp = '',
  initialSecret = '',
  onNext,
}: StepSelectTypeProps) {
  const [selected, setSelected] = useState<'local' | 'cdn' | null>(initialType ?? null)
  const [routerIp, setRouterIp] = useState(initialRouterIp)
  const [secret, setSecret] = useState(initialSecret)

  const canProceed = selected === 'local' || (selected === 'cdn' && routerIp.trim().length > 0)

  function handleNext() {
    if (!canProceed || !selected) return
    onNext(selected, selected === 'cdn' ? routerIp.trim() : undefined, secret.trim() || undefined)
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Добро пожаловать в Mihomo Dashboard
        </h1>
        <p className="text-muted-foreground">
          Выберите тип установки
        </p>
      </div>

      {/* Options */}
      <div className="grid gap-4 w-full">
        {installOptions.map((option) => {
          const isActive = selected === option.value
          const Icon = option.icon

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelected(option.value)}
              className={cn(
                'flex items-start gap-4 rounded-xl border-2 p-5 text-left transition-all duration-200',
                'hover:shadow-md hover:border-primary/40',
                isActive
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-card'
              )}
            >
              <div
                className={cn(
                  'rounded-lg p-2.5 shrink-0 transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="size-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="font-semibold">{option.title}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {option.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* CDN Router IP input */}
      {selected === 'cdn' && (
        <div className="w-full space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Label htmlFor="router-ip" className="text-sm font-medium">
            IP-адрес роутера
          </Label>
          <Input
            id="router-ip"
            type="text"
            placeholder="192.168.1.1"
            value={routerIp}
            onChange={(e) => setRouterIp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canProceed) handleNext()
            }}
          />
        </div>
      )}

      {/* Mihomo secret */}
      {selected && (
        <div className="w-full space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Label htmlFor="mihomo-secret" className="text-sm font-medium">
            Secret mihomo
          </Label>
          <Input
            id="mihomo-secret"
            type="password"
            placeholder="Оставьте пустым, если не задан"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canProceed) handleNext()
            }}
          />
          <p className="text-xs text-muted-foreground">
            Поле <code className="bg-muted px-1 py-0.5 rounded">secret</code> из config.yaml mihomo
          </p>
        </div>
      )}

      {/* Next button */}
      <Button
        size="lg"
        className="w-full"
        disabled={!canProceed}
        onClick={handleNext}
      >
        Далее
      </Button>
    </div>
  )
}
