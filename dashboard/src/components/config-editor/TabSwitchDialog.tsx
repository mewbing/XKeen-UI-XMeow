/**
 * Dialog shown when switching away from a tab with unsaved changes.
 *
 * Offers three options: save and switch, discard changes and switch,
 * or stay on the current tab.
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
import { Button } from '@/components/ui/button'

interface TabSwitchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentTabName: string
  onSaveAndSwitch: () => Promise<void>
  onDiscardAndSwitch: () => void
  onStay: () => void
}

export function TabSwitchDialog({
  open,
  onOpenChange,
  currentTabName,
  onSaveAndSwitch,
  onDiscardAndSwitch,
  onStay,
}: TabSwitchDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Несохранённые изменения</AlertDialogTitle>
          <AlertDialogDescription>
            В табе &laquo;{currentTabName}&raquo; есть несохранённые изменения.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-between">
          <AlertDialogCancel onClick={onStay}>Остаться</AlertDialogCancel>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onDiscardAndSwitch}>
              Отменить изменения
            </Button>
            <AlertDialogAction onClick={onSaveAndSwitch}>
              Сохранить и переключить
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
