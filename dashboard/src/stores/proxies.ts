/**
 * Zustand store for proxies page state.
 *
 * Holds proxy data from GET /proxies, delay test cache with 15s TTL,
 * UI state for expanded groups and testing indicators.
 *
 * NOT persisted -- all data is volatile real-time state.
 */

import { create } from 'zustand'
import type { Proxy } from '@/lib/mihomo-api'
import { fetchProxies, selectProxy, fetchProxyDelay, fetchGroupDelay } from '@/lib/mihomo-api'
import { toast } from 'sonner'

const DELAY_CACHE_TTL = 15_000 // 15 seconds

interface DelayResult {
  delay: number      // ms, 0 = timeout
  testedAt: number   // Date.now()
}

interface ProxiesState {
  // Data
  proxyMap: Record<string, Proxy>
  groupNames: string[]
  delayCache: Record<string, DelayResult>

  // UI state
  expandedGroups: Set<string>
  loading: boolean
  testingGroups: Set<string>
  testingProxies: Set<string>

  // Actions
  fetchAllProxies: () => Promise<void>
  toggleExpand: (groupName: string) => void
  selectProxyInGroup: (groupName: string, proxyName: string) => Promise<void>
  testProxyDelay: (proxyName: string) => Promise<number>
  testGroupDelay: (groupName: string) => Promise<void>
  testAllGroups: () => Promise<void>
  isDelayCacheValid: (proxyName: string) => boolean
}

export const useProxiesStore = create<ProxiesState>()((set, get) => ({
  // Initialize empty
  proxyMap: {},
  groupNames: [],
  delayCache: {},

  expandedGroups: new Set<string>(),
  loading: false,
  testingGroups: new Set<string>(),
  testingProxies: new Set<string>(),

  fetchAllProxies: async () => {
    set({ loading: true })
    try {
      const data = await fetchProxies()
      const proxies = data.proxies

      // Extract groups: objects with `all` defined, exclude GLOBAL and hidden
      const groupNames = Object.values(proxies)
        .filter(
          (p) =>
            p.all !== undefined &&
            p.name !== 'GLOBAL' &&
            p.hidden !== true
        )
        .map((p) => p.name)
        .sort((a, b) => a.localeCompare(b))

      set({ proxyMap: proxies, groupNames, loading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch proxies'
      toast.error(message)
      set({ loading: false })
    }
  },

  toggleExpand: (groupName) => {
    const expanded = new Set(get().expandedGroups)
    if (expanded.has(groupName)) {
      expanded.delete(groupName)
    } else {
      expanded.add(groupName)
    }
    set({ expandedGroups: expanded })
  },

  selectProxyInGroup: async (groupName, proxyName) => {
    const prevNow = get().proxyMap[groupName]?.now

    // Optimistic update
    set((state) => ({
      proxyMap: {
        ...state.proxyMap,
        [groupName]: {
          ...state.proxyMap[groupName],
          now: proxyName,
        },
      },
    }))

    try {
      await selectProxy(groupName, proxyName)
      toast.success(`Switched to ${proxyName}`)
    } catch (error) {
      // Rollback on error
      set((state) => ({
        proxyMap: {
          ...state.proxyMap,
          [groupName]: {
            ...state.proxyMap[groupName],
            now: prevNow,
          },
        },
      }))
      const message = error instanceof Error ? error.message : 'Failed to switch proxy'
      toast.error(message)
    }
  },

  testProxyDelay: async (proxyName) => {
    // Check cache
    const cached = get().delayCache[proxyName]
    if (cached && Date.now() - cached.testedAt < DELAY_CACHE_TTL) {
      return cached.delay
    }

    // Add to testing set
    set((state) => ({
      testingProxies: new Set(state.testingProxies).add(proxyName),
    }))

    try {
      const result = await fetchProxyDelay(proxyName)
      const delay = result.delay

      // Update cache and remove from testing
      set((state) => {
        const testingProxies = new Set(state.testingProxies)
        testingProxies.delete(proxyName)
        return {
          delayCache: {
            ...state.delayCache,
            [proxyName]: { delay, testedAt: Date.now() },
          },
          testingProxies,
        }
      })

      return delay
    } catch {
      // On error: cache as timeout, remove from testing
      set((state) => {
        const testingProxies = new Set(state.testingProxies)
        testingProxies.delete(proxyName)
        return {
          delayCache: {
            ...state.delayCache,
            [proxyName]: { delay: 0, testedAt: Date.now() },
          },
          testingProxies,
        }
      })
      return 0
    }
  },

  testGroupDelay: async (groupName) => {
    // Add to testing set
    set((state) => ({
      testingGroups: new Set(state.testingGroups).add(groupName),
    }))

    try {
      const delays = await fetchGroupDelay(groupName)

      // Update cache for each proxy in results
      set((state) => {
        const testingGroups = new Set(state.testingGroups)
        testingGroups.delete(groupName)
        const newCache = { ...state.delayCache }
        const now = Date.now()
        for (const [name, delay] of Object.entries(delays)) {
          newCache[name] = { delay, testedAt: now }
        }
        return { delayCache: newCache, testingGroups }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Group delay test failed'
      toast.error(message)

      // Remove from testing set
      set((state) => {
        const testingGroups = new Set(state.testingGroups)
        testingGroups.delete(groupName)
        return { testingGroups }
      })
    }
  },

  testAllGroups: async () => {
    const { groupNames } = get()

    // Sequential to avoid overloading the router
    for (const groupName of groupNames) {
      await get().testGroupDelay(groupName)
    }

    toast.success('All groups tested')
  },

  isDelayCacheValid: (proxyName) => {
    const cached = get().delayCache[proxyName]
    if (!cached) return false
    return Date.now() - cached.testedAt < DELAY_CACHE_TTL
  },
}))
