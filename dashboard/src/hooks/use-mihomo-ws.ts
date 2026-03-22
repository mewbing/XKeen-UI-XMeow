/**
 * Generic WebSocket hook for mihomo streaming endpoints.
 *
 * Connects to mihomo WebSocket (traffic, memory, connections, logs)
 * with auto-reconnect on close/error. Uses useRef for the onMessage
 * callback to prevent stale closures and avoid re-creating the
 * WebSocket connection on every callback change.
 *
 * Context-aware: in remote mode, connects through the Go backend
 * HTTP reverse proxy (which supports WebSocket upgrade).
 */

import { useEffect, useRef, useCallback } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { useRemoteStore } from '@/stores/remote'

export function useMihomoWs<T>(
  path: string,
  onMessage: (data: T) => void,
  interval?: number,
  extraParams?: Record<string, string>
): void {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef(onMessage)

  // Keep onMessage ref fresh on every render to avoid stale closures
  onMessageRef.current = onMessage

  const mihomoApiUrl = useSettingsStore((s) => s.mihomoApiUrl)
  const configApiUrl = useSettingsStore((s) => s.configApiUrl)
  const mihomoSecret = useSettingsStore((s) => s.mihomoSecret)
  const activeAgentId = useRemoteStore((s) => s.activeAgentId)

  const connect = useCallback(() => {
    // Build context-aware base URL
    let baseUrl: string
    if (activeAgentId) {
      // Remote mode: direct to remote mihomo (port 9090) via SSH tunnel.
      // Remote router typically only runs xmeow-agent + mihomo (no xmeow-server on port 5000).
      baseUrl = `${configApiUrl}/api/remote/${activeAgentId}/mihomo`
    } else {
      baseUrl = mihomoApiUrl
    }
    if (!baseUrl) return

    // Convert http(s) URL to ws(s) URL
    const wsUrl = baseUrl.replace(/^http/, 'ws')
    const params = new URLSearchParams()
    // Always send token for master Go backend auth.
    // In remote mode, the Go proxy strips the token before forwarding to remote mihomo.
    if (mihomoSecret) params.set('token', mihomoSecret)
    if (interval !== undefined) params.set('interval', String(interval))
    if (extraParams) {
      for (const [key, value] of Object.entries(extraParams)) {
        params.set(key, value)
      }
    }
    const query = params.toString()
    const fullUrl = query ? `${wsUrl}${path}?${query}` : `${wsUrl}${path}`

    const ws = new WebSocket(fullUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as T
        onMessageRef.current(data)
      } catch {
        // Ignore JSON parse errors
      }
    }

    ws.onclose = () => {
      // Auto-reconnect after 3 seconds
      reconnectRef.current = setTimeout(() => connect(), 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [mihomoApiUrl, configApiUrl, mihomoSecret, activeAgentId, path, interval, extraParams])

  useEffect(() => {
    if (!mihomoApiUrl && !activeAgentId) return

    connect()

    return () => {
      // Clean up WebSocket and reconnect timer
      if (reconnectRef.current !== null) {
        clearTimeout(reconnectRef.current)
        reconnectRef.current = null
      }
      if (wsRef.current) {
        const ws = wsRef.current
        // Prevent onclose from triggering reconnect during cleanup
        ws.onclose = null
        ws.onerror = null
        // Only close if already open; if still CONNECTING, let it
        // open first then close (avoids browser "closed before established" warning)
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => ws.close()
        }
        wsRef.current = null
      }
    }
  }, [connect])
}
