# Phase 3: Proxies Page - Research

**Researched:** 2026-02-27
**Domain:** Mihomo REST API (proxies, groups, delay testing), React карточная UI, Zustand state management
**Confidence:** HIGH

## Summary

Фаза 3 реализует страницу Proxies -- отображение proxy-групп как карточек с возможностью переключения активного прокси и тестирования задержки. Mihomo предоставляет полный REST API для работы с прокси: `GET /proxies` возвращает все прокси и группы в виде Record, `PUT /proxies/:name` переключает активный прокси в группе типа Selector, `GET /proxies/:name/delay` тестирует задержку отдельного прокси, `GET /group/:name/delay` -- массовый тест всех прокси в группе.

Ключевая особенность дизайна -- высокая кастомизируемость: настраиваемая сетка (1-3 карточки в ряд), три уровня плотности информации, сортировка прокси, стили типов групп. Все настройки хранятся в persisted Zustand store. Для карточек используется паттерн inline expand -- карточка разворачивается вниз в гриде, показывая полный список прокси группы. Переключение прокси мгновенное (клик = переключение), без диалога подтверждения.

Для тостов об успехе/ошибке переключения нужно установить sonner (рекомендуемый shadcn/ui компонент для уведомлений). Для поповера настроек нужен shadcn/ui Popover. Для скроллируемого списка прокси внутри раскрытой карточки -- ScrollArea. Кеширование результатов задержки 15 секунд на клиенте предотвращает перегрузку роутера.

**Primary recommendation:** Создать `proxies` Zustand store для данных прокси, расширить `mihomo-api.ts` новыми эндпоинтами, реализовать карточки групп с inline expand на базе shadcn/ui Card + Badge + Skeleton, использовать sonner для тостов переключения.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Настраиваемая сетка: пользователь выбирает 1, 2 или 3 карточки в ряд
- Три уровня плотности информации (переключаемые пользователем):
  - Минимум: имя группы + текущий прокси + тип группы
  - Средне: + задержка + кол-во прокси в группе
  - Максимум: + иконка группы + мини-список топ-3 прокси по задержке
- Раскрытие карточки на месте (inline expand) -- карточка разворачивается вниз в гриде, показывая полный список прокси
- Переключаемая сортировка прокси внутри раскрытой карточки: по имени / по задержке / как в конфиге
- Клик по прокси в раскрытой карточке -- мгновенное переключение
- Без диалога подтверждения -- клик = переключение (как в zashboard)
- Мгновенное выделение активного прокси + тост-уведомление об успехе/ошибке
- Активный прокси выделен цветовым акцентом (primary/accent цвет), остальные приглушены
- Автотест при раскрытии карточки, но с кешированием результатов на 15 секунд
- Отображение: значение в ms с цветовой маркировкой (зелёный < 100ms, жёлтый < 300ms, красный остальное)
- Массовый тест: глобальная кнопка "Тестировать все" на странице + кнопка "Тест" по каждой группе
- Недоступные прокси (timeout) показываются с меткой "timeout" и красным цветом
- Визуальное различие типов -- настраиваемое пользователем (бейдж, цвет рамки, иконка -- на выбор)
- Ручное переключение прокси только для select; url-test/fallback показывают текущий автоматический выбор
- Дополнительная информация для автоматических групп (интервал проверки, URL теста, tolerance) -- настраиваемое отображение
- Настройки отображения -- кнопка-шестерёнка на странице Proxies с поповером
- Поиск по имени группы и имени прокси
- Фильтр по типу группы (select, url-test, fallback, load-balance)

### Claude's Discretion
- Конкретные пороги цветов задержки (100ms/300ms как ориентир, можно скорректировать)
- Дизайн поповера настроек
- Анимация раскрытия карточки
- Spinner/skeleton при загрузке тестов задержки

### Deferred Ideas (OUT OF SCOPE)
- Пользовательские категории/списки с drag-and-drop перемещением блоков групп для удобной организации -- Phase 7 (Groups Editor) или отдельная фаза
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROX-01 | Proxy-groups displayed as cards with current proxy selection | GET /proxies API возвращает все группы с полями `type`, `now`, `all`; Card компонент с настраиваемой сеткой и плотностью |
| PROX-02 | User can switch active proxy within a group | PUT /proxies/:name с body `{"name":"proxy_name"}` для групп типа Selector; 204 = успех; тост-уведомление через sonner |
| PROX-03 | User can run latency test on individual proxies | GET /proxies/:name/delay?url=URL&timeout=MS возвращает `{"delay": number}`; GET /group/:name/delay для массового теста; кеширование 15 сек |
</phase_requirements>

