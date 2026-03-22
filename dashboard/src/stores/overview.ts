import { create } from 'zustand'
import type { Connection } from '@/lib/mihomo-api'

const HISTORY_LENGTH = 60

export interface TrafficPoint {
  time: number
  up: number
  down: number
}

export interface MemoryPoint {
  time: number
  mihomo: number
  system: number
}

export interface SinglePoint {
  time: number
  value: number
}

const EMPTY_TRAFFIC: TrafficPoint[] = Array.from({ length: HISTORY_LENGTH }, (_, i) => ({
  time: i, up: 0, down: 0,
}))

const EMPTY_MEMORY: MemoryPoint[] = Array.from({ length: HISTORY_LENGTH }, (_, i) => ({
  time: i, mihomo: 0, system: 0,
}))

const EMPTY_SINGLE: SinglePoint[] = Array.from({ length: HISTORY_LENGTH }, (_, i) => ({
  time: i, value: 0,
}))

interface OverviewState {
  uploadSpeed: number
  downloadSpeed: number
  uploadTotal: number
  downloadTotal: number
  memoryInuse: number
  systemMemTotal: number
  systemMemUsed: number
  activeConnections: number
  cpuUsage: number

  trafficHistory: TrafficPoint[]
  memoryHistory: MemoryPoint[]
  connectionsHistory: SinglePoint[]
  cpuHistory: SinglePoint[]

  connections: Connection[]

  startTime: number | null

  mihomoVersion: string
  dashboardVersion: string
  xkeenVersion: string
  serverVersion: string

  updateTraffic: (data: {
    up: number
    down: number
    upTotal: number
    downTotal: number
  }) => void
  updateMemory: (data: { inuse: number }) => void
  updateConnections: (count: number) => void
  setConnections: (connections: Connection[]) => void
  updateSystemPerf: (cpu: number, mem: { total: number; used: number }) => void
  setStartTime: (time: number) => void
  setVersions: (v: {
    mihomo?: string
    dashboard?: string
    xkeen?: string
    server?: string
  }) => void

  /** Reset all volatile data (used on context switch to avoid stale data) */
  resetVolatile: () => void
}

export const useOverviewStore = create<OverviewState>()((set) => ({
  uploadSpeed: 0,
  downloadSpeed: 0,
  uploadTotal: 0,
  downloadTotal: 0,
  memoryInuse: 0,
  systemMemTotal: 0,
  systemMemUsed: 0,
  activeConnections: 0,
  cpuUsage: 0,

  trafficHistory: EMPTY_TRAFFIC,
  memoryHistory: EMPTY_MEMORY,
  connectionsHistory: EMPTY_SINGLE,
  cpuHistory: EMPTY_SINGLE,

  connections: [],

  startTime: null,

  mihomoVersion: '',
  dashboardVersion: '',
  xkeenVersion: '',
  serverVersion: '',

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

  // Mihomo memory WS drives the memory chart — carries forward latest system RAM
  updateMemory: (data) =>
    set((state) => ({
      memoryInuse: data.inuse,
      memoryHistory: [
        ...state.memoryHistory.slice(-(HISTORY_LENGTH - 1)),
        { time: Date.now(), mihomo: data.inuse, system: state.systemMemUsed },
      ],
    })),

  updateConnections: (count) =>
    set((state) => ({
      activeConnections: count,
      connectionsHistory: [
        ...state.connectionsHistory.slice(-(HISTORY_LENGTH - 1)),
        { time: Date.now(), value: count },
      ],
    })),

  setConnections: (connections) => set({ connections }),

  // CPU + system RAM fetched together via Promise.all
  // CPU goes to cpuHistory; system RAM scalars updated (next WS memory msg carries it into memoryHistory)
  updateSystemPerf: (cpu, mem) =>
    set((state) => ({
      cpuUsage: cpu,
      systemMemTotal: mem.total,
      systemMemUsed: mem.used,
      cpuHistory: [
        ...state.cpuHistory.slice(-(HISTORY_LENGTH - 1)),
        { time: Date.now(), value: cpu },
      ],
    })),

  setStartTime: (time) => set((state) =>
    state.startTime === null ? { startTime: time } : {}
  ),

  setVersions: (v) =>
    set({
      ...(v.mihomo !== undefined && { mihomoVersion: v.mihomo }),
      ...(v.dashboard !== undefined && { dashboardVersion: v.dashboard }),
      ...(v.xkeen !== undefined && { xkeenVersion: v.xkeen }),
      ...(v.server !== undefined && { serverVersion: v.server }),
    }),

  resetVolatile: () =>
    set({
      uploadSpeed: 0,
      downloadSpeed: 0,
      uploadTotal: 0,
      downloadTotal: 0,
      memoryInuse: 0,
      systemMemTotal: 0,
      systemMemUsed: 0,
      activeConnections: 0,
      cpuUsage: 0,
      trafficHistory: EMPTY_TRAFFIC,
      memoryHistory: EMPTY_MEMORY,
      connectionsHistory: EMPTY_SINGLE,
      cpuHistory: EMPTY_SINGLE,
      connections: [],
      startTime: null,
      mihomoVersion: '',
      xkeenVersion: '',
      serverVersion: '',
    }),
}))
