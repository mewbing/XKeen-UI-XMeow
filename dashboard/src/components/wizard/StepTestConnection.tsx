import { useEffect, useRef, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, Loader2, ArrowLeft, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { testMihomoConnection, testConfigApiConnection, type ConnectionResult } from '@/lib/api'
import { cn } from '@/lib/utils'

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

interface TestState {
  status: TestStatus
  result: ConnectionResult | null
}

interface StepTestConnectionProps {
  mihomoUrl: string
  configUrl: string
  onSuccess: (results: { mihomoVersion: string; mihomoSecret: string }) => void
  onBack: () => void
}

function StatusIcon({ status }: { status: TestStatus }) {
  switch (status) {
    case 'idle':
      return <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
    case 'testing':
      return <Loader2 className="size-5 text-primary animate-spin" />
    case 'success':
      return <CheckCircle2 className="size-5 text-green-500" />
    case 'error':
      return <XCircle className="size-5 text-destructive" />
  }
}

function statusLabel(status: TestStatus): string {
  switch (status) {
    case 'idle':
      return 'Ожидание'
    case 'testing':
      return 'Проверка...'
    case 'success':
      return 'Подключено'
    case 'error':
      return 'Ошибка'
  }
}

export default function StepTestConnection({
  mihomoUrl,
  configUrl,
  onSuccess,
  onBack,
}: StepTestConnectionProps) {
  const [mihomo, setMihomo] = useState<TestState>({ status: 'idle', result: null })
  const [configApi, setConfigApi] = useState<TestState>({ status: 'idle', result: null })
  const usedSecretRef = useRef('')
  const hasRun = useRef(false)

  const runTests = useCallback(async () => {
    // Reset states
    setMihomo({ status: 'testing', result: null })
    setConfigApi({ status: 'idle', result: null })
    usedSecretRef.current = ''

    // Test 1: Mihomo API -- try without secret first, then with 'admin'
    let mihomoResult = await testMihomoConnection(mihomoUrl)
    let secret = ''

    if (!mihomoResult.ok && mihomoResult.error?.includes('401')) {
      // Retry with default secret
      secret = 'admin'
      mihomoResult = await testMihomoConnection(mihomoUrl, secret)
    }

    setMihomo({ status: mihomoResult.ok ? 'success' : 'error', result: mihomoResult })

    if (!mihomoResult.ok) {
      setConfigApi({ status: 'idle', result: null })
      return
    }

    usedSecretRef.current = secret

    // Test 2: Config API
    setConfigApi({ status: 'testing', result: null })
    const configResult = await testConfigApiConnection(configUrl)
    setConfigApi({ status: configResult.ok ? 'success' : 'error', result: configResult })

    // Both successful -- auto-advance after delay
    if (mihomoResult.ok && configResult.ok) {
      setTimeout(() => {
        onSuccess({
          mihomoVersion: mihomoResult.version || 'unknown',
          mihomoSecret: secret,
        })
      }, 1500)
    }
  }, [mihomoUrl, configUrl, onSuccess])

  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true
      runTests()
    }
  }, [runTests])

  const hasError = mihomo.status === 'error' || configApi.status === 'error'
  const allDone = mihomo.status !== 'idle' && mihomo.status !== 'testing' &&
    configApi.status !== 'idle' && configApi.status !== 'testing'

  function handleRetry() {
    hasRun.current = false
    runTests()
  }

  const checks = [
    {
      name: 'Mihomo API',
      url: mihomoUrl,
      state: mihomo,
    },
    {
      name: 'Config API',
      url: configUrl,
      state: configApi,
    },
  ]

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Проверка подключения
        </h1>
        <p className="text-muted-foreground">
          Тестируем соединение с API
        </p>
      </div>

      {/* Check list */}
      <div className="w-full space-y-3">
        {checks.map((check) => (
          <div
            key={check.name}
            className={cn(
              'flex items-start gap-4 rounded-xl border p-4 transition-colors',
              check.state.status === 'success' && 'border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20',
              check.state.status === 'error' && 'border-destructive/30 bg-destructive/5',
              (check.state.status === 'idle' || check.state.status === 'testing') && 'border-border bg-card'
            )}
          >
            <div className="pt-0.5">
              <StatusIcon status={check.state.status} />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{check.name}</span>
                <span className="text-xs text-muted-foreground font-mono truncate">
                  {check.url}
                </span>
              </div>
              <div className={cn(
                'text-sm',
                check.state.status === 'success' && 'text-green-600 dark:text-green-400',
                check.state.status === 'error' && 'text-destructive',
                (check.state.status === 'idle' || check.state.status === 'testing') && 'text-muted-foreground'
              )}>
                {check.state.status === 'error' && check.state.result?.error
                  ? check.state.result.error
                  : statusLabel(check.state.status)}
                {check.state.status === 'success' && check.state.result?.version && (
                  <span className="ml-2 text-muted-foreground">
                    v{check.state.result.version}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Success auto-advance indicator */}
      {!hasError && allDone && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in duration-300">
          <Loader2 className="size-4 animate-spin" />
          Переход к следующему шагу...
        </div>
      )}

      {/* Error actions */}
      {hasError && (
        <div className="flex gap-3 w-full">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
            Назад
          </Button>
          <Button
            className="flex-1"
            onClick={handleRetry}
          >
            <RotateCcw className="size-4" />
            Повторить
          </Button>
        </div>
      )}
    </div>
  )
}