## Mihomo Proxy API Reference

### REST Endpoints (HIGH confidence -- verified from official docs)

| Endpoint | Method | Request | Response | Purpose |
|----------|--------|---------|----------|---------|
| `/proxies` | GET | -- | `{ proxies: Record<string, Proxy> }` | Все прокси и группы |
| `/proxies/:name` | GET | -- | `Proxy` object | Конкретный прокси/группа |
| `/proxies/:name` | PUT | `{"name":"proxy"}` | 204 No Content | Переключить прокси в Selector группе |
| `/proxies/:name` | DELETE | -- | 204 | Сбросить фиксированный выбор автогруппы |
| `/proxies/:name/delay` | GET | `?url=URL&timeout=5000` | `{"delay": 200}` | Тест задержки одного прокси |
| `/group/:name/delay` | GET | `?url=URL&timeout=5000` | `Record<string, number>` | Тест задержки всех прокси в группе |

### Proxy Object Structure (HIGH confidence -- verified from zashboard types + official docs)

```typescript
interface ProxyHistory {
  time: string    // ISO timestamp
  delay: number   // milliseconds, 0 = not connected
}

interface Proxy {
  name: string
  type: string          // "Direct" | "Reject" | "Selector" | "URLTest" | "Fallback" | "LoadBalance" | "Shadowsocks" | "Vmess" | "Trojan" | etc.
  now?: string          // Текущий выбранный прокси (для групп Selector, URLTest, Fallback)
  all?: string[]        // Список прокси в группе (для Selector, URLTest, Fallback, LoadBalance)
  history: ProxyHistory[]  // История задержки
  udp?: boolean
  xudp?: boolean
  icon?: string         // URL иконки группы
  hidden?: boolean      // Скрыта ли группа
  testUrl?: string      // URL для тестирования
  fixed?: string        // Фиксированный выбор
  extra?: Record<string, { history: ProxyHistory[] }>  // Доп. данные по URL тестов
}

// GET /proxies response
interface ProxiesResponse {
  proxies: Record<string, Proxy>
}
```

### Error Responses

```typescript
// 400 Bad Request
{ "error": "Format error" }
{ "error": "Proxy can't update" }  // для не-Selector групп

// 404 Not Found
{ "error": "Proxy not found" }

// 408 Request Timeout (delay test)
{ "error": "Proxy delay test timeout" }
```

### Proxy Group Types

| Type | API type string | Поведение переключения | Доп. информация |
|------|----------------|----------------------|-----------------|
| Select | `"Selector"` | Ручное переключение через PUT | `now` = выбранный прокси |
| URL-Test | `"URLTest"` | Автоматический выбор по минимальной задержке | `now` = автовыбор, interval, tolerance |
| Fallback | `"Fallback"` | Автоматический выбор первого доступного | `now` = первый доступный |
| Load-Balance | `"LoadBalance"` | Распределение нагрузки | Нет `now`, нельзя переключать |
| Smart | `"Smart"` | Умный выбор (mihomo Meta) | Эвристики на основе весов |

### Определение группы vs прокси

Прокси считается **группой**, если у него есть поле `all` (массив дочерних прокси). Обычные прокси (Shadowsocks, Vmess, Trojan и т.д.) не имеют поля `all`.

### Ключевые правила взаимодействия

1. **PUT переключение работает ТОЛЬКО для Selector** -- для URLTest/Fallback/LoadBalance/Smart API вернёт ошибку
2. **DELETE сбрасывает фиксацию** автоматических групп (возвращает к авто-выбору)
3. **Имена в URL должны быть URL-encoded** (encodeURIComponent) -- имена могут содержать кириллицу, emoji, пробелы
4. **Default test URL** -- `https://www.gstatic.com/generate_204` (используется zashboard и metacubexd)
5. **Default timeout** -- 5000ms (5 секунд)

## Standard Stack

