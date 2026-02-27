import { useState } from 'react'
import { useLocation } from 'react-router'
import { ArrowUpCircle } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { ServiceControl } from '@/components/overview/ServiceControl'
import { UpdateOverlay } from '@/components/overview/UpdateOverlay'
import { useOverviewStore } from '@/stores/overview'

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
  '/updates': 'Обновления',
  '/settings': 'Настройки',
}

export function Header() {
  const location = useLocation()
  const title = pageTitles[location.pathname] ?? 'Mihomo Dashboard'
  const [updateOverlayOpen, setUpdateOverlayOpen] = useState(false)
  const mihomoVersion = useOverviewStore((s) => s.mihomoVersion)

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <h1 className="text-sm font-medium">{title}</h1>

      <div className="flex-1" />

      {mihomoVersion && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setUpdateOverlayOpen(true)}
          title="Обновить ядро"
        >
          <ArrowUpCircle className="h-4 w-4" />
        </Button>
      )}

      <ServiceControl />

      <UpdateOverlay
        open={updateOverlayOpen}
        onClose={() => setUpdateOverlayOpen(false)}
      />
    </header>
  )
}
