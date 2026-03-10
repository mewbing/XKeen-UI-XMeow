import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, Download, RefreshCw, RotateCcw, Loader2, ArrowRight, Calendar, HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatBytes } from '@/lib/format'

interface UpdateStatusCardProps {
  label: string
  icon: LucideIcon
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  assetSize: number
  publishedAt: string
  checking: boolean
  applying: boolean
  onUpdate: () => void
  onRollback: () => void
  onCheck: () => void
  showRollback?: boolean
}

function formatVersion(v: string): string {
  if (!v) return '--'
  return v.startsWith('v') ? v : `v${v}`
}

function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function UpdateStatusCard({
  label,
  icon: Icon,
  currentVersion,
  latestVersion,
  hasUpdate,
  assetSize,
  publishedAt,
  checking,
  applying,
  onUpdate,
  onRollback,
  onCheck,
  showRollback = true,
}: UpdateStatusCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>

      {/* Version */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl font-bold font-mono tabular-nums">{formatVersion(currentVersion)}</span>
        {hasUpdate && (
          <>
            <ArrowRight className="size-4 text-muted-foreground" />
            <span className="text-2xl font-bold font-mono tabular-nums text-primary">{formatVersion(latestVersion)}</span>
          </>
        )}
      </div>

      {/* Status badge */}
      <div className="mb-4">
        {hasUpdate ? (
          <Badge variant="outline" className="border-amber-500/50 text-amber-500 bg-amber-500/10">
            Доступно обновление
          </Badge>
        ) : (
          <Badge variant="outline" className="border-green-500/50 text-green-500 bg-green-500/10">
            <CheckCircle2 className="size-3 mr-1" />
            Актуально
          </Badge>
        )}
      </div>

      {/* Update metadata */}
      {hasUpdate && assetSize > 0 && (
        <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <HardDrive className="size-3" />
            {formatBytes(assetSize)}
          </span>
          {publishedAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3" />
              {formatDate(publishedAt)}
            </span>
          )}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        {hasUpdate ? (
          <Button
            size="sm"
            disabled={applying || checking}
            onClick={onUpdate}
          >
            {applying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Обновить
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={checking}
            onClick={onCheck}
          >
            {checking ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Проверить
          </Button>
        )}

        {showRollback && !applying && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRollback}
          >
            <RotateCcw className="size-3.5" />
            Откатить
          </Button>
        )}
      </div>
    </div>
  )
}
