import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SettingsState {
  // Setup
  isConfigured: boolean
  installationType: 'local' | 'cdn' | null
  mihomoApiUrl: string
  mihomoSecret: string
  configApiUrl: string

  // Navigation
  startPage: 'overview' | 'last-visited' | string
  lastVisitedPage: string

  // Appearance
  theme: 'light' | 'dark' | 'system'
  reduceMotion: boolean

  // Network latency targets
  latencyTargets: Array<{ name: string; url: string }>

  // Connections/Logs layout
  splitMode: 'none' | 'vertical' | 'horizontal'
  syncScroll: boolean
  maxLogEntries: number

  // Config editor
  showDiffBeforeApply: boolean

  // Proxies page settings
  proxiesGridColumns: 1 | 2 | 3
  proxiesDensity: 'min' | 'mid' | 'max'
  proxiesSort: 'name' | 'delay' | 'default'
  proxiesTypeStyle: 'badge' | 'border' | 'icon' | 'none'
  proxiesShowAutoInfo: boolean

  // Rules editor
  rulesDensity: 'min' | 'detailed'
  rulesConfirmDelete: boolean
  rulesShowDiffBeforeApply: boolean

  // Updates
  autoCheckUpdates: boolean

  // Actions
  setConfigured: (config: {
    type: 'local' | 'cdn'
    mihomoUrl: string
    mihomoSecret: string
    configUrl: string
  }) => void
  setStartPage: (page: string) => void
  setLastVisitedPage: (page: string) => void
  setProxiesGridColumns: (cols: 1 | 2 | 3) => void
  setProxiesDensity: (d: 'min' | 'mid' | 'max') => void
  setProxiesSort: (s: 'name' | 'delay' | 'default') => void
  setProxiesTypeStyle: (s: 'badge' | 'border' | 'icon' | 'none') => void
  setTheme: (t: 'light' | 'dark' | 'system') => void
  setReduceMotion: (v: boolean) => void
  setShowDiffBeforeApply: (v: boolean) => void
  setProxiesShowAutoInfo: (v: boolean) => void
  cycleSplitMode: () => void
  toggleSyncScroll: () => void
  setMaxLogEntries: (n: number) => void
  setLatencyTargets: (targets: Array<{ name: string; url: string }>) => void
  addLatencyTarget: (target: { name: string; url: string }) => void
  removeLatencyTarget: (index: number) => void
  setRulesDensity: (v: 'min' | 'detailed') => void
  setRulesConfirmDelete: (v: boolean) => void
  setRulesShowDiffBeforeApply: (v: boolean) => void
  setAutoCheckUpdates: (v: boolean) => void
  setMihomoSecret: (s: string) => void
  resetConfig: () => void
}

const defaultLatencyTargets = [
  { name: 'Cloudflare', url: 'https://www.cloudflare.com/cdn-cgi/trace' },
  { name: 'Google', url: 'https://www.gstatic.com/generate_204' },
  { name: 'YouTube', url: 'https://www.youtube.com/generate_204' },
  { name: 'GitHub', url: 'https://github.com' },
]

const initialState = {
  isConfigured: false,
  installationType: null as 'local' | 'cdn' | null,
  mihomoApiUrl: '',
  mihomoSecret: '',
  configApiUrl: '',
  startPage: 'overview' as const,
  lastVisitedPage: '/overview',
  theme: 'system' as const,
  reduceMotion: false,
  latencyTargets: defaultLatencyTargets,
  proxiesGridColumns: 3 as 1 | 2 | 3,
  proxiesDensity: 'mid' as const,
  proxiesSort: 'default' as const,
  proxiesTypeStyle: 'badge' as const,
  proxiesShowAutoInfo: true,
  showDiffBeforeApply: false,
  splitMode: 'none' as const,
  syncScroll: false,
  maxLogEntries: 1000,
  rulesDensity: 'min' as const,
  rulesConfirmDelete: true,
  rulesShowDiffBeforeApply: true,
  autoCheckUpdates: true,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...initialState,

      setConfigured: (config) =>
        set({
          isConfigured: true,
          installationType: config.type,
          mihomoApiUrl: config.mihomoUrl,
          mihomoSecret: config.mihomoSecret,
          configApiUrl: config.configUrl,
        }),

      setStartPage: (page) => set({ startPage: page }),

      setLastVisitedPage: (page) => set({ lastVisitedPage: page }),

      setProxiesGridColumns: (cols) => set({ proxiesGridColumns: cols }),
      setProxiesDensity: (d) => set({ proxiesDensity: d }),
      setProxiesSort: (s) => set({ proxiesSort: s }),
      setProxiesTypeStyle: (s) => set({ proxiesTypeStyle: s }),
      setTheme: (t) => set({ theme: t }),
      setReduceMotion: (v) => set({ reduceMotion: v }),
      setShowDiffBeforeApply: (v) => set({ showDiffBeforeApply: v }),
      setProxiesShowAutoInfo: (v) => set({ proxiesShowAutoInfo: v }),
      cycleSplitMode: () =>
        set((state) => {
          const next = { none: 'vertical', vertical: 'horizontal', horizontal: 'none' } as const
          return { splitMode: next[state.splitMode] }
        }),
      toggleSyncScroll: () =>
        set((state) => ({ syncScroll: !state.syncScroll })),
      setMaxLogEntries: (n) => set({ maxLogEntries: Math.max(100, Math.min(10000, n)) }),
      setLatencyTargets: (targets) => set({ latencyTargets: targets }),
      addLatencyTarget: (target) =>
        set((state) => ({
          latencyTargets: [...state.latencyTargets, target],
        })),
      removeLatencyTarget: (index) =>
        set((state) => ({
          latencyTargets: state.latencyTargets.filter((_, i) => i !== index),
        })),

      setRulesDensity: (v) => set({ rulesDensity: v }),
      setRulesConfirmDelete: (v) => set({ rulesConfirmDelete: v }),
      setRulesShowDiffBeforeApply: (v) => set({ rulesShowDiffBeforeApply: v }),

      setAutoCheckUpdates: (v) => set({ autoCheckUpdates: v }),

      setMihomoSecret: (s) => set({ mihomoSecret: s }),

      resetConfig: () => set({ ...initialState }),
    }),
    {
      name: 'mihomo-dashboard-settings',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as object) }
        // Clean up removed fields from localStorage
        delete (merged as any).rulesGrouping
        delete (merged as any).rulesLayout
        delete (merged as any).rulesNewBlockMode
        return merged as typeof current
      },
    }
  )
)
