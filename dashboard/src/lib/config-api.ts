/**
 * Config API client for service management.
 *
 * Communicates with the Flask backend (server.py) for
 * xkeen service control and version reporting.
 */

import { useSettingsStore } from '@/stores/settings'

function getBaseUrl(): string {
  return useSettingsStore.getState().configApiUrl
}

export type ServiceAction = 'start' | 'stop' | 'restart'

/**
 * Execute a service action (start, stop, or restart xkeen).
 * Throws Error with server error message on failure.
 */
export async function serviceAction(action: ServiceAction): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/service/${action}`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
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
  xkeen: string
  dashboard: string
}> {
  const res = await fetch(`${getBaseUrl()}/api/versions`, {
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
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    throw new Error(`CPU usage request failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Fetch mihomo config.yaml content from backend.
 */
export async function fetchConfig(): Promise<{ content: string }> {
  const res = await fetch(`${getBaseUrl()}/api/config`, {
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Failed to save xkeen file: ${name}`)
  }
}
