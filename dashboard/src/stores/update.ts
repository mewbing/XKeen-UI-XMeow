import { create } from 'zustand'
import {
  checkUpdate,
  applyUpdate as apiApplyUpdate,
  applyDist as apiApplyDist,
  rollbackUpdate,
} from '@/lib/update-api'
import type { ReleaseInfo } from '@/lib/update-api'

interface UpdateState {
  releaseInfo: ReleaseInfo | null
  hasUpdate: boolean
  isExternalUI: boolean
  checking: boolean
  applying: boolean
  applyingDist: boolean
  error: string | null

  checkForUpdate: () => Promise<void>
  applyUpdate: () => Promise<void>
  applyDist: () => Promise<void>
  rollback: () => Promise<void>
  clearError: () => void
}

export const useUpdateStore = create<UpdateState>()((set) => ({
  releaseInfo: null,
  hasUpdate: false,
  isExternalUI: false,
  checking: false,
  applying: false,
  applyingDist: false,
  error: null,

  checkForUpdate: async () => {
    set({ checking: true, error: null })
    try {
      const info = await checkUpdate()
      set({
        releaseInfo: info,
        hasUpdate: info.has_update,
        isExternalUI: info.is_external_ui,
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Update check failed' })
    } finally {
      set({ checking: false })
    }
  },

  applyUpdate: async () => {
    set({ applying: true, error: null })
    try {
      await apiApplyUpdate()
      // Do NOT clear applying -- overlay will handle health poll and reload
    } catch (err) {
      set({
        applying: false,
        error: err instanceof Error ? err.message : 'Apply update failed',
      })
    }
  },

  applyDist: async () => {
    set({ applyingDist: true, error: null })
    try {
      await apiApplyDist()
      set({ applyingDist: false })
    } catch (err) {
      set({
        applyingDist: false,
        error: err instanceof Error ? err.message : 'Apply dist failed',
      })
    }
  },

  rollback: async () => {
    set({ error: null })
    try {
      await rollbackUpdate()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Rollback failed' })
    }
  },

  clearError: () => set({ error: null }),
}))
