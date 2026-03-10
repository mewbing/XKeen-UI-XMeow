import { useEffect, useRef } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface InstallProgressProps {
  installing: boolean
  installingVersion: string | null
  downloadProgress: number
  installLog: string[]
  installDone: boolean
  error: string | null
  onClose: () => void
}

export function InstallProgress({
  installing,
  installingVersion,
  downloadProgress,
  installLog,
  installDone,
  error,
  onClose,
}: InstallProgressProps) {
  const logRef = useRef<HTMLPreElement>(null)

  const hasError = !!error && !installing
  const showCloseBtn = installDone || hasError

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [installLog])

  const titleIcon = installing
    ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
    : hasError
      ? <XCircle className="h-4 w-4 text-red-500" />
      : installDone
        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
        : null

  const titleText = installing
    ? `Установка ${installingVersion}...`
    : hasError
      ? 'Ошибка установки'
      : 'Установка завершена'

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 text-sm font-medium mb-3 shrink-0">
        {titleIcon}
        {titleText}
      </div>

      <div className="animate-in fade-in-0 duration-200 space-y-3">
        {/* Download progress bar */}
        {installing && downloadProgress > 0 && downloadProgress < 100 && (
          <div className="w-full bg-muted rounded-full h-1.5 animate-in fade-in-0 duration-150">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        )}

        <pre
          ref={logRef}
          className="bg-muted rounded-md p-3 text-xs font-mono overflow-y-auto max-h-48 whitespace-pre-wrap"
        >
          {installLog.join('\n')}
        </pre>

        {showCloseBtn && (
          <div className="flex justify-end animate-in fade-in-0 duration-150">
            <Button size="sm" onClick={onClose}>Закрыть</Button>
          </div>
        )}
      </div>
    </div>
  )
}
