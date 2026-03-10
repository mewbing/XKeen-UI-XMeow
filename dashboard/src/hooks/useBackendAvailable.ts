import { useSyncExternalStore } from 'react'
import { useSettingsStore } from '@/stores/settings'

// ── Singleton state (shared across all hook instances) ──────────────
let available = false
let failCount = 0
const listeners = new Set<() => void>()
let pollTimeout: ReturnType<typeof setTimeout> | null = null
let refCount = 0

function emit() {
  for (const fn of listeners) fn()
}

function scheduleNext(ms: number) {
  if (pollTimeout) clearTimeout(pollTimeout)
  pollTimeout = setTimeout(probe, ms)
}

/** Adaptive probe to /api/health */
async function probe() {
  const url = useSettingsStore.getState().configApiUrl
  if (!url) {
    if (available) { available = false; emit() }
    scheduleNext(60_000)
    return
  }
  try {
    const r = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(3000) })
    const next = r.ok
    if (next !== available) { available = next; emit() }
    failCount = 0
    // Server up → poll every 20s
    scheduleNext(20_000)
  } catch {
    if (available) { available = false; emit() }
    failCount++
    // First 3 failures → rapid retry every 5s (catches quick restarts)
    // After that → back off to 60s (minimize console noise)
    scheduleNext(failCount <= 3 ? 5_000 : 60_000)
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  refCount++
  if (refCount === 1) {
    probe()
  }
  return () => {
    listeners.delete(cb)
    refCount--
    if (refCount === 0 && pollTimeout) {
      clearTimeout(pollTimeout)
      pollTimeout = null
    }
  }
}

function getSnapshot() {
  return available
}

/** Returns true when xmeow-server backend is reachable */
export function useBackendAvailable(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot)
}
