/**
 * Update API client for XMeow backend (Go).
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

/** Release info returned by GET /api/update/check. */
export interface ReleaseInfo {
  current_version: string
  latest_version: string
  has_update: boolean
  release_notes: string
  published_at: string
  asset_name: string
  asset_size: number
  dist_size: number
  is_prerelease: boolean
  is_external_ui: boolean
}

/**
 * Check for available updates.
 * Returns release info with version comparison (cached server-side for 1 hour).
 */
export async function checkUpdate(): Promise<ReleaseInfo> {
  const res = await fetch(`${getBaseUrl()}/api/update/check`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Update check failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Apply the latest update (downloads binary, verifies, replaces, restarts).
 * Server responds with {status, message} then restarts after ~1s.
 */
export async function applyUpdate(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${getBaseUrl()}/api/update/apply`, {
    method: 'POST',
    headers: authHeaders(),
    signal: AbortSignal.timeout(300000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Apply update failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Apply dashboard dist update (external-ui mode only).
 * Downloads dist.tar.gz and extracts into external-ui directory.
 */
export async function applyDist(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${getBaseUrl()}/api/update/apply-dist`, {
    method: 'POST',
    headers: authHeaders(),
    signal: AbortSignal.timeout(300000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Apply dist failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Rollback to the previous version from .bak backup.
 * Server responds with {status, message} then restarts after ~1s.
 */
export async function rollbackUpdate(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${getBaseUrl()}/api/update/rollback`, {
    method: 'POST',
    headers: authHeaders(),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Rollback failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Check backend health (used for post-restart polling).
 * Returns true if healthy, false otherwise (never throws).
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/health`, {
      signal: AbortSignal.timeout(2000),
    })
    return res.ok
  } catch {
    return false
  }
}