### Core (уже в проекте)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.0 | UI framework | Уже установлен |
| Zustand | ^5.0.11 | State management | Уже используется для settings/overview stores |
| shadcn/ui + Radix | ^1.4.3 | UI components | Card, Badge, Button, Skeleton, Input, ToggleGroup уже доступны |
| lucide-react | ^0.575.0 | Icons | Уже установлен |
| Tailwind CSS | ^4.2.1 | Styling | Уже установлен |

### Новые shadcn/ui компоненты (установка через CLI)
| Component | Purpose | Обоснование |
|-----------|---------|-------------|
| sonner | Тост-уведомления об успехе/ошибке переключения | Рекомендуемый shadcn/ui компонент для тостов (заменяет устаревший toast) |
| popover | Поповер настроек отображения (сетка, плотность, сортировка) | Лёгкий выпадающий UI без модального оверлея |
| scroll-area | Скроллируемый список прокси в раскрытой карточке | Стилизованный scrollbar, кросс-браузерность |
| collapsible | Анимированное раскрытие/сворачивание карточки (inline expand) | Radix Collapsible с анимацией высоты |

### Новых npm-зависимостей НЕ нужно

Всё необходимое уже есть в проекте или устанавливается через shadcn CLI (sonner -- единственная новая npm-зависимость, добавляется автоматически при установке компонента).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sonner (через shadcn) | react-hot-toast | sonner -- рекомендация shadcn/ui, лучше интеграция со стилями |
| Radix Collapsible | CSS transition на max-height | Radix даёт accessibility + анимация через data-state; CSS max-height не знает реальную высоту |
| Zustand store для настроек прокси | localStorage напрямую | Zustand persist уже используется в проекте, единообразие |

**Installation:**
```bash
npx shadcn@latest add sonner popover scroll-area collapsible
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── proxies/
│   │   ├── ProxyGroupCard.tsx       # Карточка группы (свёрнутая + развёрнутая)
│   │   ├── ProxyNodeItem.tsx        # Элемент прокси в развёрнутом списке
│   │   ├── ProxyLatencyBadge.tsx    # Бейдж задержки с цветовой маркировкой
│   │   ├── ProxiesToolbar.tsx       # Тулбар: поиск, фильтр, кнопка настроек, кнопка "Тестировать все"
│   │   └── ProxiesSettingsPopover.tsx # Поповер настроек (сетка, плотность, сортировка, стили типов)
│   └── ui/
│       ├── sonner.tsx               # новый shadcn/ui
│       ├── popover.tsx              # новый shadcn/ui
│       ├── scroll-area.tsx          # новый shadcn/ui
│       └── collapsible.tsx          # новый shadcn/ui
├── stores/
│   ├── settings.ts                  # расширить: настройки proxies page
│   └── proxies.ts                   # НОВЫЙ: данные прокси, задержки, состояние UI
├── lib/
│   ├── mihomo-api.ts                # расширить: fetchProxies, selectProxy, proxyDelay, groupDelay
│   └── format.ts                    # расширить: formatDelay
├── hooks/
│   └── (без новых хуков -- логика в store)
└── pages/
    └── ProxiesPage.tsx              # заменить placeholder
```

### Pattern 1: Proxies Zustand Store
**What:** Volatile (не-persisted) store для данных прокси, кеша задержки, состояния UI раскрытых карточек
**When to use:** Хранение данных от GET /proxies, результатов тестов задержки, списка раскрытых карточек
**Example:**
```typescript
// src/stores/proxies.ts
import { create } from 'zustand'

interface ProxyGroup {
  name: string
  type: string
  now: string | null
  all: string[]
  icon?: string
  hidden?: boolean
  testUrl?: string
}

interface DelayResult {
  delay: number       // ms, 0 = not connected/timeout
  testedAt: number    // Date.now() timestamp
}

interface ProxiesState {
  // Данные
  proxyMap: Record<string, Proxy>          // все прокси по имени
  groupNames: string[]                      // отсортированный список имён групп
  delayCache: Record<string, DelayResult>  // кеш задержки по имени прокси

  // UI состояние
  expandedGroups: Set<string>              // раскрытые карточки
  loading: boolean
  testingGroups: Set<string>               // группы в процессе теста
  testingProxies: Set<string>              // прокси в процессе теста

  // Actions
  setProxies: (data: ProxiesResponse) => void
  toggleExpand: (groupName: string) => void
  updateDelay: (proxyName: string, delay: number) => void
  setGroupTesting: (groupName: string, testing: boolean) => void
  setProxyTesting: (proxyName: string, testing: boolean) => void
  selectProxy: (groupName: string, proxyName: string) => void
}
```

