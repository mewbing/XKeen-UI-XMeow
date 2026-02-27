/**
 * Generic WebSocket hook for mihomo streaming endpoints.
 *
 * Connects to mihomo WebSocket (traffic, memory, connections, logs)
 * with auto-reconnect on close/error. Uses useRef for the onMessage
 * callback to prevent stale closures and avoid re-creating the
 * WebSocket connection on every callback change.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useSettingsStore } from '@/stores/settings'

export function useMihomoWs<T>(
  path: string,
  onMessage: (data: T) => void,
  interval?: number
): void {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef(onMessage)

  // Keep onMessage ref fresh on every render to avoid stale closures
  onMessageRef.current = onMessage

  const mihomoApiUrl = useSettingsStore((s) => s.mihomoApiUrl)
  const mihomoSecret = useSettingsStore((s) => s.mihomoSecret)

  const connect = useCallback(() => {
    // Convert http(s) URL to ws(s) URL
    const wsUrl = mihomoApiUrl.replace(/^http/, 'ws')
    const params = new URLSearchParams()
    if (mihomoSecret) params.set('token', mihomoSecret)
    if (interval !== undefined) params.set('interval', String(interval))
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
  }, [mihomoApiUrl, mihomoSecret, path, interval])

  useEffect(() => {
    if (!mihomoApiUrl) return

    connect()

    return () => {
      // Clean up WebSocket and reconnect timer
      if (reconnectRef.current !== null) {
        clearTimeout(reconnectRef.current)
        reconnectRef.current = null
      }
      if (wsRef.current) {
        // Prevent onclose from triggering reconnect during cleanup
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])
}
