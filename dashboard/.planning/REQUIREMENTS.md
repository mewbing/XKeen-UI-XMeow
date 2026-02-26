# Requirements: Mihomo Dashboard

**Defined:** 2026-02-27
**Core Value:** Users can visually edit mihomo configuration without manually editing YAML files

## v1 Requirements

### Scaffold & Setup

- [x] **SETUP-01**: SPA loads in browser and displays setup wizard on first launch
- [ ] **SETUP-02**: User can configure mihomo API address and Config API address
- [ ] **SETUP-03**: Setup wizard tests connections to both APIs and shows success/error
- [ ] **SETUP-04**: Config saved to localStorage, changeable in Settings page

### Config API Backend

- [ ] **API-01**: Backend serves config.yaml via GET/PUT endpoints
- [ ] **API-02**: Backend creates backup before overwriting config
- [ ] **API-03**: Backend serves xkeen files (ip_exclude, port_exclude, port_proxying)
- [ ] **API-04**: Backend validates YAML before saving
- [ ] **API-05**: Backend controls xkeen service (start/stop/restart)
- [ ] **API-06**: Backend reports service status and versions
- [ ] **API-07**: Backend lists and parses geodata files (.dat, .mmdb)

### Overview Page

- [ ] **OVER-01**: Dashboard shows uptime, traffic stats, active connections count, speed
- [ ] **OVER-02**: Service status badge (running/stopped) displayed
- [ ] **OVER-03**: User can start/stop/restart xkeen from dashboard
- [ ] **OVER-04**: User can check and install kernel updates
- [ ] **OVER-05**: mihomo version and dashboard version displayed

### Proxies Page

- [ ] **PROX-01**: Proxy-groups displayed as cards with current proxy selection
- [ ] **PROX-02**: User can switch active proxy within a group
- [ ] **PROX-03**: User can run latency test on individual proxies

### Connections Page

- [ ] **CONN-01**: Real-time table of active connections with source, destination, rule, proxy, speed
- [ ] **CONN-02**: User can search and filter connections
- [ ] **CONN-03**: User can close individual connections

### Logs Page

- [ ] **LOGS-01**: Real-time log stream via WebSocket
- [ ] **LOGS-02**: User can filter logs by level (info/warning/error)
- [ ] **LOGS-03**: User can search within logs
- [ ] **LOGS-04**: Auto-scroll toggle, clear, export functionality

### Config Editor

- [ ] **EDIT-01**: Monaco editor with YAML syntax highlighting for config.yaml
- [ ] **EDIT-02**: Tabs for switching between config, ip_exclude, port_exclude, port_proxying
- [ ] **EDIT-03**: YAML validation indicator ("YAML valid" / "Error at line X")
- [ ] **EDIT-04**: Live log panel below editor showing mihomo response on Apply
- [ ] **EDIT-05**: Apply, Save, Format buttons

### Rules Visual Editor

- [ ] **RULE-01**: Rules displayed as visual blocks (cards) grouped by service
- [ ] **RULE-02**: Each block shows title, rule count, target proxy-group
- [ ] **RULE-03**: Drag-and-drop to reorder blocks (change rule priority)
- [ ] **RULE-04**: Click block to expand and see individual rules inside
- [ ] **RULE-05**: Add/remove individual rules within a block
- [ ] **RULE-06**: Change target proxy-group for a block
- [ ] **RULE-07**: Create new rule block
- [ ] **RULE-08**: Changes saved back to config.yaml rules section

### Groups Editor

- [ ] **GRPS-01**: Proxy-groups displayed as draggable cards
- [ ] **GRPS-02**: Drag-and-drop to reorder groups
- [ ] **GRPS-03**: Reordering syncs both proxy-groups and GLOBAL.proxies in config
- [ ] **GRPS-04**: Click group to edit: name, type, icon, proxy list
- [ ] **GRPS-05**: Create new group, delete group

### Providers Page

- [ ] **PROV-01**: Rule-providers list with status, record count, last update
- [ ] **PROV-02**: Proxy-providers list with status
- [ ] **PROV-03**: Manual update button per provider
- [ ] **PROV-04**: Update all button

### Geodata Viewer

- [ ] **GEO-01**: List geodata files (.dat, .mmdb) from mihomo directory
- [ ] **GEO-02**: GeoSite viewer: browse categories with domain rules inside
- [ ] **GEO-03**: GeoIP viewer: browse country codes with IP ranges
- [ ] **GEO-04**: Search across all categories and entries
- [ ] **GEO-05**: Copy entry/category as mihomo rule format to clipboard
- [ ] **GEO-06**: Pagination for large datasets