### Pattern 2: Settings Extension для Proxies Page
**What:** Persisted настройки отображения прокси-страницы в settings store
**When to use:** Сетка, плотность, сортировка, стили типов -- должны сохраняться между сессиями
**Example:**
```typescript
// Расширение settings.ts
interface ProxiesPageSettings {
  proxiesGridColumns: 1 | 2 | 3             // карточек в ряд
  proxiesDensity: 'min' | 'mid' | 'max'     // уровень плотности
  proxiesSort: 'name' | 'delay' | 'default' // сортировка внутри карточки
  proxiesTypeStyle: 'badge' | 'border' | 'icon' // визуальное различие типов
  proxiesShowAutoInfo: boolean               // доп. информация для автогрупп
}
```

### Pattern 3: Inline Expand с Collapsible
**What:** Карточка группы разворачивается на месте в гриде
**When to use:** При клике на карточку -- показать полный список прокси группы
**Example:**
```typescript
// ProxyGroupCard.tsx -- упрощённая структура
<Card className={cn("transition-all", isExpanded && "col-span-full")}>
  <CardHeader onClick={() => toggleExpand(group.name)}>
    {/* Свёрнутая информация: имя, тип, текущий прокси */}
  </CardHeader>
  <Collapsible open={isExpanded}>
    <CollapsibleContent>
      <ScrollArea className="max-h-[400px]">
        {/* Список прокси с кнопками переключения */}
        {sortedProxies.map(proxy => (
          <ProxyNodeItem
            key={proxy}
            name={proxy}
            isActive={proxy === group.now}
            canSelect={group.type === 'Selector'}
            onSelect={() => handleSelect(group.name, proxy)}
          />
        ))}
      </ScrollArea>
    </CollapsibleContent>
  </Collapsible>
</Card>
```

### Pattern 4: Delay Cache с TTL
**What:** Клиентский кеш результатов тестов задержки с TTL 15 секунд
**When to use:** Предотвращение повторных запросов при раскрытии/сворачивании карточек
**Example:**
```typescript
const DELAY_CACHE_TTL = 15_000 // 15 секунд

function isDelayCacheValid(proxyName: string): boolean {
  const cached = useProxiesStore.getState().delayCache[proxyName]
  if (!cached) return false
  return Date.now() - cached.testedAt < DELAY_CACHE_TTL
}

async function testProxyDelay(proxyName: string): Promise<number> {
  if (isDelayCacheValid(proxyName)) {
    return useProxiesStore.getState().delayCache[proxyName].delay
  }
  const result = await fetchProxyDelay(proxyName, TEST_URL, 5000)
  useProxiesStore.getState().updateDelay(proxyName, result.delay)
  return result.delay
}
```

### Pattern 5: Цветовая маркировка задержки
**What:** Отображение задержки с цветом в зависимости от значения
**When to use:** Везде, где отображается задержка -- в списке прокси, в мини-списке топ-3
**Example:**
```typescript
// src/components/proxies/ProxyLatencyBadge.tsx
function getDelayColor(delay: number): string {
  if (delay === 0) return 'text-destructive'        // timeout / not connected
  if (delay < 100) return 'text-green-500'           // отлично
  if (delay < 300) return 'text-yellow-500'          // нормально
  return 'text-red-500'                              // плохо
}

function getDelayText(delay: number | undefined): string {
  if (delay === undefined) return '--'
  if (delay === 0) return 'timeout'
  return `${delay}ms`
}
```

