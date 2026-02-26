# Phase 2: Overview + Service Management - Research

**Researched:** 2026-02-27
**Domain:** Mihomo RESTful/WebSocket API, real-time dashboard metrics, xkeen service management
**Confidence:** HIGH

## Summary

Фаза 2 реализует главную страницу дашборда (Overview) с реальным мониторингом mihomo и управлением сервисом xkeen. Mihomo предоставляет полноценный RESTful + WebSocket API на порту external-controller (обычно 9090), включая стриминг трафика, памяти и подключений через WebSocket, а также эндпоинты для версии, конфигурации и обновления ядра. Управление xkeen осуществляется через init.d скрипт (`/opt/etc/init.d/S24xray`) и утилиту `xkeen` с флагами `-start`, `-stop`, `-restart`, `-status`.

Для графика скорости трафика (лайн-чарт вход/выход) рекомендуется использовать **recharts** -- наиболее популярную React-библиотеку для чартов с декларативным JSX API, tree-shaking поддержкой и ~50KB gzipped. Для окна длиной 60 точек (1 сек интервал, 1 минута истории) SVG-рендеринг recharts будет работать без проблем. Бэкенд (Flask Config API) нуждается в новых эндпоинтах для управления сервисом и отчета о версиях.

**Primary recommendation:** Использовать WebSocket для трафика/памяти с 1-секундным интервалом, recharts для графика скорости, новые Flask-эндпоинты для xkeen start/stop/restart/status, shadcn/ui AlertDialog для подтверждений.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Два режима отображения метрик с переключением: компактные карточки-счётчики в ряд (как Grafana) и большие панели сеткой 2x2
- Метрики: uptime, трафик (загрузка/отдача), скорость (вход/выход), активные подключения, использование RAM mihomo
- Обновление метрик в реальном времени (WebSocket/polling, каждые 1-3 сек)
- График скорости трафика -- лайн-чарт вход/выход за последние N минут (как в zashboard)
- Кнопки управления xkeen в sidebar/header -- доступны на всех страницах
- Формат: одна кнопка с контекстным dropdown-меню (Start/Stop/Restart)
- Подтверждение перед любым действием (Stop, Restart) -- диалог "Вы уверены?"
- Статус сервиса (Running/Stopped) -- индикатор в верхней панели (header)
- Автоматическая проверка обновлений при открытии дашборда + бейдж если доступно
- Подтверждение перед установкой -- диалог с текущей и новой версией, кнопка "Обновить"
- Процесс обновления: спиннер + полупрозрачный оверлей с логом выполнения в реальном времени
- После успешного обновления: оверлей с деталями (новая версия, что изменилось)
- Три версии: mihomo, дашборд, xkeen -- отображаются в нижней части sidebar
- Индикатор доступного обновления: маленькая цветная точка рядом с версией
- При клике на версию с индикатором -- попап с деталями (текущая/новая версия, кнопка "Обновить")

### Claude's Discretion
- Точный интервал обновления метрик (1-3 сек)
- Глубина истории на графике скорости
- Стиль и анимации карточек метрик
- Обработка ошибок подключения к API
- Дизайн loading/error состояний

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| API-05 | Backend controls xkeen service (start/stop/restart) | Flask subprocess endpoints calling `/opt/etc/init.d/S24xray` и `xkeen` utility; см. Backend API Extensions |
| API-06 | Backend reports service status and versions | Flask endpoint проверяющий pid/process xkeen + `xkeen -status`, версии mihomo (из mihomo API /version), xkeen (из парсинга xkeen output), дашборда (из package.json) |
| OVER-01 | Dashboard shows uptime, traffic stats, active connections count, speed | WebSocket /traffic (up/down/upTotal/downTotal), /connections (snapshot), /memory (inuse); uptime вычисляется на клиенте |
| OVER-02 | Service status badge (running/stopped) displayed | Polling Config API /api/service/status каждые 5-10 сек; badge в Header компоненте |
| OVER-03 | User can start/stop/restart xkeen from dashboard | Dropdown-menu в header с POST /api/service/{action} + AlertDialog подтверждение |
| OVER-04 | User can check and install kernel updates | POST /upgrade на mihomo API для обновления ядра; проверка через сравнение версий |
| OVER-05 | mihomo version and dashboard version displayed | GET /version mihomo API + hardcoded dashboard version из package.json; отображение в sidebar footer |
</phase_requirements>