### Self-Update

- [ ] **UPDT-01**: Dashboard checks for new version from GitHub releases
- [ ] **UPDT-02**: User can update dashboard + backend from within UI
- [ ] **UPDT-03**: Update downloads dist.zip, extracts, restarts backend

### UI/UX

- [ ] **UI-01**: Dark and light theme toggle
- [ ] **UI-02**: Russian language by default
- [ ] **UI-03**: Responsive layout (desktop primary, tablet acceptable)

## v2 Requirements

### Advanced Features

- **ADV-01**: Rule import from URL (paste provider URL, auto-create rule block)
- **ADV-02**: Config diff view (show changes before apply)
- **ADV-03**: Config history browser (view/restore from backups)
- **ADV-04**: Connection statistics graphs (traffic over time)
- **ADV-05**: Multi-language support (English)
- **ADV-06**: Geodata file download/update from within dashboard

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile native app | Web-first, responsive sufficient |
| Multi-user auth | Single-user scenario on home router |
| Database backend | Stateless design, config files are truth |
| Auto-rule generation | Manual config editing is the core value |
| Proxy server management | mihomo manages proxies, dashboard only switches |
| Config encryption | Home network, mihomo API secret sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 1 | Complete |
| SETUP-02 | Phase 1 | Pending |
| SETUP-03 | Phase 1 | Pending |
| SETUP-04 | Phase 1 | Pending |
| API-01 | Phase 1 | Pending |
| API-02 | Phase 1 | Pending |
| API-03 | Phase 1 | Pending |
| API-04 | Phase 1 | Pending |
| API-05 | Phase 2 | Pending |
| API-06 | Phase 2 | Pending |
| API-07 | Phase 9 | Pending |
| OVER-01 | Phase 2 | Pending |
| OVER-02 | Phase 2 | Pending |
| OVER-03 | Phase 2 | Pending |
| OVER-04 | Phase 2 | Pending |
| OVER-05 | Phase 2 | Pending |
| PROX-01 | Phase 3 | Pending |
| PROX-02 | Phase 3 | Pending |
| PROX-03 | Phase 3 | Pending |
| CONN-01 | Phase 4 | Pending |
| CONN-02 | Phase 4 | Pending |
| CONN-03 | Phase 4 | Pending |
| LOGS-01 | Phase 4 | Pending |
| LOGS-02 | Phase 4 | Pending |
| LOGS-03 | Phase 4 | Pending |
| LOGS-04 | Phase 4 | Pending |
| EDIT-01 | Phase 5 | Pending |
| EDIT-02 | Phase 5 | Pending |
| EDIT-03 | Phase 5 | Pending |
| EDIT-04 | Phase 5 | Pending |
| EDIT-05 | Phase 5 | Pending |
| RULE-01 | Phase 6 | Pending |
| RULE-02 | Phase 6 | Pending |
| RULE-03 | Phase 6 | Pending |
| RULE-04 | Phase 6 | Pending |
| RULE-05 | Phase 6 | Pending |
| RULE-06 | Phase 6 | Pending |
| RULE-07 | Phase 6 | Pending |
| RULE-08 | Phase 6 | Pending |
| GRPS-01 | Phase 7 | Pending |
| GRPS-02 | Phase 7 | Pending |
| GRPS-03 | Phase 7 | Pending |
| GRPS-04 | Phase 7 | Pending |
| GRPS-05 | Phase 7 | Pending |
| PROV-01 | Phase 8 | Pending |
| PROV-02 | Phase 8 | Pending |
| PROV-03 | Phase 8 | Pending |
| PROV-04 | Phase 8 | Pending |
| GEO-01 | Phase 9 | Pending |
| GEO-02 | Phase 9 | Pending |
| GEO-03 | Phase 9 | Pending |
| GEO-04 | Phase 9 | Pending |
| GEO-05 | Phase 9 | Pending |
| GEO-06 | Phase 9 | Pending |
| UPDT-01 | Phase 10 | Pending |
| UPDT-02 | Phase 10 | Pending |
| UPDT-03 | Phase 10 | Pending |
| UI-01 | Phase 11 | Pending |
| UI-02 | Phase 11 | Pending |
| UI-03 | Phase 11 | Pending |

**Coverage:**
- v1 requirements: 55 total
- Mapped to phases: 55
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after initial definition*
