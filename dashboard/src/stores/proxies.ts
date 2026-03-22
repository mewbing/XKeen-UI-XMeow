/**
 * Zustand store for proxies page state.
 *
 * Holds proxy data from GET /proxies, delay test results,
 * UI state for expanded groups and testing indicators.
 *
 * NOT persisted -- all data is volatile real-time state.
 */

import { create } from 'zustand'
import type { Proxy } from '@/lib/mihomo-api'
import { fetchProxies, selectProxy, fetchProxyDelay, fetchGroupDelay } from '@/lib/mihomo-api'
import { toast } from 'sonner'


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

function loadExpandedGroups(): Set<string> {
  try {
    const saved = localStorage.getItem('expandedGroups')
    if (saved) return new Set(JSON.parse(saved))
  } catch { /* ignore */ }
  return new Set()
}

function saveExpandedGroups(groups: Set<string>) {
  localStorage.setItem('expandedGroups', JSON.stringify([...groups]))
}

export const useProxiesStore = create<ProxiesState>()((set, get) => ({
  // Initialize empty
  proxyMap: {},
  groupNames: [],
  delayCache: {},

  expandedGroups: loadExpandedGroups(),
  loading: false,
  testingGroups: new Set<string>(),
  testingProxies: new Set<string>(),

  fetchAllProxies: async () => {
    set({ loading: true })
    try {
      const data = await fetchProxies()
      const proxies = data.proxies
      if (!proxies) {
        set({ proxyMap: {}, groupNames: [], loading: false })
        return
      }

      // Extract groups in GLOBAL config order
      const globalOrder = proxies['GLOBAL']?.all ?? []
      const groupSet = new Set(
        Object.values(proxies)
          .filter(
            (p) =>
              p.all !== undefined &&
              p.name !== 'GLOBAL' &&
              p.hidden !== true
          )
          .map((p) => p.name)
      )
      const groupNames = globalOrder.filter((name) => groupSet.has(name))

      // Extract initial delays from proxy history
      const initialCache: Record<string, DelayResult> = {}
      const now = Date.now()
      for (const proxy of Object.values(proxies)) {
        if (proxy.history && proxy.history.length > 0) {
          const latest = proxy.history[proxy.history.length - 1]
          if (latest.delay > 0) {
            initialCache[proxy.name] = { delay: latest.delay, testedAt: now }
          }
        }
      }

      set({ proxyMap: proxies, groupNames, delayCache: initialCache, loading: false })
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
    saveExpandedGroups(expanded)
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
    // Always test fresh — no cache check

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
    const { groupNames, proxyMap } = get()

    // Collect all unique proxy names (non-group nodes)
    const uniqueProxies = new Set<string>()
    for (const groupName of groupNames) {
      const group = proxyMap[groupName]
      if (group?.all) {
        for (const name of group.all) {
          // Skip if it's a group itself (groups can contain other groups)
          if (!proxyMap[name]?.all) {
            uniqueProxies.add(name)
          }
        }
      }
    }

    // Mark all as testing
    set({ testingProxies: new Set(uniqueProxies) })

    // Test all proxies in parallel
    const newCache: Record<string, DelayResult> = { ...get().delayCache }
    const now = Date.now()

    await Promise.allSettled(
      [...uniqueProxies].map(async (proxyName) => {
        try {
          const result = await fetchProxyDelay(proxyName)
          newCache[proxyName] = { delay: result.delay, testedAt: now }
        } catch {
          newCache[proxyName] = { delay: 0, testedAt: now }
        }
      })
    )

    // Single batch update
    set({
      delayCache: newCache,
      testingProxies: new Set<string>(),
    })

    toast.success('All proxies tested')
  },

  isDelayCacheValid: (proxyName: string) => {
    const entry = get().delayCache[proxyName]
    if (!entry) return false
    return Date.now() - entry.testedAt < 15_000
  },
}))
