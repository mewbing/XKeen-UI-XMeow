import { create } from 'zustand'
import {
  fetchMihomoReleases,
  fetchMihomoReleasesFromGitHub,
  fetchXmeowReleases,
  fetchXmeowReleasesFromGitHub,
  fetchXkeenReleases,
  fetchXkeenReleasesFromGitHub,
  installMihomoVersion as apiInstallMihomo,
  installXmeowVersion as apiInstallXmeow,
} from '@/lib/releases-api'
import { useOverviewStore } from '@/stores/overview'
import type {
  MihomoRelease,
  XmeowRelease,
  XkeenRelease,
} from '@/lib/releases-api'

interface ReleasesState {
  // Mihomo
  mihomoReleases: MihomoRelease[]
  mihomoCurrentVersion: string
  mihomoLoading: boolean
  mihomoInstalling: boolean
  mihomoInstallingVersion: string | null
  mihomoError: string | null
  mihomoInstallLog: string[]
  mihomoInstallDone: boolean
  mihomoDownloadProgress: number

  // XMeow
  xmeowReleases: XmeowRelease[]
  xmeowCurrentVersion: string
  xmeowLoading: boolean
  xmeowInstalling: boolean
  xmeowInstallingVersion: string | null
  xmeowInstallTarget: 'server' | 'dist' | null
  xmeowError: string | null
  xmeowInstallLog: string[]
  xmeowInstallDone: boolean
  xmeowDownloadProgress: number

  // XKeen
  xkeenReleases: XkeenRelease[]
  xkeenCurrentVersion: string
  xkeenLoading: boolean
  xkeenError: string | null

  // Update indicators (lightweight, set on startup)
  mihomoHasUpdate: boolean
  xkeenHasUpdate: boolean

  fetchMihomoReleases: () => Promise<void>
  installMihomoVersion: (version: string) => Promise<void>
  resetMihomoInstallState: () => void

  fetchXmeowReleases: () => Promise<void>
  installXmeowVersion: (version: string, target: 'server' | 'dist') => Promise<void>
  resetXmeowInstallState: () => void

  fetchXkeenReleases: () => Promise<void>

  setMihomoHasUpdate: (v: boolean) => void
  setXkeenHasUpdate: (v: boolean) => void

  clearErrors: () => void
}