## Standard Stack

### Core (уже в проекте)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.0 | UI framework | Уже установлен в Phase 1 |
| Zustand | ^5.0.11 | State management | Уже используется для settings store |
| shadcn/ui + Radix | ^1.4.3 | UI components | Уже установлен, Card/Button/Badge/Tooltip доступны |
| lucide-react | ^0.575.0 | Icons | Уже установлен |
| react-router | ^7.13.1 | Routing | Уже установлен |

### Новые зависимости для Phase 2
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| recharts | ^2.15 | Line chart для графика скорости трафика | График upload/download speed over time |

### Новые shadcn/ui компоненты (установка через CLI)
| Component | Purpose |
|-----------|---------|
| alert-dialog | Подтверждение действий (Stop/Restart/Update) |
| dropdown-menu | Контекстное меню управления сервисом |
| dialog | Попап деталей обновления |
| progress | Индикатор процесса обновления (опционально) |
| toggle-group | Переключатель режимов отображения метрик (компакт/панели) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | uPlot (~20KB) | Меньше размер, но спартанская документация и сложнее интеграция с React |
| recharts | Canvas-based (Apache ECharts) | Лучше для 1000+ точек, но overkill для 60-точечного графика |
| WebSocket (native) | reconnecting-websocket npm | Автореконнект из коробки, но можно реализовать вручную в ~20 строк |

**Installation:**
```bash
pnpm add recharts
npx shadcn@latest add alert-dialog dropdown-menu dialog toggle-group
```

## Mihomo RESTful API Reference

### REST Endpoints (HIGH confidence -- verified from mihomo source code)

| Endpoint | Method | Response Format | Purpose |
|----------|--------|----------------|---------|
| `/version` | GET | `{"meta": bool, "version": "string"}` | Версия mihomo |
| `/configs` | GET | `{port, socks-port, mode, log-level, ...}` | Текущая конфигурация |
| `/configs` | PATCH | 200 OK | Обновить конфигурацию |
| `/connections` | GET | `{downloadTotal, uploadTotal, connections: [...]}` | Снимок подключений |
| `/connections` | DELETE | 204 | Закрыть все подключения |
| `/connections/{id}` | DELETE | 204 | Закрыть конкретное подключение |
| `/upgrade` | POST | `{"status": "ok"}` или `{"error": "..."}` | Обновить ядро mihomo |
| `/upgrade?channel=xxx` | POST | `{"status": "ok"}` | Обновить с указанием канала |
| `/restart` | POST | 200 | Перезапустить mihomo |

### WebSocket Endpoints (HIGH confidence -- verified from mihomo source code)

| Endpoint | Data Format | Interval | Purpose |
|----------|-------------|----------|---------|
| `ws://host:port/traffic?token=SECRET` | `{"up": int64, "down": int64, "upTotal": int64, "downTotal": int64}` | 1 сек | Скорость и суммарный трафик (bytes/sec) |
| `ws://host:port/memory?token=SECRET` | `{"inuse": uint64, "oslimit": uint64}` | 1 сек | Использование RAM (bytes) |
| `ws://host:port/connections?token=SECRET&interval=1000` | `{downloadTotal, uploadTotal, connections: [...]}` | configurable (ms) | Стрим подключений |
| `ws://host:port/logs?token=SECRET&level=info` | `{type: string, payload: string}` | real-time | Стрим логов |

### Authentication
- REST: Header `Authorization: Bearer SECRET`
- WebSocket: Query parameter `?token=SECRET`

