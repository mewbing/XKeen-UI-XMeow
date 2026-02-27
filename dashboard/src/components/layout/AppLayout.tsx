import { Outlet } from 'react-router'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings'
import { AppSidebar } from './AppSidebar'
import { Header } from './Header'

export function AppLayout() {
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <div
            className={cn(
              'flex flex-1 flex-col min-w-0',
              !reduceMotion && 'animate-in fade-in-0 slide-in-from-bottom-2 duration-200'
            )}
          >
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
