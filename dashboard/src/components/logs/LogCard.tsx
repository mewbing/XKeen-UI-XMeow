import React from 'react'
import type { LogEntry } from '@/stores/logs'

const levelColors: Record<string, string> = {
  debug: 'bg-muted text-muted-foreground',
  info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  error: 'bg-red-500/15 text-red-600 dark:text-red-400',
}

export const LogCard = React.memo(function LogCard({ entry }: { entry: LogEntry }) {
  const badgeColor = levelColors[entry.level] ?? levelColors.debug

  return (
    <div className="flex items-start gap-2 px-3 py-1.5 border-b border-border/50 text-xs">
      <span
        className={`${badgeColor} px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider w-[52px] text-center shrink-0`}
      >
        {entry.level}
      </span>
      <span className="text-muted-foreground font-mono shrink-0">{entry.time}</span>
      <div className="min-w-0 flex-1">
        <span className="text-foreground break-all">{entry.message}</span>
        {entry.fields.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {entry.fields.map((f, i) => (
              <span key={i} className="text-muted-foreground font-mono">
                <span className="text-foreground/70">{f.key}</span>={f.value}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
