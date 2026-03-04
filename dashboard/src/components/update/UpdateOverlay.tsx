import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUpdateStore } from '@/stores/update'
import { checkHealth } from '@/lib/update-api'

type Phase = 'downloading' | 'installing' | 'restarting' | 'done' | 'error' | 'timeout'

interface UpdateOverlayProps {
  open: boolean
  mode: 'server' | 'dist'
  onClose: () => void
}

const PHASE_LABELS: Record<Phase, string> = {
  downloading: 'Скачивание обновления...',
  installing: 'Установка...',
  restarting: 'Перезапуск сервера...',
  done: 'Перезагрузка...',
  error: 'Ошибка обновления',
  timeout: 'Сервер не отвечает',
}

export function UpdateOverlay({ open, mode, onClose }: UpdateOverlayProps) {
  const [phase, setPhase] = useState<Phase>('downloading')
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const startedRef = useRef(false)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString('ru-RU')}] ${msg}`])
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    if (!open || startedRef.current) return
    startedRef.current = true

    if (mode === 'server') {
      runServerUpdate()
    } else {
      runDistUpdate()
    }

    async function runServerUpdate() {
      setPhase('downloading')
      addLog('Запуск обновления сервера...')

      try {
        addLog('Скачивание и установка...')
        setPhase('installing')
        await useUpdateStore.getState().applyUpdate()

        // Server responded "restarting" -- now wait for restart
        setPhase('restarting')
        addLog('Сервер перезапускается...')

        // CRITICAL: Wait 3s before first health poll (Pitfall 3)
        // Avoids false-positive from old server still alive
        await new Promise((r) => setTimeout(r, 3000))

        addLog('Ожидание ответа сервера...')

        // Poll health every 2s, max 15 attempts (30s total)
        let healthy = false
        for (let i = 0; i < 15; i++) {
          const ok = await checkHealth()
          if (ok) {
            healthy = true
            break
          }
          addLog(`Попытка ${i + 1}/15...`)
          await new Promise((r) => setTimeout(r, 2000))
        }

        if (healthy) {
          setPhase('done')
          addLog('Сервер доступен. Перезагрузка страницы...')
          setTimeout(() => window.location.reload(), 500)
        } else {
          setPhase('timeout')
          addLog('Сервер не ответил в течение 30 секунд.')
        }
      } catch (err) {
        setPhase('error')
        const msg = err instanceof Error ? err.message : 'Неизвестная ошибка'
        setError(msg)
        addLog(`Ошибка: ${msg}`)
      }
    }

    async function runDistUpdate() {
      setPhase('downloading')
      addLog('Обновление дашборда...')

      try {
        await useUpdateStore.getState().applyDist()

        // CRITICAL: No health polling for dist mode (Pitfall 6)
        // Server never went down -- just show success and reload
        setPhase('done')
        addLog('Дашборд обновлён. Перезагрузка через 2 секунды...')
        setTimeout(() => window.location.reload(), 2000)
      } catch (err) {
        setPhase('error')
        const msg = err instanceof Error ? err.message : 'Неизвестная ошибка'
        setError(msg)
        addLog(`Ошибка: ${msg}`)
      }
    }
  }, [open, mode, addLog])

  // Reset state when overlay closes
  useEffect(() => {
    if (!open) {
      startedRef.current = false
      setPhase('downloading')
      setError(null)
      setLogs([])
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 max-w-md w-full px-6">
        {/* Icon */}
        {(phase === 'downloading' || phase === 'installing' || phase === 'restarting') && (
          <Loader2 className="size-12 text-primary animate-spin" />
        )}
        {phase === 'done' && (
          <CheckCircle2 className="size-12 text-green-500" />
        )}
        {(phase === 'error' || phase === 'timeout') && (
          <XCircle className="size-12 text-destructive" />
        )}

        {/* Status text */}
        <h2 className="text-lg font-semibold text-center">
          {PHASE_LABELS[phase]}
        </h2>

        {/* Error message */}
        {phase === 'error' && error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        {/* Log area */}
        <div className="w-full max-h-40 overflow-y-auto rounded-md bg-muted/50 border p-3">
          {logs.map((line, i) => (
            <div key={i} className="text-xs font-mono text-muted-foreground">
              {line}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {phase === 'error' && (
            <Button variant="outline" onClick={onClose}>
              Закрыть
            </Button>
          )}
          {phase === 'timeout' && (
            <>
              <Button onClick={() => window.location.reload()}>
                Перезагрузить вручную
              </Button>
              <Button variant="outline" onClick={onClose}>
                Закрыть
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
