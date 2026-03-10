import type { ReactNode } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatBytes } from '@/lib/format'
import { formatDate } from './shared'

export interface BaseRelease {
  tag_name: string
  published_at: string
  is_current: boolean
  is_newer: boolean
}

interface ReleasesListProps<T extends BaseRelease> {
  releases: T[]
  loading: boolean
  error?: string | null
  onRefresh: () => void
  renderAction: (release: T) => ReactNode
  getSize?: (release: T) => number
}

export function ReleasesList<T extends BaseRelease>({
  releases,
  loading,
  error,
  onRefresh,
  renderAction,
  getSize,
}: ReleasesListProps<T>) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-top-1 duration-200 flex flex-col gap-2">
      {error && !loading && (
        <p className="text-xs text-red-500 animate-in fade-in-0 duration-150">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Все версии</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      <ScrollArea className="max-h-[35vh] -mx-6 px-6">
        {loading && releases.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1 pb-2">
            {releases.map((rel) => (
              <div
                key={rel.tag_name}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors duration-150 ${
                  rel.is_current
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{rel.tag_name}</span>
                    {rel.is_current && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        текущая
                      </Badge>
                    )}
                    {!rel.is_current && rel.is_newer && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        новее
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{formatDate(rel.published_at)}</span>
                    {getSize && getSize(rel) > 0 && (
                      <span>{formatBytes(getSize(rel))}</span>
                    )}
                  </div>
                </div>

                {renderAction(rel)}
              </div>
            ))}

            {releases.length === 0 && !loading && (
              <p className="text-center text-xs text-muted-foreground py-4">
                Релизы не найдены
              </p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
