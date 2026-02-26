import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/overview" replace />} />
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
