/**
 * Mihomo REST API client.
 *
 * Uses useSettingsStore for URL and secret configuration.
 * All functions use AbortSignal.timeout for request timeouts.
 */

import { useSettingsStore } from '@/stores/settings'

// --- Connection types ---

export interface ConnectionMetadata {
  network: string
  type: string
  sourceIP: string
  destinationIP: string
  sourcePort: string
  destinationPort: string
  host: string
  dnsMode: string
  processPath: string
  specialProxy: string
  specialRules: string
  remoteDestination: string
  dscp: number
  sniffHost: string
}

export interface Connection {
  id: string
  metadata: ConnectionMetadata
  upload: number
  download: number
  start: string
  chains: string[]
  rule: string
  rulePayload: string
}

export interface ConnectionsSnapshot {
  downloadTotal: number
  uploadTotal: number
  connections: Connection[]
}

// --- Proxy types ---

export interface ProxyHistory {
  time: string
  delay: number
}

export interface Proxy {
  name: string
  type: string
  now?: string
  all?: string[]
  history: ProxyHistory[]
  udp?: boolean
  xudp?: boolean
  icon?: string
  hidden?: boolean
  testUrl?: string
  fixed?: string
  extra?: Record<string, { history: ProxyHistory[] }>
}

// --- Proxy constants ---

const DEFAULT_TEST_URL = 'https://www.gstatic.com/generate_204'
const DEFAULT_TIMEOUT = 5000

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
    throw new Error(data.message || data.error || 'Upgrade failed')
  }
  return res.json()
}

/**
 * Upgrade external-ui via mihomo.
 * Mihomo downloads UI from external-ui-url in config.yaml and extracts to external-ui dir.
 */
export async function upgradeUI(): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/upgrade/ui`, {
    method: 'POST',
    headers: getHeaders(),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = 'Не удалось обновить UI'
    try {
      const data = JSON.parse(text)
      msg = data.message || data.error || msg
    } catch { /* ignore */ }
    throw new Error(msg)
  }
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
export async function fetchConnectionsSnapshot(): Promise<ConnectionsSnapshot> {
  const res = await fetch(`${getBaseUrl()}/connections`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  return res.json()
}

// --- Proxy API ---

/**
 * Fetch all proxies and groups.
 */
export async function fetchProxies(): Promise<{
  proxies: Record<string, Proxy>
}> {
  const res = await fetch(`${getBaseUrl()}/proxies`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  return res.json()
}

/**
 * Switch active proxy in a Selector group.
 * Throws on error (non-Selector group, proxy not found, etc.).
 */
export async function selectProxy(
  groupName: string,
  proxyName: string
): Promise<void> {
  const res = await fetch(
    `${getBaseUrl()}/proxies/${encodeURIComponent(groupName)}`,
    {
      method: 'PUT',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: proxyName }),
      signal: AbortSignal.timeout(5000),
    }
  )
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to select proxy')
  }
}

/**
 * Test delay for a single proxy.
 * Returns { delay: 0 } on 408 timeout.
 */
export async function fetchProxyDelay(
  proxyName: string,
  url: string = DEFAULT_TEST_URL,
  timeout: number = DEFAULT_TIMEOUT
): Promise<{ delay: number }> {
  const params = new URLSearchParams({ url, timeout: String(timeout) })
  const res = await fetch(
    `${getBaseUrl()}/proxies/${encodeURIComponent(proxyName)}/delay?${params}`,
    {
      headers: getHeaders(),
      signal: AbortSignal.timeout(timeout + 2000),
    }
  )
  if (!res.ok) {
    if (res.status === 408) return { delay: 0 }
    const data = await res.json()
    throw new Error(data.error || 'Delay test failed')
  }
  return res.json()
}

/**
 * Reload mihomo configuration from file.
 */
export async function reloadConfig(): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/configs?force=true`, {
    method: 'PUT',
    headers: {
      ...getHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: '' }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    throw new Error('Failed to reload config')
  }
}

/**
 * Flush fake-IP cache.
 */
export async function flushFakeIP(): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/cache/fakeip/flush`, {
    method: 'POST',
    headers: getHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    throw new Error('Failed to flush fake-IP cache')
  }
}

/**
 * Update GeoIP and GeoSite databases.
 */
export async function updateGeoData(): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/configs/geo`, {
    method: 'POST',
    headers: getHeaders(),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) {
    throw new Error('Failed to update geodata')
  }
}

/**
 * Close a single connection by ID.
 */
export async function closeConnection(id: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/connections/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok && res.status !== 204) {
    throw new Error('Failed to close connection')
  }
}

/**
 * Close all active connections.
 */
export async function closeAllConnections(): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/connections`, {
    method: 'DELETE',
    headers: getHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok && res.status !== 204) {
    throw new Error('Failed to close all connections')
  }
}

/**
 * Test delay for all proxies in a group.
 * Returns Record<proxyName, delayMs>.
 */
export async function fetchGroupDelay(
  groupName: string,
  url: string = DEFAULT_TEST_URL,
  timeout: number = DEFAULT_TIMEOUT
): Promise<Record<string, number>> {
  const params = new URLSearchParams({ url, timeout: String(timeout) })
  const res = await fetch(
    `${getBaseUrl()}/group/${encodeURIComponent(groupName)}/delay?${params}`,
    {
      headers: getHeaders(),
      signal: AbortSignal.timeout(timeout + 5000),
    }
  )
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Group delay test failed')
  }
  return res.json()
}
