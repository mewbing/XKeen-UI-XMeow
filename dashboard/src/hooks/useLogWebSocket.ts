/**
 * WebSocket hook for real-time log streaming.
 *
 * Connects to /ws/logs on the Flask backend.
 * Auto-reconnects on disconnect (1s delay).
 * Ping/pong keepalive every 30s.
 * Supports: switchFile, reload, clearLog commands.
 *
 * Uses a 150ms startup delay to avoid React 18 Strict Mode
 * double-mount causing "closed before established" errors.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSettingsStore } from '@/stores/settings'

export interface WsLogLine {
  time: string | null
  level: string | null
  msg: string
}

interface UseLogWebSocketOptions {
  enabled: boolean
  onInitial: (lines: WsLogLine[]) => void
  onAppend: (lines: WsLogLine[]) => void
  onClear: () => void
}

interface UseLogWebSocketReturn {
  connected: boolean
  switchFile: (file: string) => void
  reload: () => void
  clearLog: () => void
}

function getWsUrl(): string {
  const base = useSettingsStore.getState().configApiUrl
  if (base) {
    return base.replace(/^http/, 'ws') + '/ws/logs'
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/ws/logs`
}

export function useLogWebSocket({
  enabled,
  onInitial,
  onAppend,
  onClear,
}: UseLogWebSocketOptions): UseLogWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [connected, setConnected] = useState(false)

  // Store callbacks in refs to avoid triggering reconnect
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const onInitialRef = useRef(onInitial)
  onInitialRef.current = onInitial
  const onAppendRef = useRef(onAppend)
  onAppendRef.current = onAppend
  const onClearRef = useRef(onClear)
  onClearRef.current = onClear

  useEffect(() => {
    if (!enabled) return

    let disposed = false

    function connect() {
      if (disposed) return

      const url = getWsUrl()
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (disposed) {
          ws.close()
          return
        }
        console.log('[WS] Connected')
        setConnected(true)

        // Start ping/pong keepalive every 30s
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'pong') return
          switch (data.type) {
            case 'initial':
              onInitialRef.current(data.lines || [])
              break
            case 'append':
              onAppendRef.current(data.lines || [])
              break
            case 'clear':
              onClearRef.current()
              break
          }
        } catch {
          // Ignore parse errors
        }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        if (pingTimerRef.current) {
          clearInterval(pingTimerRef.current)
          pingTimerRef.current = null
        }
        // Only reconnect if not disposed and still enabled
        if (!disposed && enabledRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 1000)
        }
      }

      ws.onerror = () => {
        // Silently close — onclose will handle reconnect
        ws.close()
      }
    }

    // Delay connection start to survive React Strict Mode double-mount.
    // In Strict Mode: mount→cleanup→mount happens synchronously,
    // so the first cleanup cancels this timer before connect() runs.
    startTimerRef.current = setTimeout(connect, 150)

    return () => {
      disposed = true
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current)
        startTimerRef.current = null
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current)
        pingTimerRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setConnected(false)
    }
  }, [enabled])

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const switchFile = useCallback(
    (file: string) => send({ type: 'switchFile', file }),
    [send],
  )

  const reload = useCallback(() => send({ type: 'reload' }), [send])

  const clearLog = useCallback(() => send({ type: 'clear' }), [send])

  return { connected, switchFile, reload, clearLog }
}
