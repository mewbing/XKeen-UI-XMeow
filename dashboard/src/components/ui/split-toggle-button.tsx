import { Columns2, Rows2, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/stores/settings'

const config = {
  none: { icon: Columns2, title: 'Разделить вертикально' },
  vertical: { icon: Rows2, title: 'Разделить горизонтально' },
  horizontal: { icon: Square, title: 'Одиночный вид' },
} as const

export function SplitToggleButton() {
  const splitMode = useSettingsStore((s) => s.splitMode)
  const cycleSplitMode = useSettingsStore((s) => s.cycleSplitMode)
  const { icon: Icon, title } = config[splitMode]

  return (
    <Button
      variant="outline"
      size="icon-sm"
      onClick={cycleSplitMode}
      title={title}
    >
      <Icon className="size-3.5" />
    </Button>
  )
}
