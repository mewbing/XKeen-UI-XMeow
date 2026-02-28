/**
 * Zustand store for config editor page state.
 *
 * Volatile (no persist) -- editor content loaded fresh each time.
 * Manages 4 tabs (config.yaml + 3 xkeen files), dirty tracking,
 * YAML validation, and apply-log streaming.
 */

import { create } from 'zustand'

export type TabId = 'config' | 'ip_exclude' | 'port_exclude' | 'port_proxying'

export interface ValidationResult {
  valid: boolean
  error?: { message: string; line: number; column: number }
}

export interface TabState {
  original: string        // Content from server (for dirty comparison and diff)
  current: string         // Current content in editor
  dirty: boolean          // original !== current
  language: 'yaml' | 'plaintext'
  validation: ValidationResult
  loading: boolean
}

export interface LogEntry {
  id: number
  time: string
  level: string
  message: string
}

interface ConfigEditorState {
  activeTab: TabId
  tabs: Record<TabId, TabState>
  logStreaming: boolean
  logEntries: LogEntry[]
  logNextId: number

  // Actions
  setActiveTab: (tab: TabId) => void
  setContent: (tab: TabId, content: string) => void
  setOriginal: (tab: TabId, content: string) => void
  setLoading: (tab: TabId, loading: boolean) => void
  markSaved: (tab: TabId) => void
  setValidation: (tab: TabId, result: ValidationResult) => void
  startLogStream: () => void
  stopLogStream: () => void
  addLogEntry: (entry: Omit<LogEntry, 'id'>) => void
  clearLogs: () => void
  hasDirtyTabs: () => boolean
}

const TAB_LANGUAGES: Record<TabId, 'yaml' | 'plaintext'> = {
  config: 'yaml',
  ip_exclude: 'plaintext',
  port_exclude: 'plaintext',
  port_proxying: 'plaintext',
}

function createEmptyTab(tabId: TabId): TabState {
  return {
    original: '',
    current: '',
    dirty: false,
    language: TAB_LANGUAGES[tabId],
    validation: { valid: true },
    loading: false,
  }
}

const LOG_BUFFER_MAX = 500

export const useConfigEditorStore = create<ConfigEditorState>()((set, get) => ({
  activeTab: 'config',
  tabs: {
    config: createEmptyTab('config'),
    ip_exclude: createEmptyTab('ip_exclude'),
    port_exclude: createEmptyTab('port_exclude'),
    port_proxying: createEmptyTab('port_proxying'),
  },
  logStreaming: false,
  logEntries: [],
  logNextId: 0,

  // Actions

  setActiveTab: (tab) => set({ activeTab: tab }),

  setContent: (tab, content) =>
    set((state) => ({
      tabs: {
        ...state.tabs,
        [tab]: {
          ...state.tabs[tab],
          current: content,
          dirty: content !== state.tabs[tab].original,
        },
      },
    })),

  setOriginal: (tab, content) =>
    set((state) => ({
      tabs: {
        ...state.tabs,
        [tab]: {
          ...state.tabs[tab],
          original: content,
          current: content,
          dirty: false,
        },
      },
    })),

  setLoading: (tab, loading) =>
    set((state) => ({
      tabs: {
        ...state.tabs,
        [tab]: {
          ...state.tabs[tab],
          loading,
        },
      },
    })),

  markSaved: (tab) =>
    set((state) => ({
      tabs: {
        ...state.tabs,
        [tab]: {
          ...state.tabs[tab],
          original: state.tabs[tab].current,
          dirty: false,
        },
      },
    })),

  setValidation: (tab, result) =>
    set((state) => ({
      tabs: {
        ...state.tabs,
        [tab]: {
          ...state.tabs[tab],
          validation: result,
        },
      },
    })),

  startLogStream: () => set({ logStreaming: true, logEntries: [], logNextId: 0 }),

  stopLogStream: () => set({ logStreaming: false }),

  addLogEntry: (entry) =>
    set((state) => {
      const newEntry: LogEntry = { ...entry, id: state.logNextId }
      const newEntries = [...state.logEntries, newEntry]

      return {
        logEntries: newEntries.length > LOG_BUFFER_MAX
          ? newEntries.slice(-LOG_BUFFER_MAX)
          : newEntries,
        logNextId: state.logNextId + 1,
      }
    }),

  clearLogs: () => set({ logEntries: [], logNextId: 0 }),

  hasDirtyTabs: () => {
    const { tabs } = get()
    return Object.values(tabs).some((tab) => tab.dirty)
  },
}))
