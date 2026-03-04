/**
 * Core terminal component.
 *
 * Manages xterm.js instance lifetime, addons (Fit, Search, WebLinks),
 * and WebSocket integration via useTerminalWs hook.
 *
 * The Terminal instance lives in refs -- NOT React state -- so it persists
 * across modal open/close cycles. The parent (TerminalModal) keeps this
 * component always mounted (hidden via CSS) to preserve the SSH session.
 */

import { useRef, useEffect, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '@/stores/terminal'
import { useTerminalWs } from '@/hooks/useTerminalWs'
import { toast } from 'sonner'

/* ------------------------------------------------------------------ */
/*  Antigravity terminal theme                                        */
/* ------------------------------------------------------------------ */

const TERMINAL_THEME = {
  background: '#1a1625',
  foreground: '#e8e4f0',
  cursor: '#a78bfa',
  cursorAccent: '#1a1625',
  selectionBackground: '#6d28d940',
  selectionForeground: '#e8e4f0',
  black: '#1a1625',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e8e4f0',
  brightBlack: '#4a4458',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde68a',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#ffffff',
}

/* ------------------------------------------------------------------ */
/*  API surface exposed to parent via onReady callback                */
/* ------------------------------------------------------------------ */

export interface TerminalApi {
  connect: (host: string, port: number, user: string, pass: string) => void
  disconnect: () => void
  clear: () => void
  searchNext: (q: string) => void
  searchPrev: (q: string) => void
  focus: () => void
}

interface TerminalViewProps {
  onReady: (api: TerminalApi) => void
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function TerminalView({ onReady }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const searchRef = useRef<SearchAddon | null>(null)
  const initializedRef = useRef(false)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  // WS integration -- always enabled; SSH connects on user action
  const { connect: wsConnect, sendInput, resize, disconnect: wsDisconnect } =
    useTerminalWs({
      enabled: true,
      onData: (data) => termRef.current?.write(data),
      onConnected: (reused) => {
        useTerminalStore.getState().setConnected(true)
        useTerminalStore.getState().setConnecting(false)
        useTerminalStore.getState().setSessionAlive(true)
        if (reused) toast.info('Восстановлено подключение к существующей сессии')
      },
      onDisconnected: (reason) => {
        useTerminalStore.getState().setConnected(false)
        useTerminalStore.getState().setSessionAlive(false)
        termRef.current?.writeln(`\r\n\x1b[91mОтключено: ${reason}\x1b[0m`)
      },
      onError: (message) => {
        useTerminalStore.getState().setConnecting(false)
        useTerminalStore.getState().setError(message)
        termRef.current?.writeln(`\r\n\x1b[91mОшибка: ${message}\x1b[0m`)
        toast.error(message)
      },
    })

  // Stable refs for the WS functions (avoid stale closures)
  const wsConnectRef = useRef(wsConnect)
  wsConnectRef.current = wsConnect
  const sendInputRef = useRef(sendInput)
  sendInputRef.current = sendInput
  const resizeRef = useRef(resize)
  resizeRef.current = resize
  const wsDisconnectRef = useRef(wsDisconnect)
  wsDisconnectRef.current = wsDisconnect

  /* ---- Initialize xterm.js (runs once) ---- */
  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return
    initializedRef.current = true

    const fontSize = useTerminalStore.getState().fontSize

    const term = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily:
        "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
      scrollback: 1000,
      theme: TERMINAL_THEME,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)

    termRef.current = term
    fitRef.current = fitAddon
    searchRef.current = searchAddon

    // Initial fit after a microtask (DOM needs to settle)
    requestAnimationFrame(() => {
      try {
        fitAddon.fit()
      } catch {
        // Container may not be visible yet
      }
    })

    // ResizeObserver for auto-fit
    const ro = new ResizeObserver(() => {
      try {
        fitAddon.fit()
        const { cols, rows } = term
        if (cols > 0 && rows > 0) {
          resizeRef.current(cols, rows)
        }
      } catch {
        // Ignore fit errors when hidden
      }
    })
    ro.observe(containerRef.current)
    resizeObserverRef.current = ro

    // Forward terminal input to WS
    term.onData((data) => sendInputRef.current(data))

    // Welcome message
    term.writeln('\x1b[90mXMeow Terminal\x1b[0m')
    term.writeln(
      '\x1b[90mНажмите Connect для подключения к роутеру\x1b[0m',
    )

    // Expose API to parent
    onReady({
      connect: (host, port, user, pass) => {
        const { cols, rows } = term
        wsConnectRef.current(host, port, user, pass, cols, rows)
      },
      disconnect: () => wsDisconnectRef.current(),
      clear: () => term.clear(),
      searchNext: (q) => searchAddon.findNext(q),
      searchPrev: (q) => searchAddon.findPrevious(q),
      focus: () => term.focus(),
    })

    return () => {
      ro.disconnect()
      term.dispose()
      termRef.current = null
      fitRef.current = null
      searchRef.current = null
      initializedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---- React to font size changes ---- */
  useEffect(() => {
    let prevFontSize = useTerminalStore.getState().fontSize
    return useTerminalStore.subscribe((state) => {
      if (state.fontSize !== prevFontSize) {
        prevFontSize = state.fontSize
        if (termRef.current) {
          termRef.current.options.fontSize = state.fontSize
          try {
            fitRef.current?.fit()
          } catch {
            // Ignore
          }
        }
      }
    })
  }, [])

  /* ---- Refit when modal opens (container becomes visible) ---- */
  const handleVisibilityFit = useCallback(() => {
    requestAnimationFrame(() => {
      try {
        fitRef.current?.fit()
      } catch {
        // Ignore
      }
    })
  }, [])

  useEffect(() => {
    let prevOpen = useTerminalStore.getState().isOpen
    return useTerminalStore.subscribe((state) => {
      if (state.isOpen !== prevOpen) {
        prevOpen = state.isOpen
        if (state.isOpen) handleVisibilityFit()
      }
    })
  }, [handleVisibilityFit])

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: TERMINAL_THEME.background }}
    />
  )
}
