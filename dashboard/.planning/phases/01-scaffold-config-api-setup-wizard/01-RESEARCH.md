# Phase 1: Scaffold + Config API + Setup Wizard - Research

**Researched:** 2026-02-27
**Domain:** React SPA scaffolding, Flask REST API, YAML config management, Setup wizard UX
**Confidence:** HIGH

## Summary

Phase 1 -- фундамент всего проекта. Необходимо создать React SPA (Vite + TypeScript + Tailwind CSS v4 + shadcn/ui), Flask backend для чтения/записи mihomo YAML-конфигурации, и пошаговый мастер первоначальной настройки. Ключевая сложность -- сохранение комментариев и форматирования в YAML-файле конфигурации mihomo (1572 строки), для чего необходима библиотека ruamel.yaml вместо стандартного PyYAML.

Стек полностью определён в CONTEXT.md: Vite 6.x + React 19 + TypeScript, Tailwind CSS v4 с @tailwindcss/vite плагином, shadcn/ui (копируемые компоненты), Lucide icons, Zustand 5.x для state management с persist middleware, Flask 3.1.x backend. Роутинг -- React Router v7 в declarative mode (BrowserRouter). Sidebar сворачиваемый с иконками, 11 пунктов меню (нереализованные как заглушки).

**Primary recommendation:** Использовать `pnpm create vite@latest` с template `react-ts`, затем `shadcn@latest init` для инициализации UI. Backend -- минимальный Flask с ruamel.yaml для round-trip YAML-редактирования и flask-cors для CORS.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Пошаговый wizard из 3 шагов: выбор типа установки -> автотест подключения -> экран успеха
- Шаг 1: выбор типа установки (локальный / CDN) -- без ввода адресов
- Адреса API определяются автоматически: для локального -- с роутера, для CDN -- зашиты в установщике
- Пользователь НЕ видит и НЕ вводит адреса API -- только выбирает тип
- После успеха -- экран "Готово!" с краткой информацией, затем переход на Overview
- Sidebar с иконками слева (как в zashboard), но с современным дизайном 2025-2026
- Sidebar сворачивается до иконок, разворачивается по клику/ховеру
- Все пункты меню показаны сразу (все 11 страниц), нереализованные -- заглушки
- Сборка: Vite + React, TypeScript, Tailwind CSS + shadcn/ui, Lucide icons, Zustand, Flask backend
- После завершения wizard -- экран успеха, затем Overview
- При повторном открытии -- стартовая страница настраивается пользователем
- В Settings: выбор стартовой страницы -- "Overview", "Последняя посещённая" или конкретная страница
- Заглушки нереализованных страниц: иллюстрация/иконка + название + описание будущего функционала

### Claude's Discretion
- UX обработки ошибок при тесте подключения в wizard
- Конкретный дизайн header области (справа от sidebar)
- Точный набор иконок для каждого пункта меню
- Анимации и переходы между шагами wizard
- Дизайн экрана успеха после wizard
- Стиль заглушек (конкретная иллюстрация/иконка)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SETUP-01 | SPA loads in browser and displays setup wizard on first launch | Vite + React + Zustand persist: проверяем localStorage на наличие конфигурации, если нет -- показываем wizard |
| SETUP-02 | User can configure mihomo API address and Config API address | Wizard автоматически определяет адреса по типу установки (local/CDN), сохраняет в Zustand persist store |
| SETUP-03 | Setup wizard tests connections to both APIs and shows success/error | Fetch к mihomo API (GET /version) и Config API (GET /api/config) для проверки доступности |
| SETUP-04 | Config saved to localStorage, changeable in Settings page | Zustand persist middleware автоматически синхронизирует с localStorage |
| API-01 | Backend serves config.yaml via GET/PUT endpoints | Flask route GET/PUT /api/config с ruamel.yaml для round-trip YAML |
| API-02 | Backend creates backup before overwriting config | shutil.copy2() перед записью, таймстампованные бэкапы в подпапке |
| API-03 | Backend serves xkeen files (ip_exclude, port_exclude, port_proxying) | Flask routes GET/PUT /api/xkeen/{filename} для .lst файлов |
| API-04 | Backend validates YAML before saving | ruamel.yaml.load() в try/except -- если парсинг провалился, возвращаем 400 |
</phase_requirements>

