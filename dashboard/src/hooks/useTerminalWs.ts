/**
 * WebSocket hook for terminal bridge (SSH + local exec).
 *
 * Connects to /ws/terminal on the Go backend.
 * Protocol: binary frames for terminal I/O, JSON text frames for control.
 * Auth via query parameter token=SECRET.
 * Auto-reconnects on disconnect (1s delay).
 * Ping/pong keepalive every 30s.
 * 150ms startup delay for React Strict Mode safety.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { useRemoteStore } from '@/stores/remote'

interface UseTerminalWsOptions {
  enabled: boolean
  onData: (data: Uint8Array) => void
  onConnected: (reused?: boolean, sessionType?: string) => void
  onDisconnected: (reason: string) => void
  onError: (message: string) => void
}

export interface UseTerminalWsReturn {
  wsConnected: boolean
  connect: (host: string, port: number, user: string, password: string, cols: number, rows: number) => void
  exec: (command: string, cols: number, rows: number) => void
  sendInput: (data: string | Uint8Array) => void
  resize: (cols: number, rows: number) => void
  disconnect: () => void
}

function getTerminalWsUrl(): string {
  const { configApiUrl, mihomoSecret } = useSettingsStore.getState()
  const activeAgentId = useRemoteStore.getState().activeAgentId

  let base: string
  if (activeAgentId && configApiUrl) {
    // Remote mode: SSH directly through tunnel/direct agent (no xmeow-server required).
    // Master resolves SSH target from agentID (tunnel port 22 or direct host:22).
    base = configApiUrl.replace(/^http/, 'ws') + `/ws/remote/${activeAgentId}/terminal`
  } else if (configApiUrl) {
    base = configApiUrl.replace(/^http/, 'ws') + '/ws/terminal'
  } else {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    base = `${proto}//${location.host}/ws/terminal`
  }
  if (mihomoSecret) {
    base += `?token=${encodeURIComponent(mihomoSecret)}`
  }
  return base
}

const encoder = new TextEncoder()

export function useTerminalWs({
  enabled,
  onData,
  onConnected,
  onDisconnected,
  onError,
}: UseTerminalWsOptions): UseTerminalWsReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  // Track active agent for reconnection on context switch
  const activeAgentId = useRemoteStore((s) => s.activeAgentId)

  // Store callbacks in refs to avoid triggering reconnect on re-render
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const onDataRef = useRef(onData)
  onDataRef.current = onData
  const onConnectedRef = useRef(onConnected)
  onConnectedRef.current = onConnected
  const onDisconnectedRef = useRef(onDisconnected)
  onDisconnectedRef.current = onDisconnected
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    if (!enabled) return

    let disposed = false

    function connectWs() {
      if (disposed) return

      const url = getTerminalWsUrl()
      const ws = new WebSocket(url)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = () => {
        if (disposed) {
          ws.close()
          return
        }
        console.log('[Terminal WS] Connected')
        setWsConnected(true)

        // Start ping/pong keepalive every 30s
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)
      }

      ws.onmessage = (event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
          // Binary frame -- terminal output
          onDataRef.current(new Uint8Array(event.data))
        } else {
          // String -- JSON control message
          try {
            const msg = JSON.parse(event.data as string)
            switch (msg.type) {
              case 'connected':
                onConnectedRef.current(msg.reused, msg.session_type)
                break
              case 'disconnected':
                onDisconnectedRef.current(msg.reason || 'server')
                break
              case 'error':
                onErrorRef.current(msg.message)
                break
              case 'exec_sent':
                // Remote exec: command was typed into SSH session
                console.log('[Terminal WS] Exec sent:', msg.message)
                break
              case 'pong':
                // Keepalive response -- ignore
                break
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      ws.onclose = () => {
        setWsConnected(false)
        wsRef.current = null
        if (pingTimerRef.current) {
          clearInterval(pingTimerRef.current)
          pingTimerRef.current = null
        }
        // Only reconnect if not disposed and still enabled
        if (!disposed && enabledRef.current) {
          reconnectTimerRef.current = setTimeout(connectWs, 1000)
        }
      }

      ws.onerror = () => {
        // Silently close -- onclose will handle reconnect
        ws.close()
      }
    }

    // Delay connection start to survive React Strict Mode double-mount.
    // In Strict Mode: mount -> cleanup -> mount happens synchronously,
    // so the first cleanup cancels this timer before connectWs() runs.
    startTimerRef.current = setTimeout(connectWs, 150)

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
      setWsConnected(false)
    }
  }, [enabled, activeAgentId])

  const sendJson = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const connect = useCallback(
    (host: string, port: number, user: string, password: string, cols: number, rows: number) => {
      sendJson({ type: 'connect', host, port, user, password, cols, rows })
    },
    [sendJson],
  )

  const exec = useCallback(
    (command: string, cols: number, rows: number) => {
      sendJson({ type: 'exec', command, cols, rows })
    },
    [sendJson],
  )

  const sendInput = useCallback((data: string | Uint8Array) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (typeof data === 'string') {
        wsRef.current.send(encoder.encode(data))
      } else {
        wsRef.current.send(data)
      }
    }
  }, [])

  const resize = useCallback(
    (cols: number, rows: number) => sendJson({ type: 'resize', cols, rows }),
    [sendJson],
  )

  const disconnect = useCallback(
    () => sendJson({ type: 'disconnect' }),
    [sendJson],
  )

  return { wsConnected, connect, exec, sendInput, resize, disconnect }
}
