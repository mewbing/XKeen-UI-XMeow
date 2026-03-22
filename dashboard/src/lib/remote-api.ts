/**
 * Remote Management API client for /api/remote/* endpoints.
 *
 * Manages agent listing, token CRUD, and agent deletion.
 * Auth via Bearer token from settings store.
 */

import { useSettingsStore } from '@/stores/settings'

function getBaseUrl(): string {
  return useSettingsStore.getState().configApiUrl
}

function authHeaders(): Record<string, string> {
  const secret = useSettingsStore.getState().mihomoSecret
  return {
    'Content-Type': 'application/json',
    ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
  }
}

// --- Types ---

export interface AgentInfo {
  id: string
  name: string
  online: boolean
  type?: 'tunnel' | 'direct'
  arch: string
  mihomo_ver: string
  xkeen_ver?: string
  agent_ver?: string
  ip: string
  host?: string
  mihomo_port?: number
  server_port?: number
  has_server?: boolean
  uptime_sec: number
  last_heartbeat: string
  created_at: string
}

export interface AgentToken {
  id: string
  token: string
  name: string
  created_at: string
  last_seen: string
  revoked: boolean
}

// --- API functions ---

/**
 * Fetch all registered agents with online/offline status.
 */
export async function fetchAgents(): Promise<AgentInfo[]> {
  const res = await fetch(`${getBaseUrl()}/api/remote/agents`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Failed to fetch agents: ${res.status}`)
  }
  return res.json()
}

/**
 * Create a new agent token. The full token is visible ONCE in the response.
 */
export async function createToken(name: string): Promise<AgentToken> {
  const res = await fetch(`${getBaseUrl()}/api/remote/tokens`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Failed to create token: ${res.status}`)
  }
  return res.json()
}

/**
 * List all tokens (token value masked).
 */
export async function listTokens(): Promise<AgentToken[]> {
  const res = await fetch(`${getBaseUrl()}/api/remote/tokens`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Failed to list tokens: ${res.status}`)
  }
  return res.json()
}

/**
 * Revoke (delete) a token by ID.
 */
export async function revokeToken(id: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/remote/tokens/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Failed to revoke token: ${res.status}`)
  }
}

/**
 * Add a direct agent connection (primarily to mihomo external-controller).
 */
export async function addDirectAgent(data: {
  name: string
  host: string
  mihomo_port: number
  server_port?: number
  secret: string
}): Promise<AgentInfo> {
  const res = await fetch(`${getBaseUrl()}/api/remote/direct`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.error || `Failed to add direct agent: ${res.status}`)
  }
  return res.json()
}

/**
 * Delete an agent by ID.
 */
export async function deleteAgent(id: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/remote/agents/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Failed to delete agent: ${res.status}`)
  }
}