### Connection Object Structure (MEDIUM confidence -- from zashboard types)
```typescript
interface ConnectionRawMessage {
  id: string
  download: number       // bytes downloaded
  upload: number         // bytes uploaded
  chains: string[]       // proxy chain
  rule: string           // matching rule
  rulePayload: string
  start: string          // ISO timestamp
  metadata: {
    host: string
    destinationIP: string
    destinationPort: string
    sourceIP: string
    sourcePort: string
    network: string       // "tcp" | "udp"
    type: string
    process: string
    processPath: string
    // ... и другие поля
  }
}

// GET /connections snapshot
interface ConnectionsSnapshot {
  downloadTotal: number  // total bytes downloaded
  uploadTotal: number    // total bytes uploaded
  connections: ConnectionRawMessage[]
  memory?: number        // иногда включается
}
```

## Backend API Extensions (Config API -- Flask)

### Новые эндпоинты для Phase 2

Бэкенд (server.py) нуждается в расширении для управления xkeen.

```python
# --- Service Management ---

# POST /api/service/start
# POST /api/service/stop
# POST /api/service/restart
# Response: {"status": "ok"} | {"error": "..."}

# GET /api/service/status
# Response: {"running": true/false, "pid": number|null}

# GET /api/versions
# Response: {"xkeen": "1.2.3", "dashboard": "0.0.0"}
```

### xkeen Service Commands (MEDIUM confidence -- from xkeen script analysis)
```bash
# Через init.d (непосредственное управление Xray):
/opt/etc/init.d/S24xray start
/opt/etc/init.d/S24xray stop
/opt/etc/init.d/S24xray restart

# Через xkeen utility (обёртка):
xkeen -start
xkeen -stop
xkeen -restart
xkeen -status

# Проверка статуса через pidof/ps:
pidof xray || pidof mihomo
```

### Python Implementation Pattern
```python
import subprocess

XKEEN_INIT = '/opt/etc/init.d/S24xray'

@app.route('/api/service/<action>', methods=['POST'])
def service_action(action):
    if action not in ('start', 'stop', 'restart'):
        return jsonify({'error': 'Invalid action'}), 400
    try:
        result = subprocess.run(
            [XKEEN_INIT, action],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            return jsonify({'error': result.stderr or 'Command failed'}), 500
        return jsonify({'status': 'ok'}), 200
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Command timed out'}), 500
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500

@app.route('/api/service/status', methods=['GET'])
def service_status():
    try:
        result = subprocess.run(
            ['pidof', 'mihomo'],
            capture_output=True, text=True, timeout=5
        )
        running = result.returncode == 0
        pid = int(result.stdout.strip()) if running else None
        return jsonify({'running': running, 'pid': pid}), 200
    except Exception as exc:
        return jsonify({'running': False, 'pid': None, 'error': str(exc)}), 200
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx        # существует
│   │   ├── AppSidebar.tsx       # расширить: версии в footer, кнопка сервиса
│   │   └── Header.tsx           # расширить: статус-индикатор, dropdown управления
│   ├── overview/
│   │   ├── MetricsCards.tsx      # карточки метрик (компакт + панели)
│   │   ├── TrafficChart.tsx      # recharts LineChart скорость
│   │   ├── ServiceControl.tsx    # dropdown start/stop/restart
│   │   └── UpdateOverlay.tsx     # оверлей обновления ядра
│   └── ui/
│       ├── alert-dialog.tsx      # новый shadcn/ui
│       ├── dropdown-menu.tsx     # новый shadcn/ui
│       ├── dialog.tsx            # новый shadcn/ui
│       └── toggle-group.tsx      # новый shadcn/ui
├── hooks/
│   ├── use-mihomo-ws.ts          # WebSocket hook для traffic/memory
│   ├── use-service-status.ts     # polling статуса сервиса
│   └── use-mobile.ts             # существует
├── lib/
│   ├── api.ts                    # существует -- расширить
│   ├── mihomo-api.ts             # новый -- клиент mihomo REST API
│   ├── config-api.ts             # новый -- клиент Config API (service mgmt)
│   └── format.ts                 # форматирование bytes, uptime, speed
├── stores/
│   ├── settings.ts               # существует
│   └── overview.ts               # новый -- состояние overview (метрики, история)
└── pages/
    └── OverviewPage.tsx           # заменить placeholder
```

