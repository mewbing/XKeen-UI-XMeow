/**
 * Zustand store for web terminal connection state and UI preferences.
 *
 * Volatile (NOT persisted) -- connection state should not survive page reloads.
 * UI preferences (fontSize, isFullscreen) are preserved across reset() calls
 * but not across page reloads (intentional -- terminal is transient).
 */

import { create } from 'zustand'

interface TerminalState {
  // UI state
  isOpen: boolean
  isFullscreen: boolean
  fontSize: number
  isSearchOpen: boolean

  // Connection state
  isConnected: boolean
  isConnecting: boolean
  sessionAlive: boolean
  sessionType: 'ssh' | 'exec' | null
  error: string | null

  // Exec from UI (e.g. XKeenTab "Обновить в терминале")
  pendingExec: string | null

  // Actions
  setOpen: (v: boolean) => void
  toggleOpen: () => void
  setFullscreen: (v: boolean) => void
  setFontSize: (v: number) => void
  setSearchOpen: (v: boolean) => void
  setConnected: (v: boolean) => void
  setConnecting: (v: boolean) => void
  setSessionAlive: (v: boolean) => void
  setError: (v: string | null) => void
  setSessionType: (v: 'ssh' | 'exec' | null) => void
  setPendingExec: (v: string | null) => void
  reset: () => void
}

const defaultState = {
  isOpen: false,
  isFullscreen: false,
  fontSize: 14,
  isSearchOpen: false,
  isConnected: false,
  isConnecting: false,
  sessionAlive: false,
  sessionType: null as 'ssh' | 'exec' | null,
  error: null as string | null,
  pendingExec: null as string | null,
}

export const useTerminalStore = create<TerminalState>()((set) => ({
  ...defaultState,

  setOpen: (v) => set({ isOpen: v }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setFullscreen: (v) => set({ isFullscreen: v }),
  setFontSize: (v) => set({ fontSize: v }),
  setSearchOpen: (v) => set({ isSearchOpen: v }),
  setConnected: (v) => set({ isConnected: v }),
  setConnecting: (v) => set({ isConnecting: v }),
  setSessionAlive: (v) => set({ sessionAlive: v }),
  setError: (v) => set({ error: v }),
  setSessionType: (v) => set({ sessionType: v }),
  setPendingExec: (v) => set({ pendingExec: v }),

  // Reset connection state but preserve UI preferences (fontSize, isFullscreen)
  reset: () =>
    set((state) => ({
      isConnected: false,
      isConnecting: false,
      sessionAlive: false,
      sessionType: null,
      error: null,
      isSearchOpen: false,
      pendingExec: null,
      // Preserve:
      isOpen: state.isOpen,
      isFullscreen: state.isFullscreen,
      fontSize: state.fontSize,
    })),
}))
