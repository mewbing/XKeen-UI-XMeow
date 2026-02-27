/**
 * Custom hook that polls xkeen service status from Config API.
 *
 * Fetches immediately on mount, then polls at configurable interval.
 * Provides a `refresh()` function for manual re-fetch (e.g., after
 * triggering a service action with a small delay).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchServiceStatus } from '@/lib/config-api'

interface UseServiceStatusResult {
  running: boolean
  pid: number | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useServiceStatus(intervalMs: number = 5000): UseServiceStatusResult {
  const [running, setRunning] = useState(false)
  const [pid, setPid] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const data = await fetchServiceStatus()
      setRunning(data.running)
      setPid(data.pid)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
      // Keep last known running state on error
    } finally {
      setLoading(false)
    }
  }, [])

  // Manual refresh (useful after service action with a delay)
  const refresh = useCallback(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    // Fetch immediately on mount
    fetchStatus()

    // Then poll at interval
    intervalRef.current = setInterval(fetchStatus, intervalMs)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [fetchStatus, intervalMs])

  return { running, pid, loading, error, refresh }
}
