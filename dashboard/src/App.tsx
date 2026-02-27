import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { useSettingsStore } from '@/stores/settings'
import { Toaster } from '@/components/ui/sonner'
import SetupWizard from '@/components/wizard/SetupWizard'
import OverviewPage from '@/pages/OverviewPage'
import ProxiesPage from '@/pages/ProxiesPage'
import ConnectionsLogsPage from '@/pages/ConnectionsLogsPage'
import ConfigEditorPage from '@/pages/ConfigEditorPage'
import RulesPage from '@/pages/RulesPage'
import GroupsPage from '@/pages/GroupsPage'
import ProvidersPage from '@/pages/ProvidersPage'
import GeodataPage from '@/pages/GeodataPage'
import UpdatesPage from '@/pages/UpdatesPage'

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
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
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

  // Sync reduce-motion class to <html> for global CSS override
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion)
  }, [reduceMotion])

  // Show nothing while hydrating to prevent flash
  if (!hydrated) {
    return null
  }

  // Wizard gate: if not configured, show Setup Wizard
  if (!isConfigured) {
    return <SetupWizard />
  }

  return (
    <BrowserRouter>
      <LocationTracker />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<StartPageRedirect />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="proxies" element={<ProxiesPage />} />
          <Route path="connections" element={<ConnectionsLogsPage />} />
          <Route path="logs" element={<ConnectionsLogsPage />} />
          <Route path="config-editor" element={<ConfigEditorPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="providers" element={<ProvidersPage />} />
          <Route path="geodata" element={<GeodataPage />} />
          <Route path="updates" element={<UpdatesPage />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
