import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings'
import { useTerminalStore } from '@/stores/terminal'
import { useBackendAvailable } from '@/hooks/useBackendAvailable'
import { AppSidebar } from './AppSidebar'
import { Header } from './Header'
import { TerminalModal } from '@/components/terminal/TerminalModal'

/** Auto-collapse sidebar to icon mode on narrow viewports */
function SidebarAutoCollapse() {
  const { setOpen, isMobile } = useSidebar()

  useEffect(() => {
    if (isMobile) return

    const mql = window.matchMedia('(max-width: 1023px)')
    const onChange = () => setOpen(!mql.matches)

    mql.addEventListener('change', onChange)
    if (mql.matches) setOpen(false)

    return () => mql.removeEventListener('change', onChange)
  }, [setOpen, isMobile])

  return null
}

export function AppLayout() {
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const { pathname } = useLocation()
  const backendAvailable = useBackendAvailable()

  // Global Ctrl+` keyboard shortcut for terminal toggle (only when backend is available)
  useEffect(() => {
    if (!backendAvailable) return
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault()
        useTerminalStore.getState().toggleOpen()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [backendAvailable])

  return (
    <SidebarProvider className="!h-svh !max-h-svh overflow-hidden">
      <SidebarAutoCollapse />
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <Header />
        <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden p-4">
          <div
            key={pathname}
            className={cn(
              'flex flex-1 flex-col min-w-0 min-h-0 overflow-y-auto',
              !reduceMotion && 'animate-in fade-in-0 slide-in-from-bottom-2 duration-200'
            )}
          >
            <Outlet />
          </div>
        </div>
      </SidebarInset>
      {backendAvailable && <TerminalModal />}
    </SidebarProvider>
  )
}
