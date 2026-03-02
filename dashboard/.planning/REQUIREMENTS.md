# Requirements: Mihomo Dashboard

**Defined:** 2026-02-27
**Core Value:** Users can visually edit mihomo configuration without manually editing YAML files

## v1.0 Requirements

### Scaffold & Setup

- [x] **SETUP-01**: SPA loads in browser and displays setup wizard on first launch
- [x] **SETUP-02**: User can configure mihomo API address and Config API address
- [x] **SETUP-03**: Setup wizard tests connections to both APIs and shows success/error
- [x] **SETUP-04**: Config saved to localStorage, changeable in Settings page

### Config API Backend

- [x] **API-01**: Backend serves config.yaml via GET/PUT endpoints
- [x] **API-02**: Backend creates backup before overwriting config
- [x] **API-03**: Backend serves xkeen files (ip_exclude, port_exclude, port_proxying)
- [x] **API-04**: Backend validates YAML before saving
- [x] **API-05**: Backend controls xkeen service (start/stop/restart)
- [x] **API-06**: Backend reports service status and versions
- [ ] **API-07**: Backend lists and parses geodata files (.dat, .mmdb)

### Overview Page

- [x] **OVER-01**: Dashboard shows uptime, traffic stats, active connections count, speed
- [x] **OVER-02**: Service status badge (running/stopped) displayed
- [x] **OVER-03**: User can start/stop/restart xkeen from dashboard
- [x] **OVER-04**: User can check and install kernel updates
- [x] **OVER-05**: mihomo version and dashboard version displayed

### Proxies Page

- [x] **PROX-01**: Proxy-groups displayed as cards with current proxy selection
- [x] **PROX-02**: User can switch active proxy within a group
- [x] **PROX-03**: User can run latency test on individual proxies

### Connections Page

- [x] **CONN-01**: Real-time table of active connections with source, destination, rule, proxy, speed
- [x] **CONN-02**: User can search and filter connections
- [x] **CONN-03**: User can close individual connections

### Logs Page

- [x] **LOGS-01**: Real-time log stream via WebSocket
- [x] **LOGS-02**: User can filter logs by level (info/warning/error)
- [x] **LOGS-03**: User can search within logs
- [x] **LOGS-04**: Auto-scroll toggle, clear, export functionality

### Config Editor

- [x] **EDIT-01**: Monaco editor with YAML syntax highlighting for config.yaml
- [x] **EDIT-02**: Tabs for switching between config, ip_exclude, port_exclude, port_proxying
- [x] **EDIT-03**: YAML validation indicator ("YAML valid" / "Error at line X")
- [x] **EDIT-04**: Live log panel below editor showing mihomo response on Apply
- [x] **EDIT-05**: Apply, Save, Format buttons

### Rules Visual Editor

- [x] **RULE-01**: Rules displayed as visual blocks (cards) grouped by service
- [x] **RULE-02**: Each block shows title, rule count, target proxy-group
- [x] **RULE-03**: Drag-and-drop to reorder blocks (change rule priority)
- [x] **RULE-04**: Click block to expand and see individual rules inside
- [x] **RULE-05**: Add/remove individual rules within a block
- [x] **RULE-06**: Change target proxy-group for a block
- [x] **RULE-07**: Create new rule block
- [x] **RULE-08**: Changes saved back to config.yaml rules section

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

### Self-Update (v1.0 — superseded by v2.0 milestone)

- [x] ~~**UPDT-01**: Dashboard checks for new version from GitHub releases~~ → SUPD-01
- [x] ~~**UPDT-02**: User can update dashboard + backend from within UI~~ → UPUI-03
- [x] ~~**UPDT-03**: Update downloads dist.zip, extracts, restarts backend~~ → SUPD-02, SUPD-03

### UI/UX

- [ ] **UI-01**: Dark and light theme toggle
- [ ] **UI-02**: Russian language by default
- [ ] **UI-03**: Responsive layout (desktop primary, tablet acceptable)

## v2.0 Milestone Requirements

Go backend rewrite + auto-update + installer. Replaces Python Flask with compiled Go binary.

