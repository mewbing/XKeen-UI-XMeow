# External Integrations

**Analysis Date:** 2026-03-01

## APIs & External Services

### Mihomo REST API (Primary)

The core proxy engine API. All proxy management flows through this.

- **Base URL:** Configurable via settings store (`mihomoApiUrl`), typically `http://<router-ip>:9090`
- **Auth:** Bearer token via `Authorization` header (secret stored in `useSettingsStore.mihomoSecret`)
- **Client:** Custom fetch wrapper in `src/lib/mihomo-api.ts`

**Endpoints used:**

| Method | Endpoint | Purpose | Timeout |
|--------|----------|---------|---------|
| GET | `/version` | Version check, health test | 5s |
| POST | `/upgrade` | Core binary upgrade | 120s |
| POST | `/restart` | Restart mihomo process | 10s |
| GET | `/connections` | Active connections snapshot | 5s |
| DELETE | `/connections` | Close all connections | 5s |
| DELETE | `/connections/:id` | Close single connection | 5s |
| GET | `/proxies` | All proxy groups and nodes | 5s |
| PUT | `/proxies/:group` | Switch active proxy in group | 5s |
| GET | `/proxies/:name/delay` | Test single proxy delay | dynamic |
| GET | `/group/:name/delay` | Test all proxies in group | dynamic |
| PUT | `/configs?force=true` | Reload config from file | 10s |
| POST | `/cache/fakeip/flush` | Flush fake-IP cache | 5s |
| POST | `/configs/geo` | Update GeoIP/GeoSite databases | 60s |

### Mihomo WebSocket Streams

Real-time data streaming via WebSocket connections to mihomo.

- **Base URL:** Same as REST but `ws://` protocol
- **Auth:** `token` query parameter
- **Client:** Custom hook `src/hooks/use-mihomo-ws.ts`
- **Auto-reconnect:** 3 second delay on disconnect

**Streams used:**

| Path | Purpose | Consumer |
|------|---------|----------|
| `/traffic` | Upload/download speed + totals | `src/pages/OverviewPage.tsx` -> `src/stores/overview.ts` |
| `/memory` | Memory usage | `src/pages/OverviewPage.tsx` -> `src/stores/overview.ts` |
| `/connections` | Live connections snapshots | `src/pages/ConnectionsLogsPage.tsx` -> `src/stores/connections.ts` |

### Flask Config API (Backend)

Custom Python backend for service management, config editing, system metrics, and log streaming.

- **Base URL:** Configurable via settings store (`configApiUrl`), typically `http://<router-ip>:5000`
- **Auth:** None (relies on network isolation)
- **Client:** Custom fetch wrapper in `src/lib/config-api.ts`
- **Server:** `backend/server.py` (Flask + optional gevent)

**Endpoints:**

| Method | Endpoint | Purpose | Timeout |
|--------|----------|---------|---------|
| GET | `/api/health` | Health check | 5s |
| POST | `/api/service/:action` | Start/stop/restart xkeen service | 65s |
| GET | `/api/service/status` | Check if mihomo/xray is running (via `pidof`) | 5s |
| GET | `/api/versions` | Xkeen and dashboard versions | 5s |
| GET | `/api/config` | Read mihomo config.yaml | 5s |
| PUT | `/api/config` | Validate YAML, backup, save config | 10s |
| GET | `/api/xkeen/:filename` | Read xkeen list file | 5s |
| PUT | `/api/xkeen/:filename` | Backup and save xkeen list file | 10s |
| GET | `/api/system/cpu` | CPU usage from `/proc/stat` | 5s |
| GET | `/api/system/network` | External IP, geo info, uptime | 10s |
| GET | `/api/proxies/servers` | Proxy name -> server:port mapping from config | 5s |
| GET | `/api/logs/:name` | Raw log file content (tail) | 5s |
| GET | `/api/logs/:name/parsed` | Parsed log lines (structured) | 5s |
| POST | `/api/logs/:name/clear` | Truncate log file | 5s |

### Flask WebSocket Log Streaming

Real-time log streaming from xkeen/mihomo log files.

- **Endpoint:** `ws://<backend>/ws/logs`
- **Client:** Custom hook `src/hooks/useLogWebSocket.ts`
- **Auto-reconnect:** 1 second delay
- **Keepalive:** Ping/pong every 30 seconds
- **Startup delay:** 150ms (avoids React StrictMode double-mount issues)

