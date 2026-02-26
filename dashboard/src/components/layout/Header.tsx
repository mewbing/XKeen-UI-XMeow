import { useLocation } from 'react-router'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

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

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <h1 className="text-sm font-medium">{title}</h1>
    </header>
  )
}
