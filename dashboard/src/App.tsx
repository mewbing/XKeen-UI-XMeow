import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { useSettingsStore } from '@/stores/settings'
import OverviewPage from '@/pages/OverviewPage'
import ProxiesPage from '@/pages/ProxiesPage'
import ConnectionsPage from '@/pages/ConnectionsPage'
import LogsPage from '@/pages/LogsPage'
import ConfigEditorPage from '@/pages/ConfigEditorPage'
import RulesPage from '@/pages/RulesPage'
import GroupsPage from '@/pages/GroupsPage'
import ProvidersPage from '@/pages/ProvidersPage'
import GeodataPage from '@/pages/GeodataPage'
import UpdatesPage from '@/pages/UpdatesPage'
import SettingsPage from '@/pages/SettingsPage'
import { Card, CardContent } from '@/components/ui/card'
import { Wand2 } from 'lucide-react'

/** Wizard placeholder -- replaced in Plan 04 */
function WizardPlaceholder() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-dashed">
        <CardContent className="flex flex-col items-center text-center gap-4 pt-2">
          <div className="rounded-xl bg-muted p-4">
            <Wand2 className="size-10 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">Мастер настройки</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Пошаговая настройка подключения к mihomo
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Plan 04
          </span>
        </CardContent>
      </Card>
    </div>
  )
}

/** Resolves start page path from settings store value */
function resolveStartPage(startPage: string, lastVisitedPage: string): string {
  if (startPage === 'overview') return '/overview'
  if (startPage === 'last-visited') return lastVisitedPage || '/overview'
  // Direct path like '/proxies', '/logs', etc.
  if (startPage.startsWith('/')) return startPage
  return '/overview'
}

/** Tracks current location in settings store */
function LocationTracker() {
  const location = useLocation()
  const setLastVisitedPage = useSettingsStore((s) => s.setLastVisitedPage)

  useEffect(() => {
    // Only track actual page paths, not root redirect
    if (location.pathname !== '/') {
      setLastVisitedPage(location.pathname)
    }
  }, [location.pathname, setLastVisitedPage])

  return null
}

/** Root redirect based on settings */
function StartPageRedirect() {
  const startPage = useSettingsStore((s) => s.startPage)
  const lastVisitedPage = useSettingsStore((s) => s.lastVisitedPage)
  const target = resolveStartPage(startPage, lastVisitedPage)

  return <Navigate to={target} replace />
}

function App() {
  const isConfigured = useSettingsStore((s) => s.isConfigured)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Wait for Zustand persist hydration to avoid wizard flash
    const unsub = useSettingsStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })
    // If already hydrated (e.g., sync storage), set immediately
    if (useSettingsStore.persist.hasHydrated()) {
      setHydrated(true)
    }
    return unsub
  }, [])

  // Show nothing while hydrating to prevent flash
  if (!hydrated) {
    return null
  }

  // Wizard gate: if not configured, show wizard placeholder
  if (!isConfigured) {
    return <WizardPlaceholder />
  }

  return (
    <BrowserRouter>
      <LocationTracker />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<StartPageRedirect />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="proxies" element={<ProxiesPage />} />
          <Route path="connections" element={<ConnectionsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="config-editor" element={<ConfigEditorPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="providers" element={<ProvidersPage />} />
          <Route path="geodata" element={<GeodataPage />} />
          <Route path="updates" element={<UpdatesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
