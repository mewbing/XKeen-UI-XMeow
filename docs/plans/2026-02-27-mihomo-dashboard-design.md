# Mihomo Dashboard - Design Document

**Date**: 2026-02-27
**Status**: Approved
**Project**: Custom web dashboard for mihomo proxy on Keenetic router

## Problem

Existing dashboards (zashboard, metacubexd, XKeen-UI) provide monitoring and proxy switching, but lack visual config editing: reordering rules, managing proxy-groups, drag-and-drop blocks. Users must manually edit YAML to change rule priority or group order.

## Solution

Full-featured SPA dashboard that replaces zashboard, combining monitoring with a visual config editor and service management.

## Architecture

```
Browser (SPA)
  |               |
  mihomo API      Config API
  (port 9090)     (port 8080)
  |               |
  mihomo          Python Flask
  (router)        (router or remote server)
                  |
                  config.yaml + xkeen files
```

- **SPA (React)** runs entirely in browser, zero load on router
- **mihomo API** (existing, port 9090) for monitoring, proxy switching, logs
- **Config API** (new, Python Flask) for reading/writing config files, service management, updates
- User chooses backend location (local router or remote server) during setup wizard

## Tech Stack

### Frontend
- React 18+ with TypeScript
- Tailwind CSS (dark + light theme)
- dnd-kit (drag-and-drop for rules and groups)
- Monaco Editor (YAML editing with syntax highlighting)
- WebSocket for live logs

### Backend (Config API)
- Python Flask (~200-300 lines)
- Endpoints: config CRUD, file management, service control, self-update
- Runs on Keenetic (Entware) or remote server
- Minimal footprint (~10-15 MB RAM)

## Pages

### 1. Overview
- Uptime, traffic stats, active connections count, speed
- Service status badge (running/stopped)
- mihomo version + dashboard version
- Service controls: Start / Stop / Restart xkeen
- Update kernel button (check + install)
- Update dashboard button (self-update)

### 2. Proxies
- Proxy-groups as cards with current selection
- Click to switch proxy within group
- Latency testing per proxy
- Same functionality as zashboard proxies page

### 3. Connections
- Real-time table of active connections
- Source IP, destination, rule matched, proxy used, speed
- Search and filter
- Close connection button

### 4. Rules (key page)
- Rules displayed as visual blocks (Telegram, Discord, YouTube, Adult, RU traffic, etc.)
- Each block: card with title, rule count, target group
- **Drag-and-drop** between blocks to change priority (first match wins)
- Click block to expand: see rules inside
- Inside block: add/remove rule, change target group
- Create new block
- Changes reflected in config.yaml rules section

### 5. Groups (key page)
- Proxy-groups as draggable cards
- **Drag-and-drop** to reorder
- Reordering syncs both `proxy-groups:` and `GLOBAL.proxies:` in config
- Click group to edit: name, type, icon, proxy list
- Create new group button
- Delete group

### 6. Providers
- Rule-providers list with status (loaded/error), record count, last update
- Proxy-providers list
- Manual update button per provider
- Update all button

### 7. Config (raw editor)
- **Tabs**: config | ip_exclude | port_exclude | port_proxying
- Monaco Editor with YAML syntax highlighting
- YAML validation indicator ("YAML valid" / "Error at line X")
- **Live log panel below** (WebSocket) - see mihomo logs in real-time
- When "Apply" pressed, logs show if config accepted or error
- Buttons: Apply | Save | Format

### 8. Logs
- Full mihomo log stream (WebSocket)
- Filter by level (info/warning/error)
- Search
- Auto-scroll toggle
- Clear / Export

### 9. Settings
- mihomo API address + secret
- Config API address
- Theme toggle (dark/light)
- Setup wizard re-run
- Dashboard version + check for updates
- Language (Russian by default)

## Setup Wizard

On first launch (no saved config in localStorage):
1. Welcome screen
2. "Where is Config API running?" - Local (router) / Remote server (CDN)
3. Enter mihomo API address (default: current host:9090)
4. Enter Config API address (default: current host:8080)
5. Test connections
6. Done - save to localStorage

Settings changeable later in Settings page.

## Config API Endpoints

```
GET    /api/config                    # Read config.yaml
PUT    /api/config                    # Write config.yaml (creates backup)
GET    /api/config/validate           # Validate YAML
GET    /api/files/:name               # Read xkeen file (ip_exclude, port_proxying, etc.)
PUT    /api/files/:name               # Write xkeen file
GET    /api/backups                   # List config backups
POST   /api/service/restart           # Restart xkeen
POST   /api/service/stop              # Stop xkeen
POST   /api/service/start             # Start xkeen
GET    /api/service/status            # Service status + versions
POST   /api/update/check              # Check for updates (kernel + dashboard)
POST   /api/update/kernel             # Update mihomo kernel
POST   /api/update/dashboard          # Self-update dashboard + backend
```

## Self-Update Mechanism

- Dashboard checks latest version from GitHub releases (or custom server)
- Compares with current version
- Downloads new `dist.zip` + updated backend script
- Extracts to external-ui folder, restarts backend
- All via `POST /api/update/dashboard`

## Keenetic Resource Constraints

- ARM router with limited RAM/CPU
- Python Flask backend: ~10-15 MB RAM, minimal CPU
- SPA: zero server load (runs in browser)
- All heavy lifting (rendering, drag-and-drop) in browser
- Config API is stateless, no database
- MRS format for rule-providers (binary, 10-50x smaller than YAML)

## Implementation Phases (high-level)

1. **Phase 1**: Project scaffold, Config API backend, setup wizard
2. **Phase 2**: Overview + service management
3. **Phase 3**: Proxies page (mihomo API integration)
4. **Phase 4**: Connections + Logs pages
5. **Phase 5**: Config raw editor with tabs + live log
6. **Phase 6**: Rules visual editor with drag-and-drop
7. **Phase 7**: Groups editor with drag-and-drop + GLOBAL sync
8. **Phase 8**: Providers page
9. **Phase 9**: Self-update mechanism
10. **Phase 10**: Polish, themes, testing

## File Structure

```
mihomo/
  dashboard/
    frontend/          # React SPA source
      src/
        components/
        pages/
        api/           # mihomo API + config API clients
        store/         # state management
      dist/            # built SPA (goes to external-ui)
    backend/
      server.py        # Flask Config API
      requirements.txt
    docs/
```