export const useReleasesStore = create<ReleasesState>()((set, get) => ({
  // --- Mihomo ---
  mihomoReleases: [],
  mihomoCurrentVersion: '',
  mihomoLoading: false,
  mihomoInstalling: false,
  mihomoInstallingVersion: null,
  mihomoError: null,
  mihomoInstallLog: [],
  mihomoInstallDone: false,
  mihomoDownloadProgress: 0,

  // --- XMeow ---
  xmeowReleases: [],
  xmeowCurrentVersion: '',
  xmeowLoading: false,
  xmeowInstalling: false,
  xmeowInstallingVersion: null,
  xmeowInstallTarget: null,
  xmeowError: null,
  xmeowInstallLog: [],
  xmeowInstallDone: false,
  xmeowDownloadProgress: 0,

  // --- XKeen ---
  xkeenReleases: [],
  xkeenCurrentVersion: '',
  xkeenLoading: false,
  xkeenError: null,

  // --- Update indicators ---
  mihomoHasUpdate: false,
  xkeenHasUpdate: false,

  // --- Mihomo actions ---
  fetchMihomoReleases: async () => {
    set({ mihomoLoading: true, mihomoError: null })
    try {
      // Try Go backend first (cached, normalized)
      const data = await fetchMihomoReleases()
      set({
        mihomoReleases: data.releases,
        mihomoCurrentVersion: data.current_version,
        mihomoHasUpdate: data.releases.some((r) => r.is_newer),
      })
    } catch {
      // Fallback: fetch directly from GitHub API (no backend needed)
      try {
        const mihomoVer = useOverviewStore.getState().mihomoVersion
        const data = await fetchMihomoReleasesFromGitHub(mihomoVer)
        set({
          mihomoReleases: data.releases,
          mihomoCurrentVersion: data.current_version,
          mihomoHasUpdate: data.releases.some((r) => r.is_newer),
        })
      } catch (err) {
        set({ mihomoError: err instanceof Error ? err.message : 'Failed to fetch releases' })
      }
    } finally {
      set({ mihomoLoading: false })
    }
  },

  installMihomoVersion: async (version: string) => {
    set({
      mihomoInstalling: true,
      mihomoInstallingVersion: version,
      mihomoError: null,
      mihomoInstallLog: [],
      mihomoInstallDone: false,
      mihomoDownloadProgress: 0,
    })

    try {
      await apiInstallMihomo(version, (progress) => {
        if (progress.step === 'error') {
          set((s) => ({
            mihomoError: progress.message,
            mihomoInstallLog: [...s.mihomoInstallLog, progress.message],
          }))
          return
        }

        if (progress.step === 'done') {
          set((s) => ({
            mihomoInstallLog: [...s.mihomoInstallLog, progress.message],
            mihomoInstallDone: true,
          }))
          return
        }

        if (progress.step === 'download' && progress.progress !== undefined) {
          if (progress.progress === 0) {
            set((s) => ({
              mihomoDownloadProgress: 0,
              mihomoInstallLog: [...s.mihomoInstallLog, progress.message],
            }))
          } else {
            set({ mihomoDownloadProgress: progress.progress })
          }
          return
        }

        set((s) => ({
          mihomoInstallLog: [...s.mihomoInstallLog, progress.message],
        }))
      })

      if (get().mihomoInstallDone) {
        const data = await fetchMihomoReleases()
        set({
          mihomoReleases: data.releases,
          mihomoCurrentVersion: data.current_version,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка'
      set((s) => ({
        mihomoError: msg,
        mihomoInstallLog: [...s.mihomoInstallLog, `Ошибка: ${msg}`],
      }))
    } finally {
      set({ mihomoInstalling: false, mihomoInstallingVersion: null })
    }
  },

  resetMihomoInstallState: () => set({
    mihomoInstallLog: [],
    mihomoInstallDone: false,
    mihomoDownloadProgress: 0,
    mihomoError: null,
  }),

  // --- XMeow actions ---
  fetchXmeowReleases: async () => {
    set({ xmeowLoading: true, xmeowError: null })
    try {
      // Try Go backend first (cached, normalized)
      const data = await fetchXmeowReleases()
      set({
        xmeowReleases: data.releases,
        xmeowCurrentVersion: data.current_version,
      })
    } catch {
      // Fallback: fetch directly from GitHub API (no backend needed)
      try {
        const data = await fetchXmeowReleasesFromGitHub()
        set({
          xmeowReleases: data.releases,
          xmeowCurrentVersion: data.current_version,
        })
      } catch (err) {
        set({ xmeowError: err instanceof Error ? err.message : 'Failed to fetch releases' })
      }
    } finally {
      set({ xmeowLoading: false })
    }
  },

  installXmeowVersion: async (version: string, target: 'server' | 'dist') => {
    set({
      xmeowInstalling: true,
      xmeowInstallingVersion: version,
      xmeowInstallTarget: target,
      xmeowError: null,
      xmeowInstallLog: [],
      xmeowInstallDone: false,
      xmeowDownloadProgress: 0,
    })

    try {
      await apiInstallXmeow(version, target, (progress) => {
        if (progress.step === 'error') {
          set((s) => ({
            xmeowError: progress.message,
            xmeowInstallLog: [...s.xmeowInstallLog, progress.message],
          }))
          return
        }

        if (progress.step === 'done') {
          set((s) => ({
            xmeowInstallLog: [...s.xmeowInstallLog, progress.message],
            xmeowInstallDone: true,
          }))
          return
        }

        if (progress.step === 'download' && progress.progress !== undefined) {
          if (progress.progress === 0) {
            set((s) => ({
              xmeowDownloadProgress: 0,
              xmeowInstallLog: [...s.xmeowInstallLog, progress.message],
            }))
          } else {
            set({ xmeowDownloadProgress: progress.progress })
          }
          return
        }

        set((s) => ({
          xmeowInstallLog: [...s.xmeowInstallLog, progress.message],
        }))
      })

      if (get().xmeowInstallDone) {
        const data = await fetchXmeowReleases()
        set({
          xmeowReleases: data.releases,
          xmeowCurrentVersion: data.current_version,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка'
      set((s) => ({
        xmeowError: msg,
        xmeowInstallLog: [...s.xmeowInstallLog, `Ошибка: ${msg}`],
      }))
    } finally {
      set({ xmeowInstalling: false, xmeowInstallingVersion: null, xmeowInstallTarget: null })
    }
  },

  resetXmeowInstallState: () => set({
    xmeowInstallLog: [],
    xmeowInstallDone: false,
    xmeowDownloadProgress: 0,
    xmeowError: null,
  }),

  // --- XKeen actions ---
  fetchXkeenReleases: async () => {
    set({ xkeenLoading: true, xkeenError: null })
    try {
      // Try Go backend first (cached, normalized)
      const data = await fetchXkeenReleases()
      set({
        xkeenReleases: data.releases,
        xkeenCurrentVersion: data.current_version,
        xkeenHasUpdate: data.releases.some((r) => r.is_newer),
      })
    } catch {
      // Fallback: fetch directly from GitHub API (no backend needed)
      try {
        const xkeenVer = useOverviewStore.getState().xkeenVersion
        const data = await fetchXkeenReleasesFromGitHub(xkeenVer)
        set({
          xkeenReleases: data.releases,
          xkeenCurrentVersion: data.current_version,
          xkeenHasUpdate: data.releases.some((r) => r.is_newer),
        })
      } catch (err) {
        set({ xkeenError: err instanceof Error ? err.message : 'Failed to fetch xkeen releases' })
      }
    } finally {
      set({ xkeenLoading: false })
    }
  },

  setMihomoHasUpdate: (v: boolean) => set({ mihomoHasUpdate: v }),
  setXkeenHasUpdate: (v: boolean) => set({ xkeenHasUpdate: v }),

  clearErrors: () => set({ mihomoError: null, xmeowError: null, xkeenError: null }),
}))
