/**
 * Config API client for XMeow backend (Go).
 *
 * All protected endpoints send Authorization: Bearer {secret}
 * using the mihomo secret stored in settings.
 */

import { useSettingsStore } from '@/stores/settings'

function getBaseUrl(): string {
  return useSettingsStore.getState().configApiUrl
}

function authHeaders(): Record<string, string> {
  const secret = useSettingsStore.getState().mihomoSecret
  if (secret) return { Authorization: `Bearer ${secret}` }
  return {}
}

export type ServiceAction = 'start' | 'stop' | 'restart'

/**
 * Execute a service action (start, stop, or restart xkeen).
 * Throws Error with server error message on failure.
 */
export async function serviceAction(action: ServiceAction): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/service/${action}`, {
    method: 'POST',
    headers: authHeaders(),
    signal: AbortSignal.timeout(65000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Failed to ${action} service`)
  }
}

/**
 * Fetch current service status (running state and PID).
 */
export async function fetchServiceStatus(): Promise<{
  running: boolean
  pid: number | null
}> {
  const res = await fetch(`${getBaseUrl()}/api/service/status`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    throw new Error(`Service status request failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Fetch xkeen and dashboard versions.
 */
export async function fetchVersions(): Promise<{
  server: string
  dashboard: string
  xkeen: string
  mihomo: string
}> {
  const res = await fetch(`${getBaseUrl()}/api/versions`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    throw new Error(`Versions request failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Fetch network info (external IP, geo, uptime).
 */
export interface NetworkInfo {
  ip: string | null
  info: {
    country?: string
    city?: string
    isp?: string
    query?: string
  } | null
  uptime: number | null
}

export async function fetchNetworkInfo(): Promise<NetworkInfo> {
  const res = await fetch(`${getBaseUrl()}/api/system/network`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    throw new Error(`Network info request failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Fetch proxy server addresses (name -> server:port) from mihomo config.
 */
export async function fetchProxyServers(): Promise<Record<string, string>> {
  const res = await fetch(`${getBaseUrl()}/api/proxies/servers`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    throw new Error(`Proxy servers request failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Fetch current CPU usage percentage.
 */
export async function fetchCpuUsage(): Promise<{ cpu: number }> {
  const res = await fetch(`${getBaseUrl()}/api/system/cpu`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    throw new Error(`CPU usage request failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Fetch system memory stats from /proc/meminfo via backend.
 */
export async function fetchSystemMemory(): Promise<{ total: number; available: number; used: number }> {
  const res = await fetch(`${getBaseUrl()}/api/system/memory`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    throw new Error(`System memory request failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Fetch mihomo config.yaml content from backend.
 */
export async function fetchConfig(): Promise<{ content: string }> {
  const res = await fetch(`${getBaseUrl()}/api/config`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    throw new Error(`Config fetch failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Save mihomo config.yaml content to backend.
 */
export async function saveConfig(content: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ content }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to save config')
  }
}

/**
 * Fetch xkeen file content (ip_exclude, port_exclude, port_proxying).
 */
export async function fetchXkeenFile(name: string): Promise<{ content: string }> {
  const res = await fetch(`${getBaseUrl()}/api/xkeen/${name}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    throw new Error(`Xkeen file fetch failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Save xkeen file content.
 */
export async function saveXkeenFile(name: string, content: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/xkeen/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ content }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Failed to save xkeen file: ${name}`)
  }
}

/**
 * Clear a log file via HTTP (fallback when WS is disconnected).
 */
export async function clearLogFile(name: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/logs/${name}/clear`, {
    method: 'POST',
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    throw new Error(`Failed to clear log: ${res.status}`)
  }
}

/**
 * Fetch parsed log lines via HTTP (same format as WS initial).
 */
export async function fetchParsedLog(name: string, lines = 500): Promise<{
  lines: Array<{ time: string | null; level: string | null; msg: string }>
  size: number
}> {
  const res = await fetch(`${getBaseUrl()}/api/logs/${name}/parsed?lines=${lines}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch log: ${res.status}`)
  }
  return res.json()
}