### Anti-Patterns to Avoid
- **Polling GET /proxies каждые N секунд:** Данные прокси не меняются сами по себе -- загружать один раз при входе на страницу + рефрешить по кнопке или после переключения
- **Все тесты задержки одновременно:** Массовый тест всех прокси одновременно перегрузит роутер -- использовать sequential или batch по 3-5 штук
- **Хранение expanded state в URL:** URL query params для UI состояния карточек -- overkill, Zustand volatile store достаточно
- **`col-span-full` без обёртки:** При inline expand карточка должна занимать полную ширину грида, но CSS grid reflow может быть некрасивым -- использовать `order` для правильного позиционирования
- **Не кодировать имена в URL:** Имена прокси/групп часто содержат кириллицу, emoji, пробелы -- ОБЯЗАТЕЛЬНО `encodeURIComponent()`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast уведомления | Кастомный toast | sonner (через shadcn/ui) | Анимации, stacking, swipe-to-dismiss, accessibility |
| Dropdown настроек | Кастомный dropdown | shadcn/ui Popover | Positioning, portal, focus trap |
| Scrollable list | `overflow-y: auto` | shadcn/ui ScrollArea | Стилизованный scrollbar, кросс-браузерность |
| Expand/collapse animation | CSS `max-height` transition | Radix Collapsible | Не нужно знать реальную высоту, data-state для анимации |
| Debounce поиска | setTimeout вручную | Inline filtering без debounce | Фильтрация локальных данных (~100 элементов) -- мгновенная, debounce не нужен |
| URL encoding | String concatenation | `encodeURIComponent()` | Кириллица, emoji, спецсимволы в именах прокси |

**Key insight:** Вся необходимая UI-инфраструктура уже есть в shadcn/ui -- Card, Badge, Button, Input, Skeleton, ToggleGroup. Нужно только добавить sonner, popover, scroll-area, collapsible.

## Common Pitfalls

### Pitfall 1: URL-кодирование имён прокси
**What goes wrong:** PUT/GET запросы с некодированными именами возвращают 404 "Proxy not found"
**Why it happens:** Имена прокси/групп часто содержат кириллицу, emoji, пробелы, скобки
**How to avoid:** ВСЕГДА использовать `encodeURIComponent(name)` в URL-пути
**Warning signs:** 404 ошибки на прокси с нелатинскими именами

### Pitfall 2: Попытка переключить прокси в не-Selector группе
**What goes wrong:** PUT /proxies/:name возвращает 400 "Proxy can't update"
**Why it happens:** URLTest, Fallback, LoadBalance группы управляются автоматически
**How to avoid:** Проверять `group.type === 'Selector'` перед показом кнопки переключения; для других типов показывать текущий автоматический выбор как read-only
**Warning signs:** Ошибки при клике на прокси в автоматических группах

### Pitfall 3: Перегрузка роутера массовыми тестами задержки
**What goes wrong:** Одновременный тест 50+ прокси вызывает таймауты и ошибки на роутере
**Why it happens:** Каждый тест задержки -- это реальный HTTP-запрос через прокси; роутер с ограниченными ресурсами
**How to avoid:** Использовать `GET /group/:name/delay` для массового теста (mihomo сам управляет concurrency); кешировать результаты 15 секунд; для "Тестировать все" -- последовательно по группам
**Warning signs:** Массовые timeout при нажатии "Тестировать все"

### Pitfall 4: Stale данные после переключения прокси
**What goes wrong:** После PUT переключения карточка показывает старый `now`
**Why it happens:** Оптимистичное обновление не применено или рефреш данных запаздывает
**How to avoid:** Оптимистичное обновление `now` в store сразу после успешного PUT (204); откат при ошибке
**Warning signs:** Визуальная задержка смены активного прокси

### Pitfall 5: GLOBAL группа и hidden группы
**What goes wrong:** Отображаются служебные группы (GLOBAL, скрытые) которые пользователю не нужны
**Why it happens:** GET /proxies возвращает ВСЕ группы включая GLOBAL
**How to avoid:** Фильтровать GLOBAL группу из отображения; проверять `hidden !== true`
**Warning signs:** Лишние карточки в UI, GLOBAL группа дублирует содержимое

### Pitfall 6: Grid reflow при inline expand
**What goes wrong:** Когда карточка раскрывается и становится `col-span-full`, остальные карточки "прыгают"
**Why it happens:** CSS Grid перестраивает layout при изменении span элементов
**How to avoid:** Раскрытая карточка должна занимать `col-span-full` и визуально "раздвигать" грид вниз; можно использовать `order` CSS property чтобы раскрытая карточка была последней в своём ряду
**Warning signs:** "Прыгающие" карточки при раскрытии/сворачивании

## Code Examples

### API-клиент для прокси (расширение mihomo-api.ts)