## Standard Stack

### Core (Frontend)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | 6.3.x | Build tool / dev server | Стандарт 2026 для React SPA. Мгновенный HMR, оптимизированная prod-сборка |
| React | 19.x | UI framework | Текущая стабильная версия, совместимость с shadcn/ui |
| TypeScript | 5.x | Type safety | Встроен в Vite template `react-ts` |
| Tailwind CSS | 4.2.x | Utility-first CSS | v4 с @tailwindcss/vite плагином. Без tailwind.config.js -- CSS-first конфигурация |
| shadcn/ui | latest | UI компоненты | Копируемые компоненты с полным контролем. Встроенный Sidebar с collapsible mode |
| Lucide React | 0.575.x | Icons | Нативная интеграция с shadcn/ui, tree-shakeable ES modules |
| Zustand | 5.0.10 | State management | Легковесный, persist middleware для localStorage. Fix в 5.0.10 для persist bugs |
| React Router | 7.13.x | Routing | Declarative mode (BrowserRouter) -- простейший для SPA без SSR |
| tw-animate-css | latest | Animations | Замена deprecated tailwindcss-animate для shadcn/ui + Tailwind v4 |

### Core (Backend)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Flask | 3.1.3 | REST API framework | Минимальный footprint, совместимость с Entware на ARM-роутере |
| flask-cors | 5.0.x | CORS support | Необходим для SPA на отдельном порту при dev / CDN-режиме |
| ruamel.yaml | 0.18.x+ | YAML round-trip parsing | ЕДИНСТВЕННАЯ библиотека Python, сохраняющая комментарии и форматирование YAML |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | latest | Node.js types for Vite config | Нужен для path.resolve в vite.config.ts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ruamel.yaml | PyYAML | PyYAML ТЕРЯЕТ все комментарии и форматирование. Недопустимо для конфига в 1572 строки с русскими комментариями |
| React Router declarative | React Router framework mode | Излишняя сложность для чистого SPA. Framework mode тянет SSR-абстракции |
| Zustand | Redux Toolkit | Zustand проще, меньше бойлерплейта, persist middleware встроен |
| tw-animate-css | tailwindcss-animate | tailwindcss-animate deprecated для Tailwind v4, shadcn/ui теперь использует tw-animate-css |

**Installation (Frontend):**
```bash
pnpm create vite@latest dashboard -- --template react-ts
cd dashboard
pnpm add tailwindcss @tailwindcss/vite
pnpm add -D @types/node
pnpm dlx shadcn@latest init
pnpm add react-router zustand lucide-react
```

**Installation (Backend):**
```bash
pip install flask flask-cors "ruamel.yaml>=0.18"
```

## Architecture Patterns

### Recommended Project Structure

```
dashboard/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui компоненты (Button, Sidebar, Card, etc.)
│   │   ├── layout/          # AppLayout, Sidebar, Header
│   │   └── wizard/          # SetupWizard, WizardStep1, WizardStep2, WizardStep3
│   ├── pages/
│   │   ├── OverviewPage.tsx  # Заглушка (Phase 2)
│   │   ├── ProxiesPage.tsx   # Заглушка (Phase 3)
│   │   ├── ConnectionsPage.tsx # Заглушка (Phase 4)
│   │   ├── LogsPage.tsx      # Заглушка (Phase 4)
│   │   ├── ConfigEditorPage.tsx # Заглушка (Phase 5)
│   │   ├── RulesPage.tsx     # Заглушка (Phase 6)
│   │   ├── GroupsPage.tsx    # Заглушка (Phase 7)
│   │   ├── ProvidersPage.tsx # Заглушка (Phase 8)
│   │   ├── GeodataPage.tsx   # Заглушка (Phase 9)
│   │   ├── SettingsPage.tsx  # Настройки (стартовая страница, API адреса)
│   │   └── PlaceholderPage.tsx # Переиспользуемый компонент заглушки
│   ├── stores/
│   │   ├── settings.ts       # Zustand store: API endpoints, theme, start page
│   │   └── wizard.ts         # Zustand store: wizard state (step, results)
│   ├── lib/
│   │   ├── api.ts            # Config API client (fetch wrapper)
│   │   └── utils.ts          # shadcn/ui cn() utility
│   ├── App.tsx               # Router + Layout + Wizard gate
│   ├── main.tsx              # Entry point
│   └── index.css             # Tailwind import + shadcn/ui theme vars
├── backend/
│   ├── server.py             # Flask app: /api/config, /api/xkeen/*
│   └── requirements.txt      # flask, flask-cors, ruamel.yaml
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── components.json           # shadcn/ui config
└── package.json
```

