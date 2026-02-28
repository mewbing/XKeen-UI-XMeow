import { useLogsStore } from '@/stores/logs'
import { LogsToolbar } from './LogsToolbar'
import { LogStream } from './LogStream'

export function LogsTab() {
  const filteredEntries = useLogsStore((s) => s.filteredEntries)
  const entries = filteredEntries()

  return (
    <div className="flex flex-col h-full">
      <LogsToolbar />
      <div className="flex-1 min-h-0">
        <LogStream entries={entries} />
      </div>
    </div>
  )
}