```typescript
// Source: Verified from official mihomo docs + zashboard implementation

const DEFAULT_TEST_URL = 'https://www.gstatic.com/generate_204'
const DEFAULT_TIMEOUT = 5000

/**
 * Fetch all proxies and groups.
 */
export async function fetchProxies(): Promise<{
  proxies: Record<string, Proxy>
}> {
  const res = await fetch(`${getBaseUrl()}/proxies`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(5000),
  })
  return res.json()
}

/**
 * Switch active proxy in a Selector group.
 * Returns true on success (204), throws on error.
 */
export async function selectProxy(
  groupName: string,
  proxyName: string
): Promise<void> {
  const res = await fetch(
    `${getBaseUrl()}/proxies/${encodeURIComponent(groupName)}`,
    {
      method: 'PUT',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: proxyName }),
      signal: AbortSignal.timeout(5000),
    }
  )
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to select proxy')
  }
}

/**
 * Test delay for a single proxy.
 * Returns { delay: number } -- delay in ms, or throws on timeout/error.
 */
export async function fetchProxyDelay(
  proxyName: string,
  url: string = DEFAULT_TEST_URL,
  timeout: number = DEFAULT_TIMEOUT
): Promise<{ delay: number }> {
  const params = new URLSearchParams({ url, timeout: String(timeout) })
  const res = await fetch(
    `${getBaseUrl()}/proxies/${encodeURIComponent(proxyName)}/delay?${params}`,
    {
      headers: getHeaders(),
      signal: AbortSignal.timeout(timeout + 2000), // extra buffer
    }
  )
  if (!res.ok) {
    // 408 = timeout
    if (res.status === 408) return { delay: 0 }
    const data = await res.json()
    throw new Error(data.error || 'Delay test failed')
  }
  return res.json()
}

/**
 * Test delay for all proxies in a group.
 * Returns Record<proxyName, delay>.
 */
export async function fetchGroupDelay(
  groupName: string,
  url: string = DEFAULT_TEST_URL,
  timeout: number = DEFAULT_TIMEOUT
): Promise<Record<string, number>> {
  const params = new URLSearchParams({ url, timeout: String(timeout) })
  const res = await fetch(
    `${getBaseUrl()}/group/${encodeURIComponent(groupName)}/delay?${params}`,
    {
      headers: getHeaders(),
      signal: AbortSignal.timeout(timeout + 5000), // longer buffer for group
    }
  )
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Group delay test failed')
  }
  return res.json()
}
```

### Sonner Toast Setup

```typescript
// 1. Установить: npx shadcn@latest add sonner
// 2. Добавить <Toaster /> в App.tsx (в корень, рядом с BrowserRouter)
// 3. Использовать:

import { toast } from 'sonner'

// При успешном переключении
toast.success(`Переключено на ${proxyName}`)

// При ошибке
toast.error(`Ошибка: ${error.message}`)
```

### Форматирование задержки (расширение format.ts)

```typescript
/**
 * Format delay in milliseconds to display string.
 * 0 or undefined = timeout/not tested.
 */
export function formatDelay(delay: number | undefined): string {
  if (delay === undefined) return '--'
  if (delay === 0) return 'timeout'
  return `${delay}ms`
}
```

### Фильтрация групп из API-ответа

