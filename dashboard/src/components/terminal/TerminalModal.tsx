/**
 * Terminal modal wrapper.
 *
 * Custom overlay (NOT Radix Dialog) to prevent unmounting the terminal DOM.
 * This preserves the xterm.js instance and active SSH session across
 * modal open/close cycles.
 *
 * Structure:
 * - Backdrop overlay (click to close)
 * - Fixed panel with TerminalToolbar + TerminalView (always mounted, visibility toggled)
 * - TerminalConnectDialog (Radix Dialog, transient)
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { useTerminalStore } from '@/stores/terminal'
import { TerminalView, type TerminalApi } from './TerminalView'
import { TerminalToolbar } from './TerminalToolbar'
import { TerminalConnectDialog } from './TerminalConnectDialog'
import { cn } from '@/lib/utils'

export function TerminalModal() {
  const isOpen = useTerminalStore((s) => s.isOpen)
  const isFullscreen = useTerminalStore((s) => s.isFullscreen)
  const terminalApiRef = useRef<TerminalApi | null>(null)
  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  /* ---- API wiring from TerminalView ---- */
  const handleTerminalReady = useCallback((api: TerminalApi) => {
    terminalApiRef.current = api
  }, [])

  /* ---- Toolbar handlers ---- */
  const handleConnect = useCallback(() => {
    setConnectDialogOpen(true)
  }, [])

  const handleDisconnect = useCallback(() => {
    terminalApiRef.current?.disconnect()
  }, [])

  const handleClear = useCallback(() => {
    terminalApiRef.current?.clear()
  }, [])

  const handleSearchNext = useCallback((q: string) => {
    terminalApiRef.current?.searchNext(q)
  }, [])

  const handleSearchPrev = useCallback((q: string) => {
    terminalApiRef.current?.searchPrev(q)
  }, [])

  const handleFontIncrease = useCallback(() => {
    const cur = useTerminalStore.getState().fontSize
    if (cur < 24) useTerminalStore.getState().setFontSize(cur + 1)
  }, [])

  const handleFontDecrease = useCallback(() => {
    const cur = useTerminalStore.getState().fontSize
    if (cur > 10) useTerminalStore.getState().setFontSize(cur - 1)
  }, [])

  const handleFullscreenToggle = useCallback(() => {
    const cur = useTerminalStore.getState().isFullscreen
    useTerminalStore.getState().setFullscreen(!cur)
  }, [])

  /* ---- Connect dialog submit ---- */
  const handleSshConnect = useCallback(
    (host: string, port: number, user: string, password: string) => {
      useTerminalStore.getState().setConnecting(true)
      terminalApiRef.current?.connect(host, port, user, password)
    },
    [],
  )

  /* ---- Focus management ---- */
  useEffect(() => {
    if (isOpen) {
      // Focus terminal after a frame (let DOM settle)
      const id = requestAnimationFrame(() => {
        terminalApiRef.current?.focus()
      })
      return () => cancelAnimationFrame(id)
    }
  }, [isOpen])

  /* ---- Keyboard shortcuts on modal panel ---- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape: close modal (NOT disconnect SSH)
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        useTerminalStore.getState().setOpen(false)
        return
      }
      // Ctrl+F: toggle search
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        e.stopPropagation()
        const cur = useTerminalStore.getState().isSearchOpen
        useTerminalStore.getState().setSearchOpen(!cur)
      }
    },
    [],
  )

  return (
    <>
      {/* Backdrop overlay -- only visible when open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150"
          onClick={() => useTerminalStore.getState().setOpen(false)}
        />
      )}

      {/* Modal panel -- always mounted, hidden when not open */}
      <div
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'fixed z-50 flex flex-col rounded-lg border border-border/50 bg-background shadow-2xl transition-all duration-200 outline-none',
          isOpen
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-95 pointer-events-none',
          isFullscreen
            ? 'inset-2'
            : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-5xl h-[80vh]',
        )}
      >
        {/* Toolbar */}
        <TerminalToolbar
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onClear={handleClear}
          onSearchNext={handleSearchNext}
          onSearchPrev={handleSearchPrev}
          onFontIncrease={handleFontIncrease}
          onFontDecrease={handleFontDecrease}
          onFullscreenToggle={handleFullscreenToggle}
        />

        {/* Terminal view -- always mounted */}
        <div className="flex-1 min-h-0 p-1">
          <TerminalView onReady={handleTerminalReady} />
        </div>
      </div>

      {/* Connect dialog */}
      <TerminalConnectDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onConnect={handleSshConnect}
      />
    </>
  )
}
