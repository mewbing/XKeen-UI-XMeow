/**
 * Health check hook — проверяет доступность mihomo API и XMeow backend (Go).
 *
 * Использует существующие testMihomoConnection/testConfigApiConnection из lib/api.
 * Кеширует результат в sessionStorage на 30 секунд, чтобы не проверять
 * при каждом переходе между страницами.
 *
 * Cache stores null for unchecked fields so that a page requiring configApi
 * won't trust a cached "true" that was never actually verified.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { testMihomoConnection, testConfigApiConnection } from '@/lib/api'

const CACHE_KEY = 'health-check-cache'
const CACHE_TTL_MS = 30_000

interface CachedResult {
  mihomoOk: boolean | null
  configApiOk: boolean | null
  timestamp: number
}

interface UseHealthCheckOptions {
  requireMihomo?: boolean
  requireConfigApi?: boolean
}

interface UseHealthCheckResult {
  mihomoOk: boolean | null
  configApiOk: boolean | null
  loading: boolean
  retry: () => void
}

function getCached(): CachedResult | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached: CachedResult = JSON.parse(raw)
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY)
      return null
    }
    return cached
  } catch {
    return null
  }
}

function setCache(mihomoOk: boolean | null, configApiOk: boolean | null) {
  // Merge with existing cache to preserve results from other pages
  const existing = getCached()
  sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      mihomoOk: mihomoOk ?? existing?.mihomoOk ?? null,
      configApiOk: configApiOk ?? existing?.configApiOk ?? null,
      timestamp: Date.now(),
    }),
  )
}

export function useHealthCheck({
  requireMihomo = false,
  requireConfigApi = false,
}: UseHealthCheckOptions): UseHealthCheckResult {
  const [mihomoOk, setMihomoOk] = useState<boolean | null>(null)
  const [configApiOk, setConfigApiOk] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const hasRun = useRef(false)

  const runChecks = useCallback(async () => {
    setLoading(true)

    const mihomoUrl = useSettingsStore.getState().mihomoApiUrl
    const mihomoSecret = useSettingsStore.getState().mihomoSecret
    const configUrl = useSettingsStore.getState().configApiUrl

    let mOk: boolean | null = null
    let cOk: boolean | null = null

    if (requireMihomo) {
      const result = await testMihomoConnection(mihomoUrl, mihomoSecret || undefined)
      mOk = result.ok
      // 401 = wrong/missing secret → reset config to show SetupWizard
      if (result.status === 401) {
        useSettingsStore.getState().resetConfig()
        return
      }
    }

    if (requireConfigApi) {
      const result = await testConfigApiConnection(configUrl, mihomoSecret || undefined)
      cOk = result.ok
    }

    setMihomoOk(mOk)
    setConfigApiOk(cOk)
    setCache(mOk, cOk)
    setLoading(false)
  }, [requireMihomo, requireConfigApi])

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    // Check cache first
    const cached = getCached()
    if (cached) {
      // Only use cache if it has actual results for all required checks
      const mihomoFromCache = requireMihomo ? cached.mihomoOk : null
      const configFromCache = requireConfigApi ? cached.configApiOk : null

      const allOk =
        (!requireMihomo || mihomoFromCache === true) &&
        (!requireConfigApi || configFromCache === true)

      if (allOk) {
        setMihomoOk(mihomoFromCache)
        setConfigApiOk(configFromCache)
        setLoading(false)
        return
      }
    }

    runChecks()
  }, [requireMihomo, requireConfigApi, runChecks])

  const retry = useCallback(() => {
    sessionStorage.removeItem(CACHE_KEY)
    hasRun.current = false
    runChecks()
  }, [runChecks])

  return {
    mihomoOk,
    configApiOk,
    loading,
    retry,
  }
}

/** Convenience: returns true if all required checks passed */
export function isHealthy(result: UseHealthCheckResult): boolean {
  if (result.loading) return false
  if (result.mihomoOk === false) return false
  if (result.configApiOk === false) return false
  return true
}
