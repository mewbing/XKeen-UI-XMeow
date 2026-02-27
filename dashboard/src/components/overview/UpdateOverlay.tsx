/**
 * Kernel update overlay with spinner and real-time log.
 *
 * Flow:
 * 1. When opened with status 'idle': show confirmation AlertDialog
 * 2. On confirm: show full-screen overlay with spinner + log
 * 3. Call upgradeCore() from mihomo-api.ts
 * 4. On success: show success message + close button
 * 5. On error: show error + close/retry buttons
 *
 * Log auto-scrolls to bottom on new entries.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { upgradeCore, fetchMihomoVersion } from '@/lib/mihomo-api'
import { useOverviewStore } from '@/stores/overview'

interface UpdateOverlayProps {
  open: boolean
  onClose: () => void
}

type UpdateStatus = 'idle' | 'confirming' | 'updating' | 'success' | 'error'

export function UpdateOverlay({ open, onClose }: UpdateOverlayProps) {
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const logContainerRef = useRef<HTMLPreElement>(null)

  const mihomoVersion = useOverviewStore((s) => s.mihomoVersion)
  const setVersions = useOverviewStore((s) => s.setVersions)

  const addLog = useCallback((message: string) => {
    setLog((prev) => [...prev, message])
  }, [])

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [log])

  // When opened, show confirmation
  useEffect(() => {
    if (open && status === 'idle') {
      setStatus('confirming')
    }
  }, [open, status])

  async function handleConfirm() {
    setStatus('updating')
    setLog([])
    setError(null)

    addLog('Начинаем обновление...')
    addLog('Отправлен запрос на обновление...')

    try {
      await upgradeCore()
      addLog('Обновление завершено успешно!')
      setStatus('success')

      // Re-fetch mihomo version and update store
      try {
        const versionData = await fetchMihomoVersion()
        setVersions({ mihomo: versionData.version })
        addLog(`Новая версия: ${versionData.version}`)
      } catch {
        addLog('Не удалось получить новую версию')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      addLog(`Ошибка: ${message}`)
      setError(message)
      setStatus('error')
    }
  }

  function handleClose() {
    setStatus('idle')
    setLog([])
    setError(null)
    onClose()
  }

  function handleRetry() {
    handleConfirm()
  }

  // Confirmation dialog
  if (status === 'confirming') {
    return (
      <AlertDialog
        open
        onOpenChange={(isOpen) => {
          if (!isOpen) handleClose()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Обновить ядро mihomo?</AlertDialogTitle>
            <AlertDialogDescription>
              {mihomoVersion
                ? `Текущая версия: ${mihomoVersion}. Будет установлена последняя доступная версия.`
                : 'Будет установлена последняя доступная версия.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleClose}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Обновить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  // Overlay with progress
  if (status === 'updating' || status === 'success' || status === 'error') {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-background border rounded-lg shadow-lg p-6 w-full max-w-md mx-4 space-y-4">
          {/* Header with status icon */}
          <div className="flex items-center gap-3">
            {status === 'updating' && (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            {status === 'success' && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            {status === 'error' && (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <h3 className="text-lg font-semibold">
              {status === 'updating' && 'Обновление ядра...'}
              {status === 'success' && 'Обновление завершено'}
              {status === 'error' && 'Ошибка обновления'}
            </h3>
          </div>

          {/* Log area */}
          <pre
            ref={logContainerRef}
            className="bg-muted rounded-md p-3 text-xs font-mono overflow-y-auto max-h-60 whitespace-pre-wrap"
          >
            {log.join('\n')}
          </pre>

          {/* Action buttons */}
          <div className="flex justify-end gap-2">
            {status === 'error' && (
              <Button variant="outline" size="sm" onClick={handleRetry}>
                Повторить
              </Button>
            )}
            {(status === 'success' || status === 'error') && (
              <Button size="sm" onClick={handleClose}>
                Закрыть
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