### Pattern 1: Wizard Gate (First Launch Detection)

**What:** При первом запуске показываем Setup Wizard вместо основного интерфейса.
**When to use:** App.tsx -- корневой уровень маршрутизации.
**Example:**
```typescript
// src/App.tsx
import { useSettingsStore } from '@/stores/settings'

function App() {
  const isConfigured = useSettingsStore((s) => s.isConfigured)

  if (!isConfigured) {
    return <SetupWizard />
  }

  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" />} />
          <Route path="/overview" element={<OverviewPage />} />
          {/* ... все маршруты */}
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}
```

### Pattern 2: Zustand Persist Store

**What:** Настройки сохраняются в localStorage и восстанавливаются при перезагрузке.
**When to use:** Все глобальные настройки (API endpoints, тема, стартовая страница).
**Example:**
```typescript
// src/stores/settings.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  isConfigured: boolean
  installationType: 'local' | 'cdn' | null
  mihomoApiUrl: string
  configApiUrl: string
  startPage: 'overview' | 'last-visited' | string
  lastVisitedPage: string
  setConfigured: (type: 'local' | 'cdn', mihomoUrl: string, configUrl: string) => void
  setStartPage: (page: string) => void
  setLastVisitedPage: (page: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isConfigured: false,
      installationType: null,
      mihomoApiUrl: '',
      configApiUrl: '',
      startPage: 'overview',
      lastVisitedPage: '/overview',
      setConfigured: (type, mihomoUrl, configUrl) =>
        set({ isConfigured: true, installationType: type, mihomoApiUrl: mihomoUrl, configApiUrl: configUrl }),
      setStartPage: (page) => set({ startPage: page }),
      setLastVisitedPage: (page) => set({ lastVisitedPage: page }),
    }),
    { name: 'mihomo-dashboard-settings' }
  )
)
```

### Pattern 3: Flask Config API with Backup

**What:** REST endpoint для YAML с backup перед перезаписью.
**When to use:** Backend -- обработка GET/PUT /api/config.
**Example:**
```python
# backend/server.py
import os
import shutil
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from ruamel.yaml import YAML

app = Flask(__name__)
CORS(app)
yaml = YAML()
yaml.preserve_quotes = True

CONFIG_PATH = os.environ.get('MIHOMO_CONFIG_PATH', '/opt/etc/xkeen/config.yaml')
BACKUP_DIR = os.environ.get('BACKUP_DIR', '/opt/etc/xkeen/backups')

@app.route('/api/config', methods=['GET'])
def get_config():
    try:
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'content': content}), 200
    except FileNotFoundError:
        return jsonify({'error': 'Config file not found'}), 404

@app.route('/api/config', methods=['PUT'])
def put_config():
    data = request.get_json()
    content = data.get('content', '')

    # Validate YAML
    try:
        from io import StringIO
        yaml.load(StringIO(content))
    except Exception as e:
        return jsonify({'error': f'Invalid YAML: {str(e)}'}), 400

    # Create backup
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = os.path.join(BACKUP_DIR, f'config_{timestamp}.yaml')
    if os.path.exists(CONFIG_PATH):
        shutil.copy2(CONFIG_PATH, backup_path)

    # Write new config
    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        f.write(content)

    return jsonify({'message': 'Config saved', 'backup': backup_path}), 200
```

