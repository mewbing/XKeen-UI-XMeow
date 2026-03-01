# Technology Stack

**Analysis Date:** 2026-03-01

## Languages

**Primary:**
- TypeScript ~5.9.3 - All frontend source code (`src/**/*.ts`, `src/**/*.tsx`)
- Python 3.x - Backend server (`backend/server.py`)

**Secondary:**
- CSS (Tailwind v4 + custom properties) - Styling (`src/index.css`)
- YAML - Configuration files (`config/config.yaml`, xkeen `.lst` files)

## Runtime

**Frontend:**
- Node.js (no `.nvmrc` — version not pinned)
- Browser target: ES2022 (per `tsconfig.app.json`)

**Backend:**
- Python 3.x on Keenetic router (Linux/Entware)
- Gevent WSGI server (optional, falls back to werkzeug threaded)
- Runs on `0.0.0.0:5000` by default

## Package Manager

- **pnpm** (workspace mode)
- Lockfile: `pnpm-lock.yaml` (present)
- Workspace config: `pnpm-workspace.yaml` (minimal, `approveBuilds: esbuild`)

## Frameworks

**Core:**
- React 19.2.x - UI framework (`src/main.tsx` entry, StrictMode enabled)
- React Router 7.13.x - Client-side routing (`src/App.tsx`, BrowserRouter)
- Flask >=3.1,<4.0 - Backend HTTP server (`backend/server.py`)

**State Management:**
- Zustand 5.0.x - Global state stores (`src/stores/*.ts`)
- Zundo 2.3.x - Undo/redo temporal middleware (rules editor only, `src/stores/rules-editor.ts`)
- Zustand `persist` middleware - Settings persistence to localStorage (`src/stores/settings.ts`)

**UI Component Library:**
- shadcn/ui 3.8.x (new-york style) - Base UI primitives (`src/components/ui/*.tsx`)
- Radix UI 1.4.x - Headless accessible components (via shadcn)
- Lucide React 0.575.x - Icon library

**Styling:**
- Tailwind CSS 4.2.x (v4) - Utility-first CSS via `@tailwindcss/vite` plugin
- tw-animate-css 1.4.x - Animation utilities
- class-variance-authority 0.7.x - Component variant management
- clsx 2.1.x + tailwind-merge 3.5.x - Class name composition (`src/lib/utils.ts` `cn()` helper)

**Build/Dev:**
- Vite 7.3.x - Dev server and bundler (`vite.config.ts`)
- @vitejs/plugin-react 5.1.x - React JSX transform
- ESLint 9.39.x - Linting (flat config)
- typescript-eslint 8.48.x - TypeScript ESLint integration
- eslint-plugin-react-hooks 7.0.x - React hooks linting
- eslint-plugin-react-refresh 0.4.x - Fast Refresh boundary checks

**Testing:**
- None configured (no jest/vitest config files found)

## Key Dependencies

**Critical:**
- `@monaco-editor/react` ^4.7.0 + `monaco-editor` ^0.55.1 - Config YAML editor with custom `antigravity-dark` theme (`src/hooks/use-theme.ts`)
- `zustand` ^5.0.11 - All application state management (6 stores)
- `react-router` ^7.13.1 - Page routing with layout wrapper
- `recharts` ^3.7.0 - Traffic/memory/connections charts on overview page
- `yaml` ^2.8.2 (eemeli/yaml) - Comment-preserving YAML round-trip parsing for rules editor (`src/lib/rules-parser.ts`)
- `js-yaml` ^4.1.1 - YAML parsing for config editor validation

**UI/Interaction:**
- `@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^10.0.0, `@dnd-kit/modifiers` ^9.0.0, `@dnd-kit/utilities` ^3.2.2 - Drag-and-drop for rules editor block/rule reordering
- `react-resizable-panels` ^4.6.5 - Resizable split panels (connections/logs layout)
- `@tanstack/react-virtual` ^3.13.19 - Virtual scrolling for large lists
- `sonner` ^2.0.7 - Toast notifications
- `next-themes` ^0.4.6 - Theme switching (light/dark/system)

**Backend (Python):**
- `flask` >=3.1,<4.0 - HTTP API server
- `flask-cors` >=5.0,<6.0 - CORS headers for cross-origin requests
- `ruamel.yaml` >=0.18 - YAML parsing with comment preservation
- `flask-sock` (optional) - WebSocket support for log streaming
- `gevent` (optional) - Async WSGI server for concurrent WS + HTTP

## Configuration

**TypeScript:**
- `tsconfig.json` - Project references (app + node configs)
- `tsconfig.app.json` - Frontend: target ES2022, strict mode, bundler module resolution, path alias `@/*` -> `./src/*`
- `tsconfig.node.json` - Vite config: target ES2023

**Build:**
- `vite.config.ts` - React plugin, Tailwind v4 plugin, path alias, dev proxy configuration
- `components.json` - shadcn/ui configuration (new-york style, `@/` aliases)

**Theming:**
- `src/index.css` - CSS custom properties (oklch color space) for light and dark themes
- Custom "Antigravity" dark theme: deep blue-violet palette, hue 270-275
- Font: Inter (loaded from Google Fonts CDN)

**Environment (Backend):**
- `MIHOMO_CONFIG_PATH` - Path to mihomo config.yaml (default: `/opt/etc/mihomo/config.yaml`)
- `XKEEN_DIR` - Path to xkeen directory (default: `/opt/etc/xkeen`)
- `BACKUP_DIR` - Path to backup directory (default: `/opt/etc/mihomo/backups`)
- `XKEEN_BIN` - Path to xkeen binary (default: `/opt/sbin/xkeen`)
- `XKEEN_LOG_DIR` - Path to log directory (default: `/opt/var/log/xray`)
- `PORT` - Backend server port (default: `5000`)

**Dev Proxy (Vite):**
- `/api/service`, `/api/versions`, `/api/config`, `/api/xkeen`, `/api/health`, `/api/system`, `/api/logs` -> Flask backend at `http://172.16.10.1:5000`
- `/ws` -> Flask backend WebSocket at `http://172.16.10.1:5000`
- `/api/*` (catch-all) -> Mihomo REST API at `http://172.16.10.1:9090` (with Bearer auth header)

## Platform Requirements

**Development:**
- Node.js with pnpm
- Python 3.x for backend (optional for frontend-only dev)

**Production:**
- Keenetic router running Entware (Linux-based)
- Mihomo proxy engine on port 9090
- Flask backend on port 5000
- Static frontend files served alongside (or from CDN)
- Optional: gevent + flask-sock for WebSocket log streaming

---

*Stack analysis: 2026-03-01*
