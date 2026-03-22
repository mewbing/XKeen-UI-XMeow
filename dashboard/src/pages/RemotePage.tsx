import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useRemoteStore } from '@/stores/remote'
import { deleteAgent } from '@/lib/remote-api'
import { AgentList } from '@/components/remote/AgentList'
import { TokenManager } from '@/components/remote/TokenManager'
import { AddDirectDialog } from '@/components/remote/AddDirectDialog'
import { Loader2 } from 'lucide-react'
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

export default function RemotePage() {
  const agents = useRemoteStore((s) => s.agents)
  const loading = useRemoteStore((s) => s.loading)
  const error = useRemoteStore((s) => s.error)
  const fetchAgents = useRemoteStore((s) => s.fetchAgents)
  const setActiveAgent = useRemoteStore((s) => s.setActiveAgent)
  const navigate = useNavigate()

  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Refresh agents on mount (WS lifecycle managed by AppSidebar)
  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const handleConnect = (agentId: string) => {
    setActiveAgent(agentId)
    navigate('/overview')
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteAgent(deleteId)
      fetchAgents()
    } catch {
      // Silently fail
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="flex flex-col flex-1 p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Удалённое управление</h1>
        <div className="flex items-center gap-2">
          <AddDirectDialog onAdded={fetchAgents} />
          <TokenManager />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && agents.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <AgentList
          agents={agents}
          onConnect={handleConnect}
          onDelete={(id) => setDeleteId(id)}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить агент?</AlertDialogTitle>
            <AlertDialogDescription>
              Агент будет отключён и удалён из списка.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