### Pattern 4: shadcn/ui Sidebar с Collapsible Mode

**What:** Sidebar сворачивается до иконок, разворачивается по клику.
**When to use:** Основной layout приложения.
**Example:**
```typescript
// src/components/layout/AppLayout.tsx
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup,
         SidebarGroupContent, SidebarMenu, SidebarMenuItem,
         SidebarMenuButton, SidebarTrigger } from '@/components/ui/sidebar'
import { Home, Globe, Link2, ScrollText, FileCode, Layers,
         Users, Database, Map, Download, Settings } from 'lucide-react'

const menuItems = [
  { title: 'Overview', icon: Home, path: '/overview' },
  { title: 'Proxies', icon: Globe, path: '/proxies' },
  { title: 'Connections', icon: Link2, path: '/connections' },
  { title: 'Logs', icon: ScrollText, path: '/logs' },
  { title: 'Config Editor', icon: FileCode, path: '/config-editor' },
  { title: 'Rules', icon: Layers, path: '/rules' },
  { title: 'Groups', icon: Users, path: '/groups' },
  { title: 'Providers', icon: Database, path: '/providers' },
  { title: 'Geodata', icon: Map, path: '/geodata' },
  { title: 'Updates', icon: Download, path: '/updates' },
  { title: 'Settings', icon: Settings, path: '/settings' },
]

// shadcn/ui Sidebar collapsible="icon" сворачивает до иконок
```

### Pattern 5: Wizard Connection Test

**What:** Шаг 2 wizard -- автоматический тест подключения к mihomo API и Config API.
**When to use:** Setup wizard, после выбора типа установки.
**Example:**
```typescript
// src/components/wizard/WizardStep2.tsx
async function testConnections(mihomoUrl: string, configUrl: string) {
  const results = { mihomo: false, configApi: false, errors: [] as string[] }

  try {
    const resp = await fetch(`${mihomoUrl}/version`, {
      headers: { 'Authorization': `Bearer ${secret}` },
      signal: AbortSignal.timeout(5000)
    })
    results.mihomo = resp.ok
  } catch (e) {
    results.errors.push(`Mihomo API (${mihomoUrl}): ${e.message}`)
  }

  try {
    const resp = await fetch(`${configUrl}/api/config`, {
      signal: AbortSignal.timeout(5000)
    })
    results.configApi = resp.ok
  } catch (e) {
    results.errors.push(`Config API (${configUrl}): ${e.message}`)
  }

  return results
}
```

### Anti-Patterns to Avoid

- **Ручной CSS вместо Tailwind:** Не писать custom CSS, кроме CSS-переменных для shadcn/ui темы. Tailwind v4 покрывает все нужды.
- **PyYAML для конфига:** НИКОГДА не использовать PyYAML -- он уничтожит все 100+ комментариев в конфиге. Только ruamel.yaml.
- **Хранение API-адресов в backend:** Адреса хранятся в localStorage на клиенте. Backend не знает и не должен знать о mihomo API URL.
- **Framework mode React Router:** Не использовать framework mode для SPA-дашборда. Declarative mode достаточен.
- **Global state для wizard:** Wizard state не нужно персистить -- он нужен только при первом запуске. Использовать локальный useState или отдельный непересистируемый store.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sidebar UI | Custom sidebar с CSS animations | shadcn/ui Sidebar (collapsible="icon") | Встроенная поддержка collapsible, icon mode, keyboard навигация, accessibility |
| YAML round-trip | Regex-замены или string manipulation | ruamel.yaml | YAML-комментарии, unicode emoji в именах групп, вложенные структуры -- все edge cases |
| Form controls (wizard) | Custom inputs/buttons | shadcn/ui Button, Card, RadioGroup | Accessibility, keyboard навигация, тема из коробки |
| CORS handling | Ручные headers | flask-cors CORS(app) | Preflight, credentials, allowed origins -- все edge cases |
| State persistence | Ручной localStorage.setItem/getItem | Zustand persist middleware | Автоматическая сериализация, hydration, merge strategies |
| CSS utilities | Custom utility classes | Tailwind CSS v4 | v4 с zero-config, tree-shaking, мгновенная компиляция |

