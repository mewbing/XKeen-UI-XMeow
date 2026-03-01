/**
 * Diff preview dialog for rules Apply action.
 *
 * Shows a Monaco DiffEditor in an AlertDialog so the user can
 * review changes before applying. Reuses pattern from Phase 5 DiffPreview.
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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useMonacoTheme, registerMonacoTheme } from '@/hooks/use-theme'
import { useSettingsStore } from '@/stores/settings'

interface RulesDiffPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  original: string
  modified: string
  onConfirmApply: () => void
}

export function RulesDiffPreview({
  open,
  onOpenChange,
  original,
  modified,
  onConfirmApply,
}: RulesDiffPreviewProps) {
  const monacoTheme = useMonacoTheme()
  const setRulesShowDiffBeforeApply = useSettingsStore(
    (s) => s.setRulesShowDiffBeforeApply
  )

  const handleDontShowAgain = (checked: boolean) => {
    if (checked) {
      setRulesShowDiffBeforeApply(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="!max-w-[95vw] w-[95vw]">
        <AlertDialogHeader>
          <AlertDialogTitle>Diff правил</AlertDialogTitle>
          <AlertDialogDescription>
            Слева — исходная версия, справа — изменённая.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="h-[75vh] border rounded-md overflow-hidden">
          <DiffEditor
            original={original}
            modified={modified}
            language="yaml"
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
          <div className="flex items-center gap-2 self-center">
            <Switch
              id="rules-dont-show-diff"
              size="sm"
              onCheckedChange={handleDontShowAgain}
            />
            <Label
              htmlFor="rules-dont-show-diff"
              className="text-[11px] text-muted-foreground cursor-pointer"
            >
              Больше не показывать
            </Label>
          </div>
          <div className="flex gap-2">
            <AlertDialogCancel>Отменить</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onConfirmApply}>
              Применить
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
