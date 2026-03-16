/**
 * Zustand store for remote agent management.
 *
 * Volatile (non-persisted) store for runtime remote agent state.
 * Manages agent list, WebSocket connection for real-time status,
 * and active agent context switching.
 */

import { create } from 'zustand'
import { useSettingsStore } from '@/stores/settings'
import {
  fetchAgents as apiFetchAgents,
  type AgentInfo,
} from '@/lib/remote-api'

interface RemoteState {
  // Agent list
  agents: AgentInfo[]
  loading: boolean
  error: string | null

  // Active remote context (null = local router)
  activeAgentId: string | null

  // WebSocket connection
  wsConnected: boolean

  // Actions
  fetchAgents: () => Promise<void>
  setActiveAgent: (id: string | null) => void
  connectWs: () => void
  disconnectWs: () => void
}

// WebSocket instance and reconnect timer (outside Zustand for cleanup)
let ws: WebSocket | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null

function clearReconnectTimer() {
  if (wsReconnectTimer !== null) {
    clearTimeout(wsReconnectTimer)
    wsReconnectTimer = null
  }
}

export const useRemoteStore = create<RemoteState>()((set, get) => ({
  agents: [],
  loading: false,
  error: null,
  activeAgentId: null,
  wsConnected: false,

  fetchAgents: async () => {
    set({ loading: true, error: null })
    try {
      const agents = await apiFetchAgents()
      set({ agents, loading: false })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch agents',
      })
    }
  },

  setActiveAgent: (id: string | null) => {
    set({ activeAgentId: id })
  },

  connectWs: () => {
    // Already connected or connecting
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    clearReconnectTimer()

    const { configApiUrl, mihomoSecret } = useSettingsStore.getState()
    if (!configApiUrl) return

    // Build WS URL: replace http(s) with ws(s)
    const wsUrl = configApiUrl.replace(/^http/, 'ws')
    const params = mihomoSecret ? `?token=${encodeURIComponent(mihomoSecret)}` : ''
    const url = `${wsUrl}/ws/remote/status${params}`

    try {
      ws = new WebSocket(url)
    } catch {
      // WebSocket constructor can throw on invalid URL
      return
    }

    ws.onopen = () => {
      set({ wsConnected: true })
    }

    ws.onmessage = (event) => {
      try {
        const agents = JSON.parse(event.data) as AgentInfo[]
        set({ agents })
      } catch {
        // Ignore malformed messages
      }
    }

    ws.onclose = () => {
      set({ wsConnected: false })
      ws = null

      // Auto-reconnect after 5s
      clearReconnectTimer()
      wsReconnectTimer = setTimeout(() => {
        wsReconnectTimer = null
        // Only reconnect if store still wants connection
        // (disconnectWs sets ws to null and clears timer)
        get().connectWs()
      }, 5000)
    }

    ws.onerror = () => {
      // Will trigger onclose, which handles reconnect
    }
  },

  disconnectWs: () => {
    clearReconnectTimer()
    if (ws) {
      ws.onclose = null // Prevent auto-reconnect
      ws.close()
      ws = null
    }
    set({ wsConnected: false })
  },
}))
