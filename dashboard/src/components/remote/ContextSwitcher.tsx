/**
 * Router context switcher for sidebar.
 *
 * Shows active router (local or remote agent) and allows switching.
 * When switching context, volatile stores are cleared and navigation
 * goes to /overview for data re-fetch on the new target.
 */

import { useNavigate } from 'react-router'
import { Monitor, ChevronDown } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useRemoteStore } from '@/stores/remote'
import type { AgentInfo } from '@/lib/remote-api'
import { useState } from 'react'

export function ContextSwitcher() {
  const agents = useRemoteStore((s) => s.agents)
  const activeAgentId = useRemoteStore((s) => s.activeAgentId)
  const setActiveAgent = useRemoteStore((s) => s.setActiveAgent)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const activeAgent = activeAgentId
    ? agents.find((a) => a.id === activeAgentId)
    : null
  const isRemote = activeAgentId !== null
  const onlineAgents = agents.filter((a) => a.online)

  function handleSwitch(agentId: string | null) {
    setActiveAgent(agentId)
    setOpen(false)
    // Navigate to overview for fresh data
    navigate('/overview')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent/50 ${
            isRemote
              ? 'bg-blue-500/10 border border-blue-500/20'
              : 'border border-transparent'
          }`}
        >
          <Monitor className="size-3.5 shrink-0 text-muted-foreground" />
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span
              className={`size-1.5 rounded-full shrink-0 ${
                isRemote ? 'bg-blue-500' : 'bg-green-500'
              }`}
            />
            <span className="truncate font-medium">
              {isRemote && activeAgent ? activeAgent.name : 'Локальный'}
            </span>
          </div>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 p-1.5">
        <div className="space-y-0.5">
          {/* Local option */}
          <button
            className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs transition-colors ${
              !isRemote
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50 text-muted-foreground'
            }`}
            onClick={() => handleSwitch(null)}
          >
            <span className="size-1.5 rounded-full bg-green-500 shrink-0" />
            <span className="font-medium">Локальный</span>
          </button>

          {/* Separator */}
          {(onlineAgents.length > 0 || agents.length > 0) && (
            <div className="border-t my-1" />
          )}

          {/* Online agents */}
          {onlineAgents.length > 0 ? (
            onlineAgents.map((agent: AgentInfo) => (
              <button
                key={agent.id}
                className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs transition-colors ${
                  activeAgentId === agent.id
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50 text-muted-foreground'
                }`}
                onClick={() => handleSwitch(agent.id)}
              >
                <span className="size-1.5 rounded-full bg-blue-500 shrink-0" />
                <span className="truncate font-medium">{agent.name}</span>
              </button>
            ))
          ) : (
            <div className="px-2 py-1.5 text-[11px] text-muted-foreground/60">
              Нет подключённых агентов
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