```typescript
/**
 * Extract proxy groups from raw proxies response.
 * Filters out non-groups, GLOBAL, and hidden groups.
 */
function extractGroups(
  proxies: Record<string, Proxy>
): ProxyGroup[] {
  return Object.values(proxies)
    .filter(p =>
      p.all !== undefined &&           // Это группа (есть all)
      p.name !== 'GLOBAL' &&           // Не GLOBAL
      p.hidden !== true                 // Не скрытая
    )
    .map(p => ({
      name: p.name,
      type: p.type,
      now: p.now ?? null,
      all: p.all!,
      icon: p.icon,
      hidden: p.hidden,
      testUrl: p.testUrl,
    }))
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling GET /proxies | Fetch once + refresh on action | Зашвабод/metacubexd | Меньше нагрузка, данные обновляются по событию |
| `/proxies/:name/delay` для каждого прокси | `/group/:name/delay` массовый тест | Mihomo Meta | Один запрос вместо N, mihomo сам управляет concurrency |
| toast компонент shadcn/ui | sonner (через shadcn) | 2024 | shadcn/ui deprecated свой toast в пользу sonner |
| Кастомный dropdown settings | Radix Popover | -- | Accessibility, positioning из коробки |

**Deprecated/outdated:**
- shadcn/ui `toast` компонент: заменён на `sonner` -- НЕ использовать `npx shadcn add toast`
- `reconnecting-websocket` npm пакет: не обновлялся с 2019 (но для этой фазы WS не нужен)

## Open Questions

1. **Поведение раскрытой карточки в гриде**
   - What we know: `col-span-full` заставит карточку занять всю ширину грида
   - What's unclear: Как именно грид перестраивается -- другие карточки сдвигаются вниз или остаются на месте?
   - Recommendation: Использовать `col-span-full` для раскрытой карточки; CSS grid автоматически сдвигает остальные вниз. Если нужен более плавный эффект -- рассмотреть вариант без col-span-full, когда раскрытое содержимое показывается под карточкой в её текущей ширине (со ScrollArea для длинных списков)

2. **Количество прокси в типичной конфигурации**
   - What we know: zashboard использует VirtualScroller для длинных списков
   - What's unclear: Сколько прокси обычно в одной группе? Если 100+ -- нужна виртуализация
   - Recommendation: Начать без виртуализации, использовать ScrollArea с max-height. Если производительность проблема -- добавить виртуализацию позже

3. **Настройки proxies page -- отдельный store или расширение settings?**
   - What we know: Settings store уже persisted; overview store -- volatile
   - What's unclear: Лучше ли выделить proxies settings в отдельный persisted store?
   - Recommendation: Расширить существующий settings store -- единый persisted store для всех настроек, меньше файлов, проще гидрация

## Sources

### Primary (HIGH confidence)
- [Clash Proxies REST API](https://clash.gitbook.io/doc/restful-api/proxies) -- все 4 endpoint-а (GET proxies, GET proxy, PUT proxy, GET delay), форматы запросов/ответов
- [Mihomo API docs](https://wiki.metacubex.one/en/api/) -- расширенные эндпоинты (group delay, providers), auth формат
- [Zashboard API source](https://raw.githubusercontent.com/Zephyruso/zashboard/main/src/api/index.ts) -- fetchProxiesAPI, selectProxyAPI, fetchProxyLatencyAPI, fetchProxyGroupLatencyAPI
- [Zashboard types](https://raw.githubusercontent.com/Zephyruso/zashboard/main/src/types/index.d.ts) -- Proxy interface с полями name, type, now, all, history, extra, icon, hidden, udp, xudp, fixed, testUrl
- [Zashboard constants](https://raw.githubusercontent.com/Zephyruso/zashboard/main/src/constant/index.ts) -- PROXY_TYPE enum, NOT_CONNECTED = 0, TEST_URL

### Secondary (MEDIUM confidence)
- [Zashboard proxy store](https://raw.githubusercontent.com/Zephyruso/zashboard/main/src/store/proxies.ts) -- data model, fetch/select/delay patterns via DeepWiki
- [Mihomo proxy-groups config](https://wiki.metacubex.one/en/config/proxy-groups/) -- Group config fields (icon, hidden, url, interval, tolerance, lazy)
- [shadcn/ui Sonner docs](https://ui.shadcn.com/docs/components/radix/sonner) -- Installation, setup, usage

### Tertiary (LOW confidence)
- Exact behavior of `col-span-full` в CSS grid при inline expand -- нужно тестировать на реальном layout
- VirtualScroller необходимость -- зависит от типичного кол-ва прокси у пользователя

## Metadata

**Confidence breakdown:**
- Mihomo Proxy API: HIGH -- verified from official docs + 2 dashboard implementations (zashboard, metacubexd)
- Proxy data model: HIGH -- Proxy interface verified from zashboard types
- UI patterns (cards, expand, settings): MEDIUM -- дизайн основан на context decisions, конкретная реализация грида нуждается в тестировании
- Shadcn/ui components: HIGH -- sonner, popover, scroll-area, collapsible есть в shadcn registry
- Delay caching: MEDIUM -- 15 сек TTL из context decisions, реализация стандартная но не обкатана

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (mihomo API stable, shadcn/ui components stable)
