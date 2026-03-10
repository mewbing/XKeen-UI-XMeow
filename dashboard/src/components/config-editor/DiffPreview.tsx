/**
 * Diff preview dialog for config editor Apply action.
 *
 * Shows a Monaco DiffEditor in an AlertDialog so the user can
 * review changes before applying. Can be disabled in settings.
 */

import { DiffEditor } from '@monaco-editor/react'

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
import { Skeleton } from '@/components/ui/skeleton'
import { useMonacoTheme, registerMonacoTheme } from '@/hooks/use-theme'

interface DiffPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  original: string
  modified: string
  language: string
  onConfirmApply: () => void
}

export function DiffPreview({
  open,
  onOpenChange,
  original,
  modified,
  language,
  onConfirmApply,
}: DiffPreviewProps) {
  const monacoTheme = useMonacoTheme()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="!max-w-[95vw] w-[95vw]">
        <AlertDialogHeader>
          <AlertDialogTitle>Изменения перед Apply</AlertDialogTitle>
          <AlertDialogDescription>
            Слева — исходная версия, справа — изменённая.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="h-[75vh] border rounded-md overflow-hidden">
          <DiffEditor
            original={original}
            modified={modified}
            language={language}
            beforeMount={registerMonacoTheme}
            theme={monacoTheme}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
            }}
            loading={<Skeleton className="h-full w-full" />}
          />
        </div>

        <AlertDialogFooter className="sm:justify-between">
          <p className="text-[11px] text-muted-foreground self-center">
            Эту проверку можно отключить в настройках
          </p>
          <div className="flex gap-2">
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onConfirmApply}>
              Применить
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
