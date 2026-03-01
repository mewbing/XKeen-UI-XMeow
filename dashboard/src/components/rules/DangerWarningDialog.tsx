/**
 * Warning dialog for dangerous drag-and-drop moves.
 *
 * Shown every time (no "don't show again" checkbox)
 * when user moves MATCH or exclusion blocks.
 */

import { AlertTriangle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

// ── Pre-defined danger checks ──────────────────────────────────

export const DANGER_MATCH_MOVED = {
  title: 'Перемещение MATCH',
  description: 'Правило MATCH перехватывает ВЕСЬ оставшийся трафик. Перемещение его с последней позиции сделает все правила ниже недоступными.',
}

export const DANGER_EXCLUSIONS_MOVED = {
  title: 'Перемещение исключений',
  description: 'Персональные исключения имеют наивысший приоритет. Перемещение их ниже может привести к тому, что они перестанут работать.',
}

// ── Component ───────────────────────────────────────────

interface DangerWarningDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
}

export function DangerWarningDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  onCancel,
}: DangerWarningDialogProps) {
  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-full bg-amber-500/15">
              <AlertTriangle className="size-5 text-amber-400" />
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="mt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Отменить
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleConfirm}>
            Продолжить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