### Pattern 1: WebSocket Hook with Auto-Reconnect
**What:** Custom React hook для подключения к mihomo WebSocket endpoints с автоматическим переподключением
**When to use:** Для стриминга traffic, memory данных
**Example:**
```typescript
// src/hooks/use-mihomo-ws.ts
import { useEffect, useRef, useCallback } from 'react'
import { useSettingsStore } from '@/stores/settings'

export function useMihomoWs<T>(
  path: string,                    // "/traffic", "/memory"
  onMessage: (data: T) => void,
  interval?: number                // для /connections?interval=
) {
  const wsRef = useRef<WebSocket | null>(null)
  const mihomoApiUrl = useSettingsStore((s) => s.mihomoApiUrl)
  const mihomoSecret = useSettingsStore((s) => s.mihomoSecret)

  const connect = useCallback(() => {
    const wsUrl = mihomoApiUrl.replace(/^http/, 'ws')
    const params = new URLSearchParams()
    if (mihomoSecret) params.set('token', mihomoSecret)
    if (interval) params.set('interval', String(interval))
    const fullUrl = `${wsUrl}${path}?${params.toString()}`

    const ws = new WebSocket(fullUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as T
        onMessage(data)
      } catch { /* ignore parse errors */ }
    }

    ws.onclose = () => {
      // Auto-reconnect after 3 seconds
      setTimeout(() => connect(), 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [mihomoApiUrl, mihomoSecret, path, onMessage, interval])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [connect])
}
```

### Pattern 2: Rolling History Buffer
**What:** Zustand store хранящий скользящее окно данных для графиков
**When to use:** Для хранения истории скорости/памяти за последние N секунд
**Example:**
```typescript
// src/stores/overview.ts
import { create } from 'zustand'

const HISTORY_LENGTH = 60 // 60 секунд

interface TrafficPoint {
  time: number
  up: number
  down: number
}

interface OverviewState {
  // Current values
  uploadSpeed: number
  downloadSpeed: number
  uploadTotal: number
  downloadTotal: number
  memoryInuse: number
  activeConnections: number

  // History for charts
  trafficHistory: TrafficPoint[]

  // Uptime tracking
  startTime: number | null

  // Actions
  updateTraffic: (data: { up: number; down: number; upTotal: number; downTotal: number }) => void
  updateMemory: (data: { inuse: number }) => void
  updateConnections: (count: number) => void
  setStartTime: (time: number) => void
}

export const useOverviewStore = create<OverviewState>()((set) => ({
  uploadSpeed: 0,
  downloadSpeed: 0,
  uploadTotal: 0,
  downloadTotal: 0,
  memoryInuse: 0,
  activeConnections: 0,
  trafficHistory: Array.from({ length: HISTORY_LENGTH }, (_, i) => ({
    time: i,
    up: 0,
    down: 0,
  })),
  startTime: null,

  updateTraffic: (data) =>
    set((state) => ({
      uploadSpeed: data.up,
      downloadSpeed: data.down,
      uploadTotal: data.upTotal,
      downloadTotal: data.downTotal,
      trafficHistory: [
        ...state.trafficHistory.slice(-(HISTORY_LENGTH - 1)),
        { time: Date.now(), up: data.up, down: data.down },
      ],
    })),

  updateMemory: (data) => set({ memoryInuse: data.inuse }),

  updateConnections: (count) => set({ activeConnections: count }),

  setStartTime: (time) => set({ startTime: time }),
}))
```

