import { useLogsStore } from '@/stores/logs'
import { Card, CardContent } from '@/components/ui/card'
import { LogsToolbar } from './LogsToolbar'
import { LogStream } from './LogStream'

export function LogsTab() {
  // Subscribe to data that filteredEntries depends on to trigger re-renders
  useLogsStore((s) => s.entries)
  useLogsStore((s) => s.searchQuery)
  useLogsStore((s) => s.activeLevels)
  const filteredEntries = useLogsStore((s) => s.filteredEntries)

  const entries = filteredEntries()

  return (
    <Card className="flex flex-col flex-1 h-full w-full gap-0 py-0 overflow-hidden">
      <LogsToolbar />
      <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
        <LogStream entries={entries} />
      </CardContent>
    </Card>
  )
}
