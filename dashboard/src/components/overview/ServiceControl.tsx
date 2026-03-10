/**
 * Service control dropdown with status badge.
 *
 * Self-contained component: uses useServiceStatus internally,
 * calls serviceAction directly. Shows current status as button
 * label with colored indicator, and dropdown with Start/Stop/Restart
 * actions. Destructive actions (Stop, Restart) require AlertDialog
 * confirmation.
 */

import { useState } from 'react'
import { Play, Square, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useServiceStatus } from '@/hooks/use-service-status'
import { serviceAction, type ServiceAction } from '@/lib/config-api'

type ConfirmAction = 'stop' | 'restart'

const confirmConfig: Record<
  ConfirmAction,
  { title: string; description: string; actionLabel: string }
> = {
  stop: {
    title: 'Остановить сервис?',
    description: 'Все активные подключения будут закрыты.',
    actionLabel: 'Остановить',
  },
  restart: {
    title: 'Перезапустить сервис?',
    description: 'Сервис будет временно недоступен.',
    actionLabel: 'Перезапустить',
  },
}

export function ServiceControl() {
  const { running, loading, refresh, error } = useServiceStatus()
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmAction | null>(null)

  // Hide entirely if Config API backend is unreachable
  if (!loading && error) return null

  async function handleAction(action: ServiceAction) {
    setActionLoading(true)
    try {
      await serviceAction(action)
      // Wait 3 seconds for service to start/stop, then refresh
      setTimeout(() => {
        refresh()
        setActionLoading(false)
      }, 3000)
    } catch (err) {
      console.error(`Service ${action} failed:`, err)
      setActionLoading(false)
    }
  }

  function handleMenuSelect(action: ServiceAction) {
    if (action === 'start') {
      // Start is non-destructive, no confirmation needed
      handleAction(action)
    } else {
      // Stop and Restart require confirmation
      setConfirmDialog(action)
    }
  }

  function handleConfirm() {
    if (confirmDialog) {
      handleAction(confirmDialog)
      setConfirmDialog(null)
    }
  }

  const isProcessing = loading || actionLoading

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isProcessing}
            title={isProcessing ? 'Обработка...' : running ? 'Запущен' : 'Остановлен'}
          >
            {isProcessing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  running ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={running || isProcessing}
            onSelect={() => handleMenuSelect('start')}
          >
            <Play className="h-4 w-4" />
            <span>Запустить</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!running || isProcessing}
            onSelect={() => handleMenuSelect('stop')}
          >
            <Square className="h-4 w-4" />
            <span>Остановить</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!running || isProcessing}
            onSelect={() => handleMenuSelect('restart')}
          >
            <RotateCcw className="h-4 w-4" />
            <span>Перезапустить</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation dialog for destructive actions */}
      <AlertDialog
        open={confirmDialog !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null)
        }}
      >
        {confirmDialog && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmConfig[confirmDialog].title}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmConfig[confirmDialog].description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleConfirm}>
                {confirmConfig[confirmDialog].actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  )
}