### Pattern 3: Service Action with Confirmation
**What:** Паттерн вызова action через Config API с обязательным подтверждением
**When to use:** Start/Stop/Restart xkeen, Update kernel
**Example:**
```typescript
// Использование AlertDialog для подтверждения
<AlertDialog>
  <AlertDialogTrigger asChild>
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      <Square className="mr-2 h-4 w-4" />
      Остановить
    </DropdownMenuItem>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Остановить сервис?</AlertDialogTitle>
      <AlertDialogDescription>
        Все активные подключения будут закрыты.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Отмена</AlertDialogCancel>
      <AlertDialogAction onClick={() => handleServiceAction('stop')}>
        Остановить
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Anti-Patterns to Avoid
- **Polling вместо WebSocket для трафика:** mihomo уже поддерживает WebSocket стриминг -- polling каждые 1 сек создаёт ненужную нагрузку HTTP
- **Хранение всей истории без ограничения:** Без slice/window буфер будет расти бесконечно и съедать память
- **Прямые fetch вызовы из компонентов:** Вынести API-клиент в отдельные модули (mihomo-api.ts, config-api.ts) для переиспользования
- **Blocking subprocess в Flask:** Всегда использовать timeout при вызове subprocess.run для init.d скриптов
- **WebSocket без reconnect:** Соединение может разорваться -- обязателен auto-reconnect с backoff

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation dialogs | Кастомный modal | shadcn/ui AlertDialog | Доступность, фокус-трэппинг, ARIA из коробки |
| Dropdown menu | Кастомный dropdown | shadcn/ui DropdownMenu | Keyboard navigation, positioning, portal |
| Line chart | Canvas/SVG вручную | recharts LineChart | Оси, tooltip, responsive, анимации |
| Bytes formatting | `bytes / 1024 / 1024 + "MB"` | Utility-функция с правильными единицами | Правильное округление, locale, KiB vs KB |
| WebSocket reconnect | Ручной setTimeout | Custom hook с ref + cleanup | Memory leaks при неправильном cleanup |
| Toggle between views | Кастомные radio кнопки | shadcn/ui ToggleGroup | Единый стиль, accessibility |

**Key insight:** Для 5 метрик + 1 графика + управление сервисом нужна аккуратная композиция существующих компонентов, а не кастомные решения.

## Common Pitfalls

### Pitfall 1: WebSocket Memory Leak
**What goes wrong:** Компонент размонтируется, но WebSocket остаётся открытым и продолжает получать данные
**Why it happens:** useEffect cleanup не закрывает соединение или ref теряется
**How to avoid:** Закрывать ws в useEffect return, хранить в useRef, не в state
**Warning signs:** Растущее потребление памяти, ошибки "Can't perform a React state update on an unmounted component"

### Pitfall 2: Zustand State Update Batching
**What goes wrong:** WebSocket шлёт данные каждую секунду, каждый set() триггерит ре-рендер всех подписчиков
**Why it happens:** Zustand по умолчанию оповещает подписчиков при каждом set()
**How to avoid:** Использовать selective subscriptions: `useOverviewStore(s => s.uploadSpeed)` вместо `useOverviewStore()`. Batch-обновление через один set() с несколькими полями
**Warning signs:** FPS просадки при включенном стриминге

### Pitfall 3: WebSocket Auth Token Exposure
**What goes wrong:** Secret передаётся в URL query parameter, видно в логах
**Why it happens:** Mihomo требует `?token=SECRET` для WebSocket
**How to avoid:** Это стандартный подход mihomo, все дашборды так делают. Не логировать URL с токеном
**Warning signs:** N/A -- это нормально для локальной сети

### Pitfall 4: Blocking Service Actions
**What goes wrong:** xkeen start/stop может занять 5-30 секунд, Flask worker заблокирован
**Why it happens:** subprocess.run без timeout, или init.d скрипт ждёт завершения процесса
**How to avoid:** Использовать timeout=30 в subprocess.run, показывать спиннер на фронте
**Warning signs:** Timeout ошибки, зависший UI без обратной связи

### Pitfall 5: Stale Closure in WebSocket onMessage
**What goes wrong:** WebSocket callback захватывает старое значение state/props
**Why it happens:** closure в onmessage не обновляется при ре-рендере
**How to avoid:** Использовать useRef для callback или обновлять через store (Zustand) вместо setState
**Warning signs:** Данные "замораживаются" после первого рендера

### Pitfall 6: Race Condition при Service Status
**What goes wrong:** После нажатия "Restart" статус показывает "Stopped" на секунду, потом "Running"
**Why it happens:** Polling статуса видит промежуточное состояние
**How to avoid:** Оптимистичный UI: показать "Restarting..." пока не получим подтверждение; добавить debounce для polling после action
**Warning signs:** "Мигающий" статус после действий

## Code Examples

### Traffic Chart (recharts LineChart)
```typescript
// src/components/overview/TrafficChart.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useOverviewStore } from '@/stores/overview'
import { formatSpeed } from '@/lib/format'

