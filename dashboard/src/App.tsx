import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { useSettingsStore } from '@/stores/settings'
import { useUpdateStore } from '@/stores/update'
import { useOverviewStore } from '@/stores/overview'
import { useResolvedTheme } from '@/hooks/use-theme'
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
import { fetchVersions } from '@/lib/config-api'
import { fetchMihomoVersion } from '@/lib/mihomo-api'
import { checkXkeenUpdateQuick } from '@/lib/releases-api'
import { useReleasesStore } from '@/stores/releases'

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

/**
 * Auto-detect mihomo API when served through external-ui.
 * If the SPA is loaded from mihomo (port 9090), we can infer the API URL
 * and skip the setup wizard entirely.
 *
 * Only auto-configures when mihomo responds without auth (200 OK).
 * If 401 (secret required), lets the SetupWizard handle it —
 * the wizard already tries default secrets and provides proper UX.
 */
function useAutoDetectMihomo() {
  const isConfigured = useSettingsStore((s) => s.isConfigured)
  const setConfigured = useSettingsStore((s) => s.setConfigured)

  useEffect(() => {
    if (isConfigured) return

    const { protocol, hostname, port } = window.location
    const mihomoUrl = port === '9090'
      ? `${protocol}//${hostname}:${port}`
      : `${protocol}//${hostname}:9090`

    // Check /configs (requires auth) instead of /version (always public).
    // Only auto-configure if mihomo responds 200 without a secret.
    // If 401 — secret is set, show wizard for manual entry.
    fetch(`${mihomoUrl}/configs`, { signal: AbortSignal.timeout(3000) })
      .then((res) => {
        if (res.ok) {
          setConfigured({
            type: 'local',
            mihomoUrl,
            mihomoSecret: '',
            configUrl: `${protocol}//${hostname}:5000`,
          })
        }
        // 401 or other — stay on wizard
      })
      .catch(() => {
        // mihomo not reachable — stay on wizard
      })
  }, [isConfigured, setConfigured])
}

function App() {
  const isConfigured = useSettingsStore((s) => s.isConfigured)
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const autoCheckUpdates = useSettingsStore((s) => s.autoCheckUpdates)
  const resolvedTheme = useResolvedTheme()
  const [hydrated, setHydrated] = useState(false)

  useAutoDetectMihomo()

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

  // Sync theme class to <html> for CSS variable switching
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  // Sync reduce-motion class to <html> for global CSS override
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion)
  }, [reduceMotion])

  // Auto-check for updates on load + every 6 hours
  useEffect(() => {
    if (!isConfigured || !autoCheckUpdates) return

    // Check on load
    useUpdateStore.getState().checkForUpdate()

    // Periodic check every 6 hours
    const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
    const id = setInterval(() => {
      if (useSettingsStore.getState().autoCheckUpdates) {
        useUpdateStore.getState().checkForUpdate()
      }
    }, CHECK_INTERVAL_MS)

    return () => clearInterval(id)
  }, [isConfigured, autoCheckUpdates])

  // Fetch component versions on startup
  useEffect(() => {
    if (!isConfigured) return

    const setVersions = useOverviewStore.getState().setVersions

    // Dashboard version known at build time — always available, even without backend
    setVersions({ dashboard: __APP_VERSION__ })

    // Fetch mihomo version, then fetch releases (sets mihomoHasUpdate via same path as dialog)
    fetchMihomoVersion()
      .then((data) => {
        setVersions({ mihomo: data.version })
        useReleasesStore.getState().fetchMihomoReleases()
      })
      .catch(() => {})

    // Fetch Go backend versions (xkeen, server)
    fetchVersions()
      .then((data) => setVersions({ server: data.server, xkeen: data.xkeen }))
      .catch(() => {})

    // Fetch xmeow releases for dashboard update indicator (same path as dialog)
    useReleasesStore.getState().fetchXmeowReleases()

    // Check for xkeen updates (Go backend only)
    checkXkeenUpdateQuick()
      .then((has) => useReleasesStore.getState().setXkeenHasUpdate(has))
      .catch(() => {})
  }, [isConfigured])

  // Show nothing while hydrating to prevent flash
  if (!hydrated) {
    return null
  }

  // Wizard gate: if not configured and auto-detect hasn't kicked in, show Setup Wizard
  if (!isConfigured) {
    return <SetupWizard />
  }

  return (
    <HashRouter>
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
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </HashRouter>
  )
}

export default App