### Go Backend

- [x] **GOBK-01**: Go binary serves all REST API endpoints identically to Flask backend (15 endpoints)
- [x] **GOBK-02**: Go binary streams logs via WebSocket with same protocol (initial/append/clear/ping)
- [x] **GOBK-03**: Go binary embeds SPA frontend via embed.FS (no separate static files directory)
- [x] **GOBK-04**: Go binary reverse-proxies mihomo API on :9090 with auth header injection
- [x] **GOBK-05**: Go binary validates YAML before saving config
- [x] **GOBK-06**: Go binary creates timestamped backups before config/xkeen writes
- [x] **GOBK-07**: Go binary supports CORS middleware for development mode
- [x] **GOBK-08**: Go binary reads config paths from environment variables with sensible defaults

### Installer

- [ ] **INST-01**: setup.sh installs from GitHub releases via `curl | sh` one-liner
- [ ] **INST-02**: setup.sh auto-detects router architecture (arm64/mipsle/mips)
- [ ] **INST-03**: setup.sh creates init.d service script (S99) for Entware
- [ ] **INST-04**: setup.sh supports interactive menu (install/update/uninstall)
- [ ] **INST-05**: setup.sh validates successful installation and starts service

### Self-Update Backend

- [ ] **SUPD-01**: Backend checks GitHub releases for newer version via API
- [ ] **SUPD-02**: Backend downloads and replaces own binary atomically with rollback backup
- [ ] **SUPD-03**: Backend restarts gracefully after self-update via init.d
- [ ] **SUPD-04**: Backend caches update check results (1h TTL to avoid GitHub rate limits)
- [ ] **SUPD-05**: Backend auto-detects deployment mode (embedded SPA vs external-ui) and selects update strategy
- [ ] **SUPD-06**: In external-ui mode: backend downloads and extracts dist.tar.gz into mihomo external-ui directory

### Update Frontend

- [ ] **UPUI-01**: Update page shows current vs latest version with comparison
- [ ] **UPUI-02**: Update page shows changelog from GitHub release notes (markdown)
- [ ] **UPUI-03**: User can trigger update from UI with progress overlay
- [ ] **UPUI-04**: Sidebar shows notification badge when update is available
- [ ] **UPUI-05**: Auto-check for updates on app load and periodically (every 6 hours)
- [ ] **UPUI-06**: UI shows separate version status for server and dashboard in external-ui mode

### CI/CD

- [ ] **CICD-01**: GitHub Actions cross-compiles Go for arm64, mipsle (softfloat), mips (softfloat), amd64, armv7 with UPX compression
- [ ] **CICD-02**: GitHub Actions builds frontend and embeds into Go binary
- [ ] **CICD-03**: GitHub Actions creates GitHub Release with 5 architecture-specific binaries + dist.tar.gz + checksums
- [ ] **CICD-04**: Version injected via Go ldflags (-X main.Version) at build time

## Future Requirements

### Deferred from v2.0

- **DFRD-01**: Beta/prerelease channel toggle in update settings
- **DFRD-02**: GitHub proxy fallback chain (gh-proxy.com, ghfast.top) for restricted networks
- **DFRD-03**: Download progress indicator during update
- ~~**DFRD-04**: UPX compression in CI for smaller binaries~~ → promoted to Phase 13 (CICD-01)

### Advanced Features (from v1.0)

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
| Auto-update without confirmation | Bricking risk on router; user must trigger manually |
| OTA delta patching (bsdiff) | Binary is 4-8MB, full download fast enough |
| Multi-version rollback UI | Over-engineering; one backup sufficient |
| Package manager (opkg) | Requires maintainer agreement; direct GitHub releases |
| ~~ARM32 (armv7) support~~ | ~~No Keenetic routers use armv7~~ — added to Phase 13 for broader compatibility |
| Docker/container | Entware routers don't run Docker |
| Config schema validation | mihomo config schema undocumented; YAML syntax only |

## Traceability

