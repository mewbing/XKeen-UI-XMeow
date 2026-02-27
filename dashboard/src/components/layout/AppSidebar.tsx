import { NavLink, useLocation } from 'react-router'
import {
  Home,
  Globe,
  Link2,
  ScrollText,
  FileCode,
  Layers,
  Users,
  Database,
  Map,
  Download,
  Settings,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { useOverviewStore } from '@/stores/overview'
import type { LucideIcon } from 'lucide-react'

interface MenuItem {
  title: string
  icon: LucideIcon
  path: string
}

const mainMenuItems: MenuItem[] = [
  { title: 'Обзор', icon: Home, path: '/overview' },
  { title: 'Прокси', icon: Globe, path: '/proxies' },
  { title: 'Подключения', icon: Link2, path: '/connections' },
  { title: 'Логи', icon: ScrollText, path: '/logs' },
  { title: 'Редактор', icon: FileCode, path: '/config-editor' },
  { title: 'Правила', icon: Layers, path: '/rules' },
  { title: 'Группы', icon: Users, path: '/groups' },
  { title: 'Провайдеры', icon: Database, path: '/providers' },
  { title: 'Геоданные', icon: Map, path: '/geodata' },
  { title: 'Обновления', icon: Download, path: '/updates' },
]

const settingsItem: MenuItem = { title: 'Настройки', icon: Settings, path: '/settings' }

// --- Version line helper ---

function VersionLine({
  label,
  version,
  hasUpdate = false,
}: {
  label: string
  version: string
  hasUpdate?: boolean
}) {
  const displayVersion = version
    ? version.startsWith('v')
      ? version
      : `v${version}`
    : '--'

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="font-mono">{displayVersion}</span>
      {hasUpdate && (
        <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
      )}
    </div>
  )
}

export function AppSidebar() {
  const location = useLocation()
  const mihomoVersion = useOverviewStore((s) => s.mihomoVersion)
  const xkeenVersion = useOverviewStore((s) => s.xkeenVersion)
  const dashboardVersion = useOverviewStore((s) => s.dashboardVersion)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 items-center justify-center border-b">
        <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
          Mihomo
        </span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.path}
                    tooltip={item.title}
                  >
                    <NavLink to={item.path}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />

        {/* Version info -- hidden when sidebar collapsed */}
        <div className="px-3 py-2 space-y-1 group-data-[collapsible=icon]:hidden">
          <VersionLine label="mihomo" version={mihomoVersion} />
          <VersionLine label="xkeen" version={xkeenVersion} />
          <VersionLine label="Dashboard" version={dashboardVersion} />
        </div>

        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location.pathname === settingsItem.path}
              tooltip={settingsItem.title}
            >
              <NavLink to={settingsItem.path}>
                <settingsItem.icon />
                <span>{settingsItem.title}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarTrigger className="w-full" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