**Key insight:** Конфиг mihomo содержит Unicode emoji в именах групп (напр. "⚡Fastest", "📶Available"), inline-комментарии на русском, сложную вложенность. Любая "простая" замена ruamel.yaml приведёт к потере данных.

## Common Pitfalls

### Pitfall 1: Tailwind v4 CSS-first конфигурация
**What goes wrong:** Попытка создать tailwind.config.js как в v3.
**Why it happens:** Вся документация v3 говорит о tailwind.config.js, но v4 использует CSS-first подход.
**How to avoid:** НЕ создавать tailwind.config.js. Вся конфигурация -- через @theme в index.css. shadcn/ui init автоматически настроит правильную структуру.
**Warning signs:** Если в проекте есть файл tailwind.config.js -- что-то пошло не так.

### Pitfall 2: shadcn/ui + tailwindcss-animate deprecated
**What goes wrong:** Установка tailwindcss-animate вместо tw-animate-css.
**Why it happens:** Старая документация и туториалы ссылаются на tailwindcss-animate.
**How to avoid:** shadcn/ui init с Tailwind v4 автоматически установит tw-animate-css. Не устанавливать tailwindcss-animate вручную.
**Warning signs:** Warning в консоли о deprecated пакете.

### Pitfall 3: ruamel.yaml сломанные кавычки
**What goes wrong:** ruamel.yaml может менять стиль кавычек при round-trip (single -> double или наоборот).
**Why it happens:** По умолчанию ruamel.yaml может "оптимизировать" кавычки.
**How to avoid:** Установить `yaml.preserve_quotes = True` при инициализации YAML-объекта.
**Warning signs:** Конфиг mihomo перестаёт работать из-за изменённых кавычек в значениях вроде `'0.0.0.0:9090'`.

### Pitfall 4: CORS при dev-режиме
**What goes wrong:** Vite dev server (порт 5173) не может обратиться к Flask (порт 5000).
**Why it happens:** Browser Same-Origin Policy блокирует кросс-доменные запросы.
**How to avoid:** Два подхода: (1) flask-cors на бэкенде, (2) Vite proxy в vite.config.ts. Рекомендуется оба: flask-cors для production, Vite proxy для dev удобства.
**Warning signs:** Ошибки CORS в консоли браузера.

### Pitfall 5: Zustand persist hydration timing
**What goes wrong:** Компонент рендерится с начальным state до hydration из localStorage.
**Why it happens:** Zustand persist асинхронно загружает данные из storage.
**How to avoid:** Использовать `onRehydrateStorage` callback или проверять `hasHydrated` перед показом wizard/main UI.
**Warning signs:** Мелькание wizard при каждой перезагрузке у настроенного пользователя.

### Pitfall 6: Flask на ARM-роутере -- кодировка
**What goes wrong:** Русские комментарии и emoji в YAML ломаются при чтении/записи.
**Why it happens:** Дефолтная кодировка на ARM Entware может быть не UTF-8.
**How to avoid:** Всегда указывать `encoding='utf-8'` при open(). В ruamel.yaml по умолчанию UTF-8, но явно проверить.
**Warning signs:** Mojibake (кракозябры) в русских комментариях конфига.

### Pitfall 7: React Router v7 -- react-router-dom deprecated
**What goes wrong:** Установка react-router-dom вместо react-router.
**Why it happens:** В v6 нужен был react-router-dom. В v7 всё реэкспортируется из react-router.
**How to avoid:** Установить `react-router` (не react-router-dom). Все импорты из `'react-router'`.
**Warning signs:** Дублированные пакеты в node_modules.

## Code Examples

### Vite Config с Tailwind v4 и Path Aliases

```typescript
// vite.config.ts
// Source: https://ui.shadcn.com/docs/installation/vite
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
```

### CSS Entry Point (Tailwind v4 + shadcn/ui)

