import { CheckCircle2, Download, RefreshCw, RotateCcw, Loader2, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatBytes } from '@/lib/format'

interface UpdateStatusCardProps {
  label: string
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Version comparison */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono font-medium">{formatVersion(currentVersion)}</span>
          {hasUpdate && (
            <>
              <ArrowRight className="size-3.5 text-muted-foreground" />
              <span className="font-mono font-medium text-primary">{formatVersion(latestVersion)}</span>
            </>
          )}
        </div>

        {/* Badge */}
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

        {/* Update details */}
        {hasUpdate && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatBytes(assetSize)}</span>
            <span>{formatDate(publishedAt)}</span>
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
              Проверить обновления
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
      </CardContent>
    </Card>
  )
}
