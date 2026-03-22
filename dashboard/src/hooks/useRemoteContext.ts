/**
 * Context-aware API base URL resolution.
 *
 * In local mode: direct URLs from settings store.
 * In remote mode: proxied through master backend SSH tunnel.
 */

import { useRemoteStore } from '@/stores/remote'
import { useSettingsStore } from '@/stores/settings'

/**
 * React hook returning context-aware API base URLs.
 * - Local mode: direct URLs from settings
 * - Remote mode: proxied through master backend SSH tunnel
 */
export function useApiBaseUrl(): { configApi: string; mihomoApi: string; isRemote: boolean } {
  const activeAgentId = useRemoteStore((s) => s.activeAgentId)
  const configApiUrl = useSettingsStore((s) => s.configApiUrl)
  const mihomoApiUrl = useSettingsStore((s) => s.mihomoApiUrl)

  if (!activeAgentId) {
    return { configApi: configApiUrl, mihomoApi: mihomoApiUrl, isRemote: false }
  }

  // Remote mode: proxy through master backend's SSH tunnel.
  // mihomo API goes directly to remote mihomo (port 9090) via SSH tunnel.
  // configApi goes through remote agent's Go backend (port 5000) — but may be unavailable
  // if remote only runs xmeow-agent (no xmeow-server).
  return {
    configApi: `${configApiUrl}/api/remote/${activeAgentId}/proxy`,
    mihomoApi: `${configApiUrl}/api/remote/${activeAgentId}/mihomo`,
    isRemote: true,
  }
}

/**
 * Non-hook version for use outside React components (in store actions, API clients, etc.)
 * Uses getState() instead of hooks.
 */
export function getContextBaseUrl(): { configApi: string; mihomoApi: string; isRemote: boolean } {
  const activeAgentId = useRemoteStore.getState().activeAgentId
  const configApiUrl = useSettingsStore.getState().configApiUrl
  const mihomoApiUrl = useSettingsStore.getState().mihomoApiUrl

  if (!activeAgentId) {
    return { configApi: configApiUrl, mihomoApi: mihomoApiUrl, isRemote: false }
  }

  // Remote mode: mihomo API directly to port 9090 via SSH tunnel
  return {
    configApi: `${configApiUrl}/api/remote/${activeAgentId}/proxy`,
    mihomoApi: `${configApiUrl}/api/remote/${activeAgentId}/mihomo`,
    isRemote: true,
  }
}