```css
/* src/index.css */
/* Source: https://ui.shadcn.com/docs/tailwind-v4 */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  /* shadcn/ui CSS variables будут добавлены shadcn init */
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  /* ... остальные переменные темы */
}
```

### Zustand Settings Store с Persist

```typescript
// src/stores/settings.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SettingsState {
  // Setup
  isConfigured: boolean
  installationType: 'local' | 'cdn' | null
  mihomoApiUrl: string
  mihomoSecret: string
  configApiUrl: string

  // Navigation
  startPage: 'overview' | 'last-visited' | string
  lastVisitedPage: string

  // Actions
  setConfigured: (config: {
    type: 'local' | 'cdn'
    mihomoUrl: string
    mihomoSecret: string
    configUrl: string
  }) => void
  setStartPage: (page: string) => void
  setLastVisitedPage: (page: string) => void
  resetConfig: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isConfigured: false,
      installationType: null,
      mihomoApiUrl: '',
      mihomoSecret: '',
      configApiUrl: '',
      startPage: 'overview',
      lastVisitedPage: '/overview',

      setConfigured: (config) => set({
        isConfigured: true,
        installationType: config.type,
        mihomoApiUrl: config.mihomoUrl,
        mihomoSecret: config.mihomoSecret,
        configApiUrl: config.configUrl,
      }),
      setStartPage: (page) => set({ startPage: page }),
      setLastVisitedPage: (page) => set({ lastVisitedPage: page }),
      resetConfig: () => set({
        isConfigured: false,
        installationType: null,
        mihomoApiUrl: '',
        mihomoSecret: '',
        configApiUrl: '',
      }),
    }),
    {
      name: 'mihomo-dashboard-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
```

### Flask Backend -- xkeen Files API

```python
# backend/server.py -- xkeen list files endpoints
XKEEN_DIR = os.environ.get('XKEEN_DIR', '/opt/etc/xkeen')
XKEEN_FILES = {
    'ip_exclude': 'ip_exclude.lst',
    'port_exclude': 'port_exclude.lst',
    'port_proxying': 'port_proxying.lst',
}

@app.route('/api/xkeen/<filename>', methods=['GET'])
def get_xkeen_file(filename):
    if filename not in XKEEN_FILES:
        return jsonify({'error': 'Unknown file'}), 404
    filepath = os.path.join(XKEEN_DIR, XKEEN_FILES[filename])
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'content': content, 'filename': XKEEN_FILES[filename]}), 200
    except FileNotFoundError:
        return jsonify({'content': '', 'filename': XKEEN_FILES[filename]}), 200

@app.route('/api/xkeen/<filename>', methods=['PUT'])
def put_xkeen_file(filename):
    if filename not in XKEEN_FILES:
        return jsonify({'error': 'Unknown file'}), 404
    data = request.get_json()
    content = data.get('content', '')
    filepath = os.path.join(XKEEN_DIR, XKEEN_FILES[filename])

    # Backup
    if os.path.exists(filepath):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(BACKUP_DIR, f'{filename}_{timestamp}.lst')
        os.makedirs(BACKUP_DIR, exist_ok=True)
        shutil.copy2(filepath, backup_path)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return jsonify({'message': f'{filename} saved'}), 200
```

### Mihomo API Endpoints Reference

Для Phase 1 нужны только эти endpoints mihomo API (порт 9090):

| Endpoint | Method | Purpose | Use in Phase 1 |
|----------|--------|---------|-----------------|
| `/version` | GET | Версия mihomo | Wizard: тест подключения |
| `/configs` | GET | Текущая конфигурация | Wizard: проверка что mihomo работает |

Auth: `Authorization: Bearer {secret}` или `?token={secret}` для WebSocket.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 + tailwind.config.js | Tailwind v4 + CSS-first @theme | Jan 2025 | Нет конфиг-файла, только CSS. @tailwindcss/vite плагин |
| tailwindcss-animate | tw-animate-css | 2025 | shadcn/ui v4 по умолчанию использует tw-animate-css |
| react-router-dom | react-router (единый пакет) | v7, 2025 | Всё из одного пакета, react-router-dom просто реэкспорт |
| Zustand v4 | Zustand v5 | 2025 | Новый API, persist из 'zustand/middleware' |
| PyYAML | ruamel.yaml | Давно, но критически важно | Round-trip с сохранением комментариев |