### v1.0 Phases (1-11)

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 1 | Complete |
| SETUP-02 | Phase 1 | Complete |
| SETUP-03 | Phase 1 | Complete |
| SETUP-04 | Phase 1 | Complete |
| API-01 | Phase 1 | Complete |
| API-02 | Phase 1 | Complete |
| API-03 | Phase 1 | Complete |
| API-04 | Phase 1 | Complete |
| API-05 | Phase 2 | Complete |
| API-06 | Phase 2 | Complete |
| API-07 | Phase 9 | Pending |
| OVER-01 | Phase 2 | Complete |
| OVER-02 | Phase 2 | Complete |
| OVER-03 | Phase 2 | Complete |
| OVER-04 | Phase 2 | Complete |
| OVER-05 | Phase 2 | Complete |
| PROX-01 | Phase 3 | Complete |
| PROX-02 | Phase 3 | Complete |
| PROX-03 | Phase 3 | Complete |
| CONN-01 | Phase 4 | Complete |
| CONN-02 | Phase 4 | Complete |
| CONN-03 | Phase 4 | Complete |
| LOGS-01 | Phase 4 | Complete |
| LOGS-02 | Phase 4 | Complete |
| LOGS-03 | Phase 4 | Complete |
| LOGS-04 | Phase 4 | Complete |
| EDIT-01 | Phase 5 | Complete |
| EDIT-02 | Phase 5 | Complete |
| EDIT-03 | Phase 5 | Complete |
| EDIT-04 | Phase 5 | Complete |
| EDIT-05 | Phase 5 | Complete |
| RULE-01 | Phase 6 | Complete |
| RULE-02 | Phase 6 | Complete |
| RULE-03 | Phase 6 | Complete |
| RULE-04 | Phase 6 | Complete |
| RULE-05 | Phase 6 | Complete |
| RULE-06 | Phase 6 | Complete |
| RULE-07 | Phase 6 | Complete |
| RULE-08 | Phase 6 | Complete |
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
| UPDT-01 | — | Superseded by SUPD-01 |
| UPDT-02 | — | Superseded by UPUI-03 |
| UPDT-03 | — | Superseded by SUPD-02/03 |
| UI-01 | Phase 11 | Pending |
| UI-02 | Phase 11 | Pending |
| UI-03 | Phase 11 | Pending |

### v2.0 Phases (12-16)

| Requirement | Phase | Status |
|-------------|-------|--------|
| GOBK-01 | Phase 12 | Complete |
| GOBK-02 | Phase 12 | Complete |
| GOBK-03 | Phase 12 | Complete |
| GOBK-04 | Phase 12 | Complete |
| GOBK-05 | Phase 12 | Complete |
| GOBK-06 | Phase 12 | Complete |
| GOBK-07 | Phase 12 | Complete |
| GOBK-08 | Phase 12 | Complete |
| CICD-01 | Phase 13 | Pending |
| CICD-02 | Phase 13 | Pending |
| CICD-03 | Phase 13 | Pending |
| CICD-04 | Phase 13 | Pending |
| INST-01 | Phase 14 | Pending |
| INST-02 | Phase 14 | Pending |
| INST-03 | Phase 14 | Pending |
| INST-04 | Phase 14 | Pending |
| INST-05 | Phase 14 | Pending |
| SUPD-01 | Phase 15 | Pending |
| SUPD-02 | Phase 15 | Pending |
| SUPD-03 | Phase 15 | Pending |
| SUPD-04 | Phase 15 | Pending |
| SUPD-05 | Phase 15 | Pending |
| SUPD-06 | Phase 15 | Pending |
| UPUI-01 | Phase 16 | Pending |
| UPUI-02 | Phase 16 | Pending |
| UPUI-03 | Phase 16 | Pending |
| UPUI-04 | Phase 16 | Pending |
| UPUI-05 | Phase 16 | Pending |
| UPUI-06 | Phase 16 | Pending |

**Coverage:**
- v1.0 requirements: 55 total (52 active + 3 superseded)
- v2.0 requirements: 29 total
- Mapped to phases: 81 (52 v1.0 + 29 v2.0)
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-03-03 — synced CICD-01/03 with Phase 13 discuss-phase decisions (5 architectures + UPX), promoted DFRD-04*
