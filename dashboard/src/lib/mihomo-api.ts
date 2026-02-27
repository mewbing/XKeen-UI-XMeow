/**
 * Mihomo REST API client.
 *
 * Uses useSettingsStore for URL and secret configuration.
 * All functions use AbortSignal.timeout for request timeouts.
 */

import { useSettingsStore } from '@/stores/settings'

function getHeaders(): Record<string, string> {
  const secret = useSettingsStore.getState().mihomoSecret
  const headers: Record<string, string> = {}
  if (secret) {
    headers['Authorization'] = `Bearer ${secret}`
  }
  return headers
}

function getBaseUrl(): string {
  return useSettingsStore.getState().mihomoApiUrl
}

/**
 * Fetch mihomo version info.
 */
export async function fetchMihomoVersion(): Promise<{
  version: string
  meta: boolean
}> {
  const res = await fetch(`${getBaseUrl()}/version`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  return res.json()
}

/**
 * Upgrade mihomo core binary.
 * Long operation -- 120s timeout.
 */
export async function upgradeCore(
  channel?: string
): Promise<{ status: string }> {
  const url = channel
    ? `${getBaseUrl()}/upgrade?channel=${channel}`
    : `${getBaseUrl()}/upgrade`
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Upgrade failed')
  }
  return res.json()
}

/**
 * Restart mihomo process.
 */
export async function restartMihomo(): Promise<void> {
  await fetch(`${getBaseUrl()}/restart`, {
    method: 'POST',
    headers: getHeaders(),
    signal: AbortSignal.timeout(10000),
  })
}

/**
 * Fetch current connections snapshot.
 * Used for active connections count on overview page.
 */
export async function fetchConnectionsSnapshot(): Promise<{
  downloadTotal: number
  uploadTotal: number
  connections: unknown[]
}> {
  const res = await fetch(`${getBaseUrl()}/connections`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  return res.json()
}
