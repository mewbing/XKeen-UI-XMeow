import { useState } from 'react'
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
  ArrowUpCircle,
  MessageCircleWarning,
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
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { VersionsDialog } from '@/components/versions/VersionsDialog'
import { useOverviewStore } from '@/stores/overview'
import { useUpdateStore } from '@/stores/update'
import { useBackendAvailable } from '@/hooks/useBackendAvailable'
import type { LucideIcon } from 'lucide-react'

/** URL для кнопки "Сообщить о проблеме" */
const BUG_REPORT_URL = 'https://github.com/mewbing/XKeen-UI-XMeow/issues'

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
]

function formatVersion(v: string): string {
  if (!v) return '--'
  return v.startsWith('v') ? v : `v${v}`
}

/** Clickable version row — opens dialog on click. */
function VersionRow({
  label,
  version,
  hasUpdate = false,
  onClick,
}: {
  label: string
  version: string
  hasUpdate?: boolean
  onClick: () => void
}) {
  return (
    <button
      className="flex items-center justify-between w-full py-0.5 rounded-sm hover:bg-accent/50 -mx-1 px-1 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">{formatVersion(version)}</span>
      </div>
      {hasUpdate && (
        <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
      )}
    </button>
  )
}

export function AppSidebar() {
  const location = useLocation()
  const hasUpdate = useUpdateStore((s) => s.hasUpdate)

  const mihomoVersion = useOverviewStore((s) => s.mihomoVersion)
  const xkeenVersion = useOverviewStore((s) => s.xkeenVersion)
  const dashboardVersion = useOverviewStore((s) => s.dashboardVersion)
  const backendAvailable = useBackendAvailable()

  const [versionTab, setVersionTab] = useState<string | null>(null)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 items-center justify-center border-b">
        <div className="flex items-baseline gap-1.5 group-data-[collapsible=icon]:hidden">
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            XMeow
          </span>
          <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest">ui</span>
        </div>
        <span className="text-lg font-bold bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent hidden group-data-[collapsible=icon]:block">X</span>
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
          <div className="space-y-0.5">
            {backendAvailable && (
              <VersionRow
                label="xkeen"
                version={xkeenVersion}
                onClick={() => setVersionTab('xkeen')}
              />
            )}
            <VersionRow
              label="mihomo"
              version={mihomoVersion}
              onClick={() => setVersionTab('mihomo')}
            />
            <VersionRow
              label="dashboard"
              version={dashboardVersion}
              hasUpdate={hasUpdate}
              onClick={() => setVersionTab('dashboard')}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-full text-[10px] text-muted-foreground hover:text-foreground gap-1"
            onClick={() => window.open(BUG_REPORT_URL, '_blank')}
          >
            <MessageCircleWarning className="size-3" />
            Сообщить о проблеме
          </Button>
        </div>

        {/* Collapsed mode: version indicator icon */}
        <div className="hidden group-data-[collapsible=icon]:flex justify-center py-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 relative"
                title="Версии и обновления"
              >
                <ArrowUpCircle className="h-4 w-4" />
                {hasUpdate && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" align="end" className="w-48 p-2">
              <div className="space-y-1 text-xs">
                {backendAvailable && (
                  <button
                    className="flex items-center justify-between w-full text-muted-foreground px-1 py-0.5 rounded hover:bg-accent/50"
                    onClick={() => setVersionTab('xkeen')}
                  >
                    <span>xkeen</span>
                    <span className="font-mono">{formatVersion(xkeenVersion)}</span>
                  </button>
                )}
                <button
                  className="flex items-center justify-between w-full text-muted-foreground px-1 py-0.5 rounded hover:bg-accent/50"
                  onClick={() => setVersionTab('mihomo')}
                >
                  <span>mihomo</span>
                  <span className="font-mono">{formatVersion(mihomoVersion)}</span>
                </button>
                <button
                  className="flex items-center justify-between w-full text-muted-foreground px-1 py-0.5 rounded hover:bg-accent/50"
                  onClick={() => setVersionTab('dashboard')}
                >
                  <span>dashboard</span>
                  <span className="font-mono">{formatVersion(dashboardVersion)}</span>
                  {hasUpdate && (
                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 ml-1" />
                  )}
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Unified version dialog */}
        <VersionsDialog
          open={versionTab !== null}
          defaultTab={versionTab || 'mihomo'}
          onClose={() => setVersionTab(null)}
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
