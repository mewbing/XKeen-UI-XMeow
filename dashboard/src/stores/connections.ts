/**
 * Zustand store for connections page state.
 *
 * Volatile (no persist) -- receives live WebSocket snapshots.
 * Calculates per-connection speed from snapshot deltas.
 * Column visibility preferences stored in localStorage.
 */

import { create } from 'zustand'
import type { Connection, ConnectionsSnapshot } from '@/lib/mihomo-api'
import { closeConnection as apiCloseConnection, closeAllConnections as apiCloseAllConnections } from '@/lib/mihomo-api'
import { toast } from 'sonner'

export interface ConnectionWithSpeed extends Connection {
  dlSpeed: number  // bytes/sec calculated from snapshot delta
  ulSpeed: number
}

interface ConnectionsState {
  // Data
  connections: ConnectionWithSpeed[]
  totalUpload: number
  totalDownload: number

  // UI state
  paused: boolean
  searchQuery: string
  networkFilter: string      // 'all' | 'tcp' | 'udp'
  ruleFilter: string         // 'all' | specific rule
  chainFilter: string        // 'all' | specific proxy chain
  expandedId: string | null
  visibleColumns: string[]

  // Internal (for speed calc)
  _prevSnapshot: Map<string, { upload: number; download: number }> | null
  _prevTime: number

  // Computed
  filteredConnections: () => ConnectionWithSpeed[]
  uniqueRules: () => string[]
  uniqueChains: () => string[]

  // Actions
  updateSnapshot: (snapshot: ConnectionsSnapshot) => void
  setPaused: (p: boolean) => void
  setSearchQuery: (q: string) => void
  setNetworkFilter: (f: string) => void
  setRuleFilter: (f: string) => void
  setChainFilter: (f: string) => void
  setVisibleColumns: (cols: string[]) => void
  toggleExpanded: (id: string) => void
  closeConnection: (id: string) => Promise<void>
  closeAllConnections: () => Promise<void>
}

const DEFAULT_COLUMNS = ['host', 'network', 'source', 'destination', 'rule', 'chains', 'dlSpeed', 'ulSpeed']

function loadVisibleColumns(): string[] {
  try {
    const saved = localStorage.getItem('connectionsVisibleColumns')
    if (saved) return JSON.parse(saved)
  } catch { /* ignore */ }
  return DEFAULT_COLUMNS
}

function saveVisibleColumns(cols: string[]) {
  localStorage.setItem('connectionsVisibleColumns', JSON.stringify(cols))
}

export const useConnectionsStore = create<ConnectionsState>()((set, get) => ({
  // Data
  connections: [],
  totalUpload: 0,
  totalDownload: 0,

  // UI state
  paused: false,
  searchQuery: '',
  networkFilter: 'all',
  ruleFilter: 'all',
  chainFilter: 'all',
  expandedId: null,
  visibleColumns: loadVisibleColumns(),

  // Internal
  _prevSnapshot: null,
  _prevTime: 0,

  // Computed
  filteredConnections: () => {
    const { connections, networkFilter, ruleFilter, chainFilter, searchQuery } = get()

    let result = connections

    // Filter by network type
    if (networkFilter !== 'all') {
      result = result.filter((c) => c.metadata.network.toLowerCase() === networkFilter)
    }

    // Filter by rule
    if (ruleFilter !== 'all') {
      result = result.filter((c) => c.rule === ruleFilter)
    }

    // Filter by chain
    if (chainFilter !== 'all') {
      result = result.filter((c) => c.chains.join(' / ') === chainFilter || c.chains[0] === chainFilter)
    }

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((c) =>
        c.metadata.host.toLowerCase().includes(q) ||
        c.metadata.sourceIP.toLowerCase().includes(q) ||
        c.metadata.destinationIP.toLowerCase().includes(q) ||
        c.rule.toLowerCase().includes(q) ||
        c.chains.join(' ').toLowerCase().includes(q) ||
        c.metadata.processPath.toLowerCase().includes(q)
      )
    }

    return result
  },

  uniqueRules: () => {
    const { connections } = get()
    return [...new Set(connections.map((c) => c.rule))].sort()
  },

  uniqueChains: () => {
    const { connections } = get()
    return [...new Set(connections.map((c) => c.chains.join(' / ')))].sort()
  },

  // Actions
  updateSnapshot: (snapshot) => {
    const state = get()
    if (state.paused) return

    const now = Date.now()
    const timeDelta = state._prevTime > 0 ? (now - state._prevTime) / 1000 : 0
    const prevMap = state._prevSnapshot

    const newConnections: ConnectionWithSpeed[] = (snapshot.connections ?? []).map((conn) => {
      let dlSpeed = 0
      let ulSpeed = 0

      if (prevMap && timeDelta > 0) {
        const prev = prevMap.get(conn.id)
        if (prev) {
          dlSpeed = Math.max(0, (conn.download - prev.download) / timeDelta)
          ulSpeed = Math.max(0, (conn.upload - prev.upload) / timeDelta)
        }
      }

      return { ...conn, dlSpeed, ulSpeed }
    })

    // Build new prev snapshot map
    const newPrevMap = new Map<string, { upload: number; download: number }>()
    for (const conn of snapshot.connections ?? []) {
      newPrevMap.set(conn.id, { upload: conn.upload, download: conn.download })
    }

    set({
      connections: newConnections,
      totalUpload: snapshot.uploadTotal,
      totalDownload: snapshot.downloadTotal,
      _prevSnapshot: newPrevMap,
      _prevTime: now,
    })
  },

  setPaused: (p) => set({ paused: p }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setNetworkFilter: (f) => set({ networkFilter: f }),
  setRuleFilter: (f) => set({ ruleFilter: f }),
  setChainFilter: (f) => set({ chainFilter: f }),

  setVisibleColumns: (cols) => {
    saveVisibleColumns(cols)
    set({ visibleColumns: cols })
  },

  toggleExpanded: (id) => {
    set((state) => ({
      expandedId: state.expandedId === id ? null : id,
    }))
  },

  closeConnection: async (id) => {
    try {
      await apiCloseConnection(id)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to close connection'
      toast.error(message)
    }
  },

  closeAllConnections: async () => {
    try {
      await apiCloseAllConnections()
      toast.success('All connections closed')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to close all connections'
      toast.error(message)
    }
  },
}))
