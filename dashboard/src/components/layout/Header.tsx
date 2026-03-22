import { useState, useEffect } from 'react'
import { useLocation } from 'react-router'
import { Settings, SquareTerminal } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { ServiceControl } from '@/components/overview/ServiceControl'
import { SplitToggleButton } from '@/components/ui/split-toggle-button'
import { SettingsSheet } from '@/pages/SettingsPage'
import { useTerminalStore } from '@/stores/terminal'
import { useBackendAvailable } from '@/hooks/useBackendAvailable'
import { useRemoteStore } from '@/stores/remote'

const pageTitles: Record<string, string> = {
  '/overview': 'Обзор',
  '/proxies': 'Прокси',
  '/connections': 'Подключения',
  '/logs': 'Логи',
  '/config-editor': 'Редактор конфига',
  '/rules': 'Правила',
  '/groups': 'Группы',
  '/providers': 'Провайдеры',
  '/geodata': 'Геоданные',
}

export function Header() {
  const location = useLocation()
  const title = pageTitles[location.pathname] ?? 'Mihomo Dashboard'
  const [settingsOpen, setSettingsOpen] = useState(false)
  const backendAvailable = useBackendAvailable()
  const activeAgentId = useRemoteStore((s) => s.activeAgentId)
  const terminalAvailable = backendAvailable || activeAgentId !== null

  // Listen for 'open-settings' event from SetupGuide and other components
  useEffect(() => {
    const handler = () => setSettingsOpen(true)
    window.addEventListener('open-settings', handler)
    return () => window.removeEventListener('open-settings', handler)
  }, [])

  const isConnectionsOrLogs =
    location.pathname === '/connections' || location.pathname === '/logs'

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <h1 className="text-sm font-medium">{title}</h1>

      <div className="flex-1" />

      {/* Split toggle — only on connections/logs pages */}
      {isConnectionsOrLogs && <SplitToggleButton />}

      {backendAvailable && <ServiceControl />}

      {terminalAvailable && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => useTerminalStore.getState().setOpen(true)}
          title="Терминал (Ctrl+`)"
        >
          <SquareTerminal className="h-4 w-4" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setSettingsOpen(true)}
        title="Настройки"
      >
        <Settings className="h-4 w-4" />
      </Button>

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </header>
  )
}
