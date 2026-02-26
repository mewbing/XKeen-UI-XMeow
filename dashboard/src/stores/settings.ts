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

  // Actions
  setConfigured: (config: {
    type: 'local' | 'cdn'
    mihomoUrl: string
    mihomoSecret: string
    configUrl: string
  }) => void
  setStartPage: (page: string) => void
  setLastVisitedPage: (page: string) => void
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

      resetConfig: () => set({ ...initialState }),
    }),
    {
      name: 'mihomo-dashboard-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
