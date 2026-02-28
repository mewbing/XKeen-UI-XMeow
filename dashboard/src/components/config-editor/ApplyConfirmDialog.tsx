/**
 * Confirmation dialog for Apply action.
 *
 * Warns the user that saving + restarting mihomo may briefly
 * interrupt connections. Shows additional YAML error warning
 * when the current content has validation errors.
 */

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

interface ApplyConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  hasYamlError: boolean
}

export function ApplyConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  hasYamlError,
}: ApplyConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Применить конфиг?</AlertDialogTitle>
          <AlertDialogDescription>
            Файл будет сохранён на диск, а mihomo перезапущен. Это может
            кратковременно прервать соединения.
          </AlertDialogDescription>
          {hasYamlError && (
            <p className="text-sm font-medium text-destructive mt-2">
              YAML содержит ошибки. Продолжить?
            </p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Применить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