**Deprecated/outdated:**
- `tailwindcss-animate` -- заменён на `tw-animate-css` для Tailwind v4
- `react-router-dom` отдельный пакет -- в v7 не нужен, всё из `react-router`
- `tailwind.config.js` -- в v4 конфигурация через CSS @theme директиву

## Open Questions

1. **Адреса API для типа "локальный"**
   - What we know: Для локальной установки mihomo API на роутере по адресу типа `http://192.168.1.1:9090`, Config API рядом.
   - What's unclear: Точный алгоритм определения IP роутера. window.location.hostname может не совпадать с IP роутера если дашборд обслуживается из другого места.
   - Recommendation: Для типа "локальный" -- использовать `window.location.hostname` как базу (дашборд обслуживается роутером). Mihomo API: `http://{host}:9090`, Config API: `http://{host}:5000`. Позволить пользователю изменить в Settings если автоопределение ошибочно.

2. **Адреса для типа "CDN"**
   - What we know: CDN-версия обслуживается с GitHub Pages или CDN, API -- на роутере.
   - What's unclear: Как CDN-версия узнает IP роутера, если она не на роутере.
   - Recommendation: Для CDN -- при первом запуске всё же спросить IP роутера (одно поле). Или использовать mDNS/zeroconf. Самый простой подход -- одно поле "IP адрес роутера" для CDN-режима.

3. **mihomo secret в wizard**
   - What we know: mihomo требует `Authorization: Bearer {secret}` для API. В конфиге `secret: 'admin'`.
   - What's unclear: Нужно ли спрашивать secret в wizard или использовать дефолтный.
   - Recommendation: В wizard для локального типа -- можно попробовать без secret, затем с 'admin'. Для CDN -- спросить. Или добавить поле secret в Settings.

## Sources

### Primary (HIGH confidence)
- [shadcn/ui Vite Installation](https://ui.shadcn.com/docs/installation/vite) -- полная инструкция установки
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) -- миграция и совместимость
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar) -- collapsible sidebar компонент
- [React Router Modes](https://reactrouter.com/start/modes) -- declarative vs data vs framework
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4) -- @tailwindcss/vite, CSS-first config
- [MetaCubeX mihomo API](https://wiki.metacubex.one/en/api/) -- все REST/WebSocket endpoints
- [MetaCubeXD DeepWiki](https://deepwiki.com/MetaCubeX/metacubexd) -- архитектура существующего дашборда

### Secondary (MEDIUM confidence)
- [Flask PyPI](https://pypi.org/project/Flask/) -- Flask 3.1.3
- [flask-cors docs](https://flask-cors.readthedocs.io/en/latest/) -- CORS configuration
- [ruamel.yaml PyPI](https://pypi.org/project/ruamel.yaml/) -- round-trip YAML
- [Zustand persist DeepWiki](https://deepwiki.com/pmndrs/zustand/3.1-persist-middleware) -- persist middleware
- [XKeen DeepWiki](https://deepwiki.com/umarcheh001/Xkeen-UI/5.3-xkeen-settings-and-lists) -- xkeen list files format

### Tertiary (LOW confidence)
- Mihomo secret handling -- не найдена документация по best practices для wizard-интеграции

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- все версии проверены через npm/PyPI, совместимость подтверждена официальной документацией
- Architecture: HIGH -- shadcn/ui Sidebar collapsible mode, Zustand persist, React Router declarative mode -- всё документировано
- Pitfalls: HIGH -- все pitfalls основаны на breaking changes между версиями (Tailwind v3->v4, react-router-dom->react-router, tailwindcss-animate->tw-animate-css)
- Open questions: MEDIUM -- вопрос автоопределения адресов для CDN-режима требует решения при планировании

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (30 дней -- стабильный стек, все библиотеки в stable releases)
