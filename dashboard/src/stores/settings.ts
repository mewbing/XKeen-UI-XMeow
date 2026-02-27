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

  // Proxies page settings
  proxiesGridColumns: 1 | 2 | 3
  proxiesDensity: 'min' | 'mid' | 'max'
  proxiesSort: 'name' | 'delay' | 'default'
  proxiesTypeStyle: 'badge' | 'border' | 'icon'
  proxiesShowAutoInfo: boolean

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
  setProxiesTypeStyle: (s: 'badge' | 'border' | 'icon') => void
  setProxiesShowAutoInfo: (v: boolean) => void
  resetConfig: () => void
}

const initialState = {
  isConfigured: false,
  installationType: null as 'local' | 'cdn' | null,
  mihomoApiUrl: '',
  mihomoSecret: '',
  configApiUrl: '',
  startPage: 'overview' as const,
  lastVisitedPage: '/overview',
  proxiesGridColumns: 3 as 1 | 2 | 3,
  proxiesDensity: 'mid' as const,
  proxiesSort: 'default' as const,
  proxiesTypeStyle: 'badge' as const,
  proxiesShowAutoInfo: true,
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
      setProxiesShowAutoInfo: (v) => set({ proxiesShowAutoInfo: v }),

      resetConfig: () => set({ ...initialState }),
    }),
    {
      name: 'mihomo-dashboard-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
