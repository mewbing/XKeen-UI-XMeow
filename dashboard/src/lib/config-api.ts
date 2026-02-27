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
  return res.json()
}