export function TrafficChart() {
  const history = useOverviewStore((s) => s.trafficHistory)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={history}>
        <XAxis dataKey="time" hide />
        <YAxis
          tickFormatter={(v) => formatSpeed(v)}
          width={70}
        />
        <Tooltip
          formatter={(v: number) => formatSpeed(v)}
          labelFormatter={() => ''}
        />
        <Line
          type="monotone"
          dataKey="up"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          name="Upload"
        />
        <Line
          type="monotone"
          dataKey="down"
          stroke="hsl(var(--chart-2))"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          name="Download"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

### Format Utilities
```typescript
// src/lib/format.ts
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${UNITS[i]}`
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}

export function formatUptime(startTime: number | null): string {
  if (!startTime) return '--'
  const diff = Math.floor((Date.now() - startTime) / 1000)
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  const seconds = diff % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
```

### Mihomo API Client
```typescript
// src/lib/mihomo-api.ts
import { useSettingsStore } from '@/stores/settings'

function getHeaders(): Record<string, string> {
  const secret = useSettingsStore.getState().mihomoSecret
  const headers: Record<string, string> = {}
  if (secret) {
    headers['Authorization'] = `Bearer ${secret}`
  }
  return headers
}

function getBaseUrl(): string {
  return useSettingsStore.getState().mihomoApiUrl
}

export async function fetchMihomoVersion(): Promise<{ version: string; meta: boolean }> {
  const res = await fetch(`${getBaseUrl()}/version`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  return res.json()
}

export async function upgradeCore(channel?: string): Promise<{ status: string }> {
  const url = channel
    ? `${getBaseUrl()}/upgrade?channel=${channel}`
    : `${getBaseUrl()}/upgrade`
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    signal: AbortSignal.timeout(120000), // обновление может занять время
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Upgrade failed')
  }
  return res.json()
}

export async function restartMihomo(): Promise<void> {
  await fetch(`${getBaseUrl()}/restart`, {
    method: 'POST',
    headers: getHeaders(),
    signal: AbortSignal.timeout(10000),
  })
}
```

### Config API Client (Service Management)
```typescript
// src/lib/config-api.ts
import { useSettingsStore } from '@/stores/settings'

function getBaseUrl(): string {
  return useSettingsStore.getState().configApiUrl
}

export type ServiceAction = 'start' | 'stop' | 'restart'

export async function serviceAction(action: ServiceAction): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/service/${action}`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Failed to ${action} service`)
  }
}

export async function fetchServiceStatus(): Promise<{
  running: boolean
  pid: number | null
}> {
  const res = await fetch(`${getBaseUrl()}/api/service/status`, {
    signal: AbortSignal.timeout(5000),
  })
  return res.json()
}

