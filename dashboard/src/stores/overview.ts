/**
 * Zustand store for overview page metrics state.
 *
 * Holds current metric values (speed, traffic, memory, connections),
 * a 60-point rolling traffic history buffer for the chart,
 * display mode toggle, version info, and client-side uptime tracking.
 *
 * NOT persisted -- all data is volatile real-time state.
 */

import { create } from 'zustand'

const HISTORY_LENGTH = 60

export interface TrafficPoint {
  time: number
  up: number
  down: number
}

interface OverviewState {
  // Current values
  uploadSpeed: number
  downloadSpeed: number
  uploadTotal: number
  downloadTotal: number
  memoryInuse: number
  activeConnections: number

  // Display mode
  metricsMode: 'compact' | 'panels'

  // History for chart (rolling 60-second window)
  trafficHistory: TrafficPoint[]

  // Uptime tracking (client-side)
  startTime: number | null

  // Versions
  mihomoVersion: string
  dashboardVersion: string
  xkeenVersion: string

  // Actions
  updateTraffic: (data: {
    up: number
    down: number
    upTotal: number
    downTotal: number
  }) => void
  updateMemory: (data: { inuse: number }) => void
  updateConnections: (count: number) => void
  setStartTime: (time: number) => void
  setMetricsMode: (mode: 'compact' | 'panels') => void
  setVersions: (v: {
    mihomo?: string
    dashboard?: string
    xkeen?: string
  }) => void
}

export const useOverviewStore = create<OverviewState>()((set) => ({
  // Initialize with zeros
  uploadSpeed: 0,
  downloadSpeed: 0,
  uploadTotal: 0,
  downloadTotal: 0,
  memoryInuse: 0,
  activeConnections: 0,

  metricsMode: 'compact',

  // Pre-fill with 60 zero-value points
  trafficHistory: Array.from({ length: HISTORY_LENGTH }, (_, i) => ({
    time: i,
    up: 0,
    down: 0,
  })),

  startTime: null,

  mihomoVersion: '',
  dashboardVersion: '',
  xkeenVersion: '',

  updateTraffic: (data) =>
    set((state) => ({
      uploadSpeed: data.up,
      downloadSpeed: data.down,
      uploadTotal: data.upTotal,
      downloadTotal: data.downTotal,
      trafficHistory: [
        ...state.trafficHistory.slice(-(HISTORY_LENGTH - 1)),
        { time: Date.now(), up: data.up, down: data.down },
      ],
    })),

  updateMemory: (data) => set({ memoryInuse: data.inuse }),

  updateConnections: (count) => set({ activeConnections: count }),

  setStartTime: (time) => set((state) =>
    state.startTime === null ? { startTime: time } : {}
  ),

  setMetricsMode: (mode) => set({ metricsMode: mode }),

  setVersions: (v) =>
    set({
      ...(v.mihomo !== undefined && { mihomoVersion: v.mihomo }),
      ...(v.dashboard !== undefined && { dashboardVersion: v.dashboard }),
      ...(v.xkeen !== undefined && { xkeenVersion: v.xkeen }),
    }),
}))
