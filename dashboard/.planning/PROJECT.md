# Mihomo Dashboard

## What This Is

Full-featured SPA dashboard for mihomo proxy on Keenetic router, replacing zashboard. Combines real-time monitoring (proxies, connections, logs) with visual config editing (drag-and-drop rules/groups), geodata browser, raw YAML editor, service management, and self-update. Runs as React SPA in browser + compiled Go backend on router (single binary, no runtime dependencies).

## Core Value

Users can visually edit mihomo configuration (reorder rules, manage proxy-groups, browse geodata) without manually editing YAML files, while retaining full monitoring and service control.

## Requirements

### Validated

- ✓ Project scaffold + Config API + setup wizard — Phase 1
- ✓ Overview page with service management — Phase 2
- ✓ Proxies page (switch proxies, latency testing) — Phase 3
- ✓ Connections page (real-time table, search) — Phase 4
- ✓ Logs page (WebSocket stream, filter, search) — Phase 4
- ✓ Config raw editor with Monaco + live log — Phase 5
- ✓ Rules visual editor with drag-and-drop — Phase 6

### Active (v1.0 — remaining)

- [ ] Groups editor with drag-and-drop + GLOBAL sync
- [ ] Providers page (rule-providers + proxy-providers status, update)
- [ ] Geodata Viewer (browse GeoSite/GeoIP files, search, copy as rule format)
- [ ] Dark + light theme, Russian language

### Active (v2.0 — Go Backend + Installer)

- [ ] Go backend replacing Python Flask (single binary, same API contract)
- [ ] setup.sh installer (install/update/uninstall, по образцу XKeen-UI)
- [ ] Self-update mechanism (check GitHub releases + download + restart)
- [ ] Frontend update UI (auto-check + UpdatesPage + sidebar badge)
- [ ] GitHub Actions CI (cross-compile arm64/mips32/mips32le + release)

### Out of Scope

- Mobile native app -- web-first, responsive is enough
- Multi-user auth -- single-user dashboard, mihomo API secret is sufficient
- Database -- stateless backend, config files are the source of truth
- Real-time config sync between multiple browsers -- single-user scenario
- Auto-generated rules from traffic analysis -- manual config editing only

## Context

- Keenetic router with Entware, running xkeen (mihomo wrapper)
- mihomo API already available on port 9090 (REST + WebSocket)
- Config files at /opt/etc/xkeen/ (config.yaml, ip_exclude.lst, port_exclude.lst, port_proxying.lst)
- Geodata files (.dat, .mmdb) in mihomo directory on router
- Existing dashboards (zashboard, metacubexd) lack config editing
- XKeen-UI has service management but no visual rule editor
- Config has ~1500+ lines YAML, 60+ rule-providers, complex proxy-group hierarchy
- ARM router with limited RAM/CPU -- SPA must offload all rendering to browser

## Constraints

- **Platform**: ARM Keenetic router with Entware (mipsel/aarch64), limited RAM (~256MB total)
- **Backend footprint**: Go binary must stay under 10MB, minimal RAM usage
- **Browser-only rendering**: All drag-and-drop, Monaco editor, geodata parsing UI runs in browser
- **Existing API**: Must work with mihomo REST API (port 9090) as-is, no mihomo modifications
- **Config format**: Must read/write mihomo YAML config format without breaking existing structure
- **Geodata format**: GeoSite/GeoIP use v2ray protobuf .dat format; MMDB uses MaxMind format

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React 18 + TypeScript | Type safety, ecosystem, team familiarity | -- Pending |
| Tailwind CSS | Utility-first, dark/light theme support, small bundle | -- Pending |
| Python Flask backend → Go | Flask was prototyping; Go for production (single binary, no deps) | ⚠️ Revisit |
| Go backend (v2.0) | Single binary, cross-compile arm64/mips, same API contract as Flask | — Pending |
| Monaco Editor for YAML | VS Code quality editing, syntax highlighting, validation | -- Pending |
| dnd-kit for drag-and-drop | Lightweight, accessible, React-native | -- Pending |
| SPA replaces zashboard | Full control over UI, no iframe limitations | -- Pending |
| Setup wizard (local/CDN) | User chooses backend location at first launch | -- Pending |
| Protobuf parsing on backend | .dat files are binary, must parse server-side, serve as JSON | -- Pending |

## Current Milestone: v2.0 Go Backend + Installer

**Goal:** Переписать Python Flask backend на Go (единый бинарник ~5-8MB), добавить setup.sh installer по образцу XKeen-UI, self-update из GitHub releases, и frontend UI обновлений.

**Target features:**
- Go backend с 1:1 API совместимостью с Flask server.py
- setup.sh с интерактивным меню (install/update/uninstall)
- Self-update через GitHub releases API
- Frontend: авто-проверка обновлений + страница управления
- GitHub Actions CI для cross-compilation

---
*Last updated: 2026-03-01 after milestone v2.0 definition*