export async function fetchVersions(): Promise<{
  xkeen: string
  dashboard: string
}> {
  const res = await fetch(`${getBaseUrl()}/api/versions`, {
    signal: AbortSignal.timeout(5000),
  })
  return res.json()
}
```

## Claude's Discretion Recommendations

| Area | Recommendation | Rationale |
|------|---------------|-----------|
| Интервал обновления метрик | **1 секунда** | Mihomo WebSocket отдаёт данные каждую секунду; совпадает с zashboard |
| Глубина истории графика | **60 точек (1 минута)** | Как в zashboard; достаточно для визуализации тренда без перегрузки |
| Стиль карточек метрик | Минимальный -- число + label + иконка; без тяжёлых анимаций | Данные обновляются каждую секунду, анимации будут мешать |
| Обработка ошибок API | Retry с экспоненциальным backoff для WS; toast для REST ошибок | WS может разрываться часто на нестабильной сети |
| Loading состояния | Skeleton компоненты (уже есть в проекте) | Быстрая загрузка, нет "мигания" пустых карточек |
| Error состояния | Banner с ошибкой + кнопка "Повторить" поверх Overview | Не блокировать весь UI при потере одного соединения |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling /traffic каждые N сек | WebSocket /traffic стрим | Clash original | Меньше overhead, реальные real-time данные |
| Отдельные REST для каждой метрики | WebSocket для streaming + REST для actions | Mihomo v1.18+ | upTotal/downTotal добавлены в /traffic WS |
| Ручное управление ws | React hooks + useRef | React 18+ | Правильный cleanup, нет memory leaks |
| Full D3.js charts | recharts (React wrapper) | 2020+ | Декларативный JSX, tree-shaking, меньше кода |

**Deprecated/outdated:**
- `reconnecting-websocket` npm пакет: не обновлялся с 2019, лучше написать свой hook с useRef
- `/traffic` без `upTotal`/`downTotal`: старые версии mihomo не включали total -- текущие версии включают

## Open Questions

1. **Точное имя init.d скрипта xkeen**
   - What we know: По исходному коду xkeen, используется `/opt/etc/init.d/S24xray`
   - What's unclear: На установках с mihomo (не xray) скрипт может быть другим (S24mihomo?)
   - Recommendation: Сделать имя скрипта конфигурируемым через env-переменную `XKEEN_INIT_SCRIPT` в Flask

2. **Проверка доступных обновлений mihomo**
   - What we know: POST /upgrade обновляет ядро. GET /version даёт текущую версию
   - What's unclear: Нет встроенного эндпоинта "проверить доступные обновления" без установки
   - Recommendation: Проверять через GitHub Releases API: `https://api.github.com/repos/MetaCubeX/mihomo/releases/latest`

3. **Версия xkeen**
   - What we know: `xkeen -status` или парсинг вывода xkeen
   - What's unclear: Точный формат вывода для парсинга версии
   - Recommendation: Backend парсит `xkeen -v` или читает version файл, возвращает строку

4. **Uptime mihomo**
   - What we know: Mihomo API не имеет прямого эндпоинта uptime
   - What's unclear: Нет endpoint для получения времени старта процесса
   - Recommendation: Засекать время первого успешного подключения на клиенте; или backend может читать uptime из /proc

## Sources

### Primary (HIGH confidence)
- Mihomo source code (server.go) -- Exact API routes, traffic/memory/version JSON formats
- Mihomo source code (connections.go) -- Connection snapshot format, WebSocket interval
- Mihomo source code (upgrade.go) -- Upgrade flow, request/response format
- Zashboard source (src/api/index.ts) -- All REST/WS endpoints verified
- Zashboard source (src/types/index.d.ts) -- Connection type definitions
- Zashboard source (src/store/overview.ts) -- 60-point rolling window pattern

### Secondary (MEDIUM confidence)
- [DeepWiki MetaCubeXD API](https://deepwiki.com/MetaCubeX/metacubexd/2.2-api-and-websocket-communication) -- API endpoint catalog
- [XKeen GitHub](https://github.com/Skrill0/XKeen/blob/main/xkeen) -- xkeen commands: -start, -stop, -restart, -status
- [XKeen-UI GitHub](https://github.com/zxc-rv/XKeen-UI) -- init.d script path S99xkeen-ui
- [Recharts GitHub](https://github.com/recharts/recharts) -- Bundle size ~50KB gzipped
- [Mihomo wiki](https://wiki.metacubex.one/en/config/general/) -- External controller configuration

### Tertiary (LOW confidence)
- Exact xkeen init.d script name may vary per installation (S24xray vs custom)
- GitHub Releases API for update checking -- needs validation against actual mihomo release format

## Metadata

**Confidence breakdown:**
- Mihomo API (traffic/memory/version): HIGH -- verified from source code
- Mihomo API (connections snapshot): MEDIUM -- fields from zashboard types, not from Go source directly
- xkeen service management: MEDIUM -- commands verified from xkeen script, init.d path may vary
- recharts integration: HIGH -- well-documented, widely used, suitable for 60-point dataset
- Backend Flask extensions: HIGH -- straightforward subprocess.run pattern

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (mihomo API stable, xkeen commands stable)
