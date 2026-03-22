import { useSyncExternalStore } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { useRemoteStore } from '@/stores/remote'

// ── Singleton state (shared across all hook instances) ──────────────
let available = false
let failCount = 0
const listeners = new Set<() => void>()
let pollTimeout: ReturnType<typeof setTimeout> | null = null
let refCount = 0
let currentAgentId: string | null = null
let unsubRemote: (() => void) | null = null

function emit() {
  for (const fn of listeners) fn()
}

function scheduleNext(ms: number) {
  if (pollTimeout) clearTimeout(pollTimeout)
  pollTimeout = setTimeout(probe, ms)
}

/**
 * Build the correct health URL based on current context.
 * Local mode: /api/health on local xmeow-server
 * Remote mode: /api/remote/{id}/proxy/api/health through tunnel to remote xmeow-server
 */
function getHealthUrl(): string | null {
  const { configApiUrl } = useSettingsStore.getState()
  if (!configApiUrl) return null

  const agentId = useRemoteStore.getState().activeAgentId
  if (agentId) {
    return `${configApiUrl}/api/remote/${agentId}/proxy/api/health`
  }
  return `${configApiUrl}/api/health`
}

/** Adaptive probe — context-aware (local or remote xmeow-server) */
async function probe() {
  const url = getHealthUrl()
  if (!url) {
    if (available) { available = false; emit() }
    scheduleNext(60_000)
    return
  }
  try {
    // Remote proxy routes are behind master's auth middleware — need Bearer token
    const headers: Record<string, string> = {}
    const agentId = useRemoteStore.getState().activeAgentId
    if (agentId) {
      const secret = useSettingsStore.getState().mihomoSecret
      if (secret) headers['Authorization'] = `Bearer ${secret}`
    }
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(3000) })
    const next = r.ok
    if (next !== available) { available = next; emit() }
    failCount = next ? 0 : failCount + 1
    // Server up → poll every 20s; 502/4xx → slow poll 60s
    scheduleNext(next ? 20_000 : 60_000)
  } catch {
    if (available) { available = false; emit() }
    failCount++
    // First 3 failures → rapid retry every 5s (catches quick restarts)
    // After that → back off to 60s (minimize console noise)
    scheduleNext(failCount <= 3 ? 5_000 : 60_000)
  }
}

/** Watch for context switches (activeAgentId changes) */
function startWatching() {
  if (unsubRemote) return
  currentAgentId = useRemoteStore.getState().activeAgentId
  unsubRemote = useRemoteStore.subscribe((state) => {
    if (state.activeAgentId !== currentAgentId) {
      currentAgentId = state.activeAgentId
      // Context changed: reset and re-probe immediately
      available = false
      failCount = 0
      emit()
      if (pollTimeout) clearTimeout(pollTimeout)
      probe()
    }
  })
}

function stopWatching() {
  if (unsubRemote) {
    unsubRemote()
    unsubRemote = null
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  refCount++
  if (refCount === 1) {
    startWatching()
    probe()
  }
  return () => {
    listeners.delete(cb)
    refCount--
    if (refCount === 0) {
      if (pollTimeout) {
        clearTimeout(pollTimeout)
        pollTimeout = null
      }
      stopWatching()
    }
  }
}

function getSnapshot() {
  return available
}

/**
 * Returns true when xmeow-server backend is reachable.
 * Context-aware: in remote mode checks remote xmeow-server via proxy tunnel.
 */
export function useBackendAvailable(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot)
}
