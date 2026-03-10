/**
 * Zustand store for logs page state.
 *
 * Volatile (no persist) -- receives live WebSocket log entries.
 * Ring buffer with max 1000 entries.
 * Supports level filtering, search, pause, and export.
 */

import { create } from 'zustand'
import { useSettingsStore } from '@/stores/settings'

export interface LogEntry {
  id: number
  time: string       // HH:MM:SS from structured format
  level: string      // 'debug' | 'info' | 'warning' | 'error'
  message: string
  fields: Array<{ key: string; value: string }>
}

interface LogsState {
  entries: LogEntry[]
  nextId: number
  activeLevels: Set<string>   // Which levels shown (all active by default)
  searchQuery: string
  paused: boolean

  // Computed
  filteredEntries: () => LogEntry[]

  // Actions
  addEntry: (raw: { time: string; level: string; message: string; fields?: Array<{ key: string; value: string }> }) => void
  clear: () => void
  toggleLevel: (level: string) => void
  setSearchQuery: (q: string) => void
  setPaused: (p: boolean) => void
  exportTxt: () => void
  exportJson: () => void
}

function normalizeLevel(level: string): string {
  if (level === 'warn') return 'warning'
  return level.toLowerCase()
}

export const useLogsStore = create<LogsState>()((set, get) => ({
  entries: [],
  nextId: 0,
  activeLevels: new Set(['debug', 'info', 'warning', 'error']),
  searchQuery: '',
  paused: false,

  // Computed
  filteredEntries: () => {
    const { entries, activeLevels, searchQuery } = get()

    let result = entries

    // Filter by active levels
    result = result.filter((e) => activeLevels.has(e.level))

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((e) =>
        e.message.toLowerCase().includes(q) ||
        e.fields.some((f) => f.value.toLowerCase().includes(q))
      )
    }

    return result
  },

  // Actions
  addEntry: (raw) => {
    set((state) => {
      if (state.paused) return state

      const entry: LogEntry = {
        id: state.nextId,
        time: raw.time,
        level: normalizeLevel(raw.level),
        message: raw.message,
        fields: raw.fields ?? [],
      }

      const newEntries = [...state.entries, entry]

      // Ring buffer: keep only last N entries (configurable)
      const maxEntries = useSettingsStore.getState().maxLogEntries
      if (newEntries.length > maxEntries) {
        return {
          entries: newEntries.slice(-maxEntries),
          nextId: state.nextId + 1,
        }
      }

      return {
        entries: newEntries,
        nextId: state.nextId + 1,
      }
    })
  },

  clear: () => set({ entries: [], nextId: 0 }),

  toggleLevel: (level) => {
    set((state) => {
      const newLevels = new Set(state.activeLevels)
      if (newLevels.has(level)) {
        newLevels.delete(level)
      } else {
        newLevels.add(level)
      }
      return { activeLevels: newLevels }
    })
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  setPaused: (p) => set({ paused: p }),

  exportTxt: () => {
    const { entries } = get()
    const lines = entries.map(
      (e) => `[${e.time}] [${e.level.toUpperCase()}] ${e.message}`
    )
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mihomo-logs-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  exportJson: () => {
    const { entries } = get()
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mihomo-logs-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },
}))