**Protocol:**

```
Client -> Server:
  {type: "switchFile", file: "access"|"error"}
  {type: "reload"}
  {type: "clear"}
  {type: "ping"}

Server -> Client:
  {type: "initial", lines: [...], file: "error"}
  {type: "append", lines: [...]}
  {type: "clear"}
  {type: "pong"}
```

### External IP Detection (Backend-side)

The Flask backend calls external services to determine the router's public IP address.

- **Services tried (in order):** ifconfig.me, icanhazip.com, api.ipify.org, ip.sb
- **Method:** `curl -sf -m 3 https://<service>`
- **Geo lookup:** `http://ip-api.com/json/<ip>?fields=country,city,isp,query`
- **File:** `backend/server.py` function `system_network()`

## Data Storage

**Databases:**
- None. All data comes from mihomo REST/WS APIs and filesystem.

**File Storage (Backend):**
- Mihomo config: `/opt/etc/mihomo/config.yaml` (configurable via `MIHOMO_CONFIG_PATH`)
- Xkeen files: `/opt/etc/xkeen/` (`ip_exclude.lst`, `port_exclude.lst`, `port_proxying.lst`)
- Backups: `/opt/etc/mihomo/backups/` (timestamped copies before saves)
- Logs: `/opt/var/log/xray/` (`error.log`, `access.log`)

**Client-side Storage:**
- `localStorage` key `mihomo-dashboard-settings` - Persisted settings via Zustand persist middleware (`src/stores/settings.ts`)
- `localStorage` key `expandedGroups` - Proxy groups expanded state (`src/stores/proxies.ts`)
- `localStorage` key `connectionsVisibleColumns` - Connection table column prefs (`src/stores/connections.ts`)
- `sessionStorage` key `health-check-cache` - Health check results cache (30s TTL, `src/hooks/useHealthCheck.ts`)

**Caching:**
- Proxy delay cache: In-memory (Zustand), 15s TTL (`src/stores/proxies.ts`)
- Health check cache: sessionStorage, 30s TTL

## Authentication & Identity

**Mihomo API Auth:**
- Bearer token authentication via `Authorization: Bearer <secret>` header
- Secret stored in settings store (`mihomoSecret`), persisted to localStorage
- Configured during initial setup wizard
- WebSocket auth: passed as `?token=<secret>` query parameter

**Flask Backend Auth:**
- None. No authentication on Config API endpoints.
- Relies on network isolation (backend runs on the router's internal network)

**User Auth:**
- None. Dashboard is a single-user application (router admin).

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Bugsnag, etc.)

**Logs:**
- Backend: Python `logging` module, logger name `xmeow-ui`
- Frontend: `console.log`/`console.warn` for WebSocket lifecycle events
- User-facing: Toast notifications via `sonner` for action results

## CI/CD & Deployment

**Hosting:**
- Static files deployed to Keenetic router (Entware)
- Alternative: CDN mode (dashboard on external hosting, connects to router remotely)

**CI Pipeline:**
- None detected (no `.github/workflows/`, no `Dockerfile`, no CI config files)

**Build:**
```bash
pnpm build         # tsc -b && vite build -> dist/
pnpm dev           # vite dev server with proxy to router
pnpm preview       # vite preview of built assets
```

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Google Fonts CDN

- Font: Inter (weights 400, 500, 600, 700; subsets latin, cyrillic)
- Loaded in `index.html` via Google Fonts preconnect + stylesheet link
- Fallback chain: `'Inter', ui-sans-serif, system-ui, sans-serif`

## Environment Configuration

**Required for frontend operation:**
- `mihomoApiUrl` - URL to mihomo REST API (set during setup wizard, stored in localStorage)
- `mihomoSecret` - Bearer token for mihomo API (set during setup wizard)
- `configApiUrl` - URL to Flask Config API (set during setup wizard)

**Required for backend operation:**
- `MIHOMO_CONFIG_PATH` - Mihomo config file path
- `XKEEN_DIR` - Xkeen directory path
- `XKEEN_LOG_DIR` - Log files directory
- All have sensible defaults for Entware installation

**Secrets location:**
- Frontend: localStorage (`mihomo-dashboard-settings` key, contains `mihomoSecret`)
- Backend: Environment variables (paths only, no secrets)
- `.env` files: Not detected

---

*Integration audit: 2026-03-01*
