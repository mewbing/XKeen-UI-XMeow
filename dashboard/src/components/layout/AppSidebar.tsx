import { useState, useEffect } from 'react'
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
  Radio,
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
import { useReleasesStore } from '@/stores/releases'
import { useSettingsStore } from '@/stores/settings'
import { useRemoteStore } from '@/stores/remote'
import { useBackendAvailable } from '@/hooks/useBackendAvailable'
import { ContextSwitcher } from '@/components/remote/ContextSwitcher'
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
  { title: 'Удал. Управление', icon: Radio, path: '/remote' },
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
      className="flex items-center w-full py-0.5 rounded-sm hover:bg-accent/50 -mx-1 px-1 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono inline-flex items-center gap-1">
          {formatVersion(version)}
          {hasUpdate && (
            <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
          )}
        </span>
      </div>
    </button>
  )
}

export function AppSidebar() {
  const location = useLocation()
  const dashboardHasUpdateFromBackend = useUpdateStore((s) => s.hasUpdate)
  const dashboardHasUpdateFromReleases = useReleasesStore((s) => s.dashboardHasUpdate)
  const dashboardHasUpdate = dashboardHasUpdateFromBackend || dashboardHasUpdateFromReleases
  const mihomoHasUpdate = useReleasesStore((s) => s.mihomoHasUpdate)
  const xkeenHasUpdate = useReleasesStore((s) => s.xkeenHasUpdate)

  const mihomoVersion = useOverviewStore((s) => s.mihomoVersion)
  const xkeenVersion = useOverviewStore((s) => s.xkeenVersion)
  const dashboardVersion = useOverviewStore((s) => s.dashboardVersion)
  const backendAvailable = useBackendAvailable()
  const showRemotePage = useSettingsStore((s) => s.showRemotePage)
  const activeAgentId = useRemoteStore((s) => s.activeAgentId)
  const isRemote = activeAgentId !== null

  // Initialize remote store: fetch agents + connect WS when remote page is enabled
  const fetchAgents = useRemoteStore((s) => s.fetchAgents)
  const connectWs = useRemoteStore((s) => s.connectWs)
  const disconnectWs = useRemoteStore((s) => s.disconnectWs)

  useEffect(() => {
    if (!showRemotePage || !backendAvailable) return
    fetchAgents()
    connectWs()
    return () => disconnectWs()
  }, [showRemotePage, backendAvailable, fetchAgents, connectWs, disconnectWs])

  const [versionTab, setVersionTab] = useState<string | null>(null)

  const filteredMenuItems = mainMenuItems.filter(
    (item) => item.path !== '/remote' || showRemotePage
  )

  return (
    <Sidebar collapsible="icon" className={isRemote ? 'border-t-2 border-t-blue-500/50' : ''}>
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
              {filteredMenuItems.map((item) => (
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

        {/* Context switcher -- shown when remote page enabled */}
        {showRemotePage && (
          <div className="px-2 group-data-[collapsible=icon]:hidden">
            <ContextSwitcher />
          </div>
        )}

        {/* Version info -- hidden when sidebar collapsed */}
        <div className="px-3 py-2 space-y-1 group-data-[collapsible=icon]:hidden">
          <div className="space-y-0.5">
            {backendAvailable && (
              <VersionRow
                label="xkeen"
                version={xkeenVersion}
                hasUpdate={xkeenHasUpdate}
                onClick={() => setVersionTab('xkeen')}
              />
            )}
            <VersionRow
              label="mihomo"
              version={mihomoVersion}
              hasUpdate={mihomoHasUpdate}
              onClick={() => setVersionTab('mihomo')}
            />
            <VersionRow
              label="dashboard"
              version={dashboardVersion}
              hasUpdate={dashboardHasUpdate}
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
                {(dashboardHasUpdate || mihomoHasUpdate || xkeenHasUpdate) && (
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
                    <div className="flex items-center gap-1">
                      <span className="font-mono">{formatVersion(xkeenVersion)}</span>
                      {xkeenHasUpdate && <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />}
                    </div>
                  </button>
                )}
                <button
                  className="flex items-center justify-between w-full text-muted-foreground px-1 py-0.5 rounded hover:bg-accent/50"
                  onClick={() => setVersionTab('mihomo')}
                >
                  <span>mihomo</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono">{formatVersion(mihomoVersion)}</span>
                    {mihomoHasUpdate && <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />}
                  </div>
                </button>
                <button
                  className="flex items-center justify-between w-full text-muted-foreground px-1 py-0.5 rounded hover:bg-accent/50"
                  onClick={() => setVersionTab('dashboard')}
                >
                  <span>dashboard</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono">{formatVersion(dashboardVersion)}</span>
                    {dashboardHasUpdate && <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />}
                  </div>
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
