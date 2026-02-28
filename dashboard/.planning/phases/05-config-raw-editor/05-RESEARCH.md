# Phase 5: Config Raw Editor - Research

**Researched:** 2026-02-28
**Domain:** Monaco Editor / YAML editing / Resizable panels / Config API integration
**Confidence:** HIGH

## Summary

Phase 5 requires интеграцию Monaco Editor в React/Vite приложение для редактирования YAML-конфига mihomo и plain-text файлов xkeen (ip_exclude, port_exclude, port_proxying). Ключевые технологии: `@monaco-editor/react` для редактора, shadcn/ui `resizable` (обёртка над `react-resizable-panels`) для сплиттера между редактором и лог-панелью, `js-yaml` для клиентской валидации YAML, существующий `useMihomoWs` хук для стриминга логов при Apply.

Бэкенд API уже полностью реализован в Phase 1: GET/PUT `/api/config` для config.yaml и GET/PUT `/api/xkeen/<filename>` для файлов-списков. Также уже есть POST `/api/service/restart` для перезапуска mihomo. Monaco Editor имеет встроенную подсветку YAML-синтаксиса без дополнительных плагинов. Для валидации достаточно `js-yaml.load()` с обработкой `YAMLException`.

**Primary recommendation:** Использовать `@monaco-editor/react` v4 (CDN по умолчанию, без конфигурации worker'ов), `js-yaml` для клиентской валидации, shadcn/ui `resizable` для сплиттера, и переиспользовать существующие API-клиенты и WebSocket-хуки.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Раскладка: редактор сверху, лог-панель снизу (как в VS Code)
- Между ними -- ресайз-сплиттер, пользователь тянет границу
- Лог-панель можно свернуть/развернуть кнопкой -- при свёрнутом логе редактор занимает всё пространство
- Тулбар над редактором: табы слева, кнопки (Apply / Save / Format) справа
- 4 таба: config.yaml, ip_exclude, port_exclude, port_proxying
- При переключении таба с несохранёнными изменениями -- диалог подтверждения "Сохранить / Отменить / Продолжить"
- Индикация несохранённых изменений -- цветная точка на табе (как в VS Code)
- Monaco автоопределяет формат файла (YAML для config, plain text для списков)
- Клавиатурные сокращения: Ctrl+1..4 переключает табы, Ctrl+S сохраняет
- Save -- сохраняет файл на диск без перезапуска mihomo
- Apply -- сохраняет файл на диск И перезапускает mihomo
- Перед Apply -- диалог подтверждения "Применить конфиг и перезапустить mihomo?"
- Format -- форматирует (prettify) содержимое YAML
- При невалидном YAML -- Apply/Save работают, но показывают предупреждение об ошибке
- Diff перед Apply -- включаемая/отключаемая функция в настройках
- Live-лог показывает логи только после нажатия Apply (не постоянный стрим)
- Стримит логи пока пользователь не нажмёт "Стоп" или не свернёт панель
- Фильтры уровней логов (info/warning/error)
- Логи очищаются автоматически при новом Apply

### Claude's Discretion
- Конкретная библиотека для ресайз-сплиттера
- Дизайн диалогов подтверждения
- Размер лог-панели по умолчанию
- Стиль и цвета бейджей уровней логов
- Реализация авто-скролла в лог-панели

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EDIT-01 | Monaco editor with YAML syntax highlighting for config.yaml | `@monaco-editor/react` v4 с встроенной подсветкой YAML. Monaco имеет нативную поддержку YAML-синтаксиса через monarch grammar. |
| EDIT-02 | Tabs for switching between config, ip_exclude, port_exclude, port_proxying | shadcn/ui `Tabs` (уже установлен), 4 таба с индикацией dirty-состояния. API: GET/PUT `/api/config` + GET/PUT `/api/xkeen/<filename>`. |
| EDIT-03 | YAML validation indicator ("YAML valid" / "Error at line X") | `js-yaml` для парсинга: `load()` выбрасывает `YAMLException` с `mark.line`, `mark.column`, `reason`. Маркеры через `monaco.editor.setModelMarkers()`. |
| EDIT-04 | Live log panel below editor showing mihomo response on Apply | Переиспользовать `useMihomoWs` хук для стриминга `/logs`. shadcn/ui `resizable` для сплиттера. Лог-панель аналогична существующему `LogStream` компоненту. |
| EDIT-05 | Apply, Save, Format buttons | Save: PUT к API. Apply: PUT + `serviceAction('restart')`. Format: `js-yaml.dump(js-yaml.load(content))`. DiffEditor из `@monaco-editor/react` для опционального diff-превью. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @monaco-editor/react | ^4.7.0 | React-обёртка Monaco Editor | Де-факто стандарт для Monaco в React. v4 поддерживает React 19. Не требует webpack-конфигурации. |
| js-yaml | ^4.1.0 | YAML парсинг/валидация/форматирование на клиенте | Самый популярный YAML-парсер для JS (150M+ downloads/week). YAMLException содержит номер строки/колонки. |
| react-resizable-panels | ^4.6.5 | Ресайзабельные панели (через shadcn/ui resizable) | shadcn/ui использует эту библиотеку для компонента resizable. Поддержка collapsible, keyboard, constraints. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/js-yaml | ^4.0.9 | TypeScript типы для js-yaml | Всегда -- проект использует TypeScript |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| js-yaml (валидация) | monaco-yaml (плагин) | monaco-yaml добавляет schema-validation, autocomplete, hover -- но требует настройку Web Workers для Vite, значительно сложнее в интеграции. Для задачи "показать валидность YAML" достаточно js-yaml. |
| @monaco-editor/react | react-monaco-editor | react-monaco-editor требует webpack-конфигурацию. @monaco-editor/react работает из коробки с Vite. |
| CDN-загрузка Monaco | Локальный бандл | CDN работает по умолчанию, без конфигурации. Для локального бандла нужен vite-plugin-monaco-editor. CDN подходит, т.к. дашборд имеет доступ к интернету. |

**Installation:**
```bash
pnpm add @monaco-editor/react js-yaml
pnpm add -D @types/js-yaml
pnpm dlx shadcn@latest add resizable
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  pages/
    ConfigEditorPage.tsx          # Основная страница (заменяет placeholder)
  components/
    config-editor/
      EditorToolbar.tsx           # Тулбар: табы слева, кнопки справа
      ConfigEditor.tsx            # Обёртка Monaco Editor + валидация
      EditorLogPanel.tsx          # Лог-панель снизу (apply-only стриминг)
      ApplyConfirmDialog.tsx      # AlertDialog подтверждения Apply
      TabSwitchDialog.tsx         # Диалог при переключении таба с dirty
      DiffPreview.tsx             # Опциональный DiffEditor перед Apply
  stores/
    config-editor.ts              # Zustand store для состояния редактора
  lib/
    config-api.ts                 # Существующий -- добавить fetchConfig, saveConfig, fetchXkeenFile, saveXkeenFile
```

### Pattern 1: Editor State Management (Zustand Store)
**What:** Zustand store для управления состоянием редактора -- текущий таб, оригинальное/текущее содержимое, dirty-флаги, состояние валидации
**When to use:** Для координации между тулбаром, редактором и лог-панелью
**Example:**
```typescript
// Source: project pattern (stores/settings.ts, stores/logs.ts)
interface ConfigEditorState {
  activeTab: TabId
  tabs: Record<TabId, TabState>
  logStreaming: boolean
  logEntries: LogEntry[]

  // Actions
  setActiveTab: (tab: TabId) => void
  setContent: (tab: TabId, content: string) => void
  markSaved: (tab: TabId) => void
  setValidation: (tab: TabId, result: ValidationResult) => void
  startLogStream: () => void
  stopLogStream: () => void
  clearLogs: () => void
  addLogEntry: (entry: LogEntry) => void
}

type TabId = 'config' | 'ip_exclude' | 'port_exclude' | 'port_proxying'

interface TabState {
  original: string        // Содержимое с сервера
  current: string         // Текущее содержимое в редакторе
  dirty: boolean          // original !== current
  language: 'yaml' | 'plaintext'
  validation: ValidationResult
  loading: boolean
}

interface ValidationResult {
  valid: boolean
  error?: {
    message: string
    line: number
    column: number
  }
}
```

### Pattern 2: YAML Validation with Monaco Markers
**What:** Валидация через js-yaml с отображением ошибок через Monaco markers
**When to use:** При каждом изменении содержимого в YAML-файле (debounced)
**Example:**
```typescript
// Source: js-yaml docs + Monaco API
import yaml from 'js-yaml'
import type { editor } from 'monaco-editor'

function validateYaml(
  content: string,
  monaco: typeof import('monaco-editor'),
  model: editor.ITextModel
): ValidationResult {
  try {
    yaml.load(content)
    // Очистить маркеры при валидном YAML
    monaco.editor.setModelMarkers(model, 'yaml-validation', [])
    return { valid: true }
  } catch (e) {
    if (e instanceof yaml.YAMLException && e.mark) {
      const marker: editor.IMarkerData = {
        severity: monaco.MarkerSeverity.Error,
        message: e.reason || e.message,
        startLineNumber: e.mark.line + 1,  // 0-indexed -> 1-indexed
        startColumn: e.mark.column + 1,
        endLineNumber: e.mark.line + 1,
        endColumn: e.mark.column + 2,
      }
      monaco.editor.setModelMarkers(model, 'yaml-validation', [marker])
      return {
        valid: false,
        error: {
          message: e.reason || e.message,
          line: e.mark.line + 1,
          column: e.mark.column + 1,
        },
      }
    }
    return { valid: false, error: { message: String(e), line: 0, column: 0 } }
  }
}
```

### Pattern 3: On-Demand Log Streaming
**What:** WebSocket стриминг логов только по требованию (после Apply), не постоянный
**When to use:** Лог-панель подключается к WebSocket только когда пользователь нажал Apply
**Example:**
```typescript
// Отличие от ConnectionsLogsPage: WS подключается по требованию, а не при mount
// Используем useRef<WebSocket> напрямую вместо useMihomoWs хука,
// т.к. хук подключается автоматически при mount

function useEditorLogStream() {
  const wsRef = useRef<WebSocket | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [entries, setEntries] = useState<LogEntry[]>([])

  const start = useCallback(() => {
    // Очистить предыдущие логи
    setEntries([])
    setStreaming(true)
    // Подключить WS к /logs
    const ws = createLogWebSocket(/* ... */)
    wsRef.current = ws
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setEntries(prev => [...prev, parseLogEntry(data)])
    }
  }, [])

  const stop = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setStreaming(false)
  }, [])

  return { entries, streaming, start, stop }
}
```

### Pattern 4: Monaco Editor Configuration
**What:** Настройка Monaco Editor для YAML/plaintext с тёмной темой
**When to use:** Единая конфигурация для всех табов
**Example:**
```typescript
// Source: @monaco-editor/react README
import Editor from '@monaco-editor/react'

<Editor
  height="100%"
  language={activeTab === 'config' ? 'yaml' : 'plaintext'}
  value={content}
  onChange={(value) => setContent(activeTab, value ?? '')}
  onMount={(editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
  }}
  theme="vs-dark"
  options={{
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on',
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
  }}
  loading={<Skeleton className="h-full w-full" />}
/>
```

### Pattern 5: Resizable Split Layout
**What:** Вертикальный сплиттер: редактор сверху, логи снизу
**When to use:** Основная раскладка страницы ConfigEditor
**Example:**
```typescript
// Source: shadcn/ui resizable docs
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'

<ResizablePanelGroup direction="vertical">
  <ResizablePanel defaultSize={70} minSize={30}>
    {/* Editor + Toolbar */}
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel
    defaultSize={30}
    minSize={10}
    collapsible
    collapsedSize={0}
    onCollapse={() => stopLogStream()}
  >
    {/* Log Panel */}
  </ResizablePanel>
</ResizablePanelGroup>
```

### Anti-Patterns to Avoid
- **Постоянный WebSocket для логов:** Логи стримятся только после Apply, не при загрузке страницы. Не использовать `useMihomoWs` хук напрямую -- он подключается при mount.
- **monaco-yaml для простой валидации:** Плагин тянет Web Workers, сложную конфигурацию. Для "YAML valid / Error at line X" достаточно `js-yaml.load()`.
- **Хранение содержимого в useState:** Для координации между компонентами (тулбар, редактор, логи) -- использовать Zustand store, как в остальном проекте.
- **Синхронный js-yaml.dump при каждом нажатии Format:** Для больших файлов может быть медленным. Debounce валидации, Format -- по нажатию кнопки.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Code editor с подсветкой YAML | textarea + regex highlighting | @monaco-editor/react | Тысячи edge-cases: курсор, выделение, undo/redo, поиск, folding |
| YAML парсинг/валидация | Regex-based validation | js-yaml.load() | YAML-спецификация сложна: multiline strings, anchors, aliases, flow collections |
| Resizable split panels | CSS resize + JS drag handlers | react-resizable-panels (shadcn resizable) | Keyboard accessibility, touch support, constraints, collapse |
| YAML formatting (prettify) | Custom serializer | js-yaml.dump(js-yaml.load(content)) | Корректная обработка всех YAML-конструкций |
| Diff view | Custom diff algorithm | Monaco DiffEditor | Встроен в @monaco-editor/react, тот же API |

**Key insight:** Monaco Editor и js-yaml покрывают 90% функциональности этой фазы. Основная работа -- UI-обвязка (табы, тулбар, диалоги, лог-панель) и интеграция с существующими API.

## Common Pitfalls

### Pitfall 1: Monaco Editor Height/Layout
**What goes wrong:** Monaco Editor не отображается или имеет нулевую высоту
**Why it happens:** Monaco требует явного указания высоты. `height="100%"` работает только если родительский контейнер имеет определённую высоту.
**How to avoid:** Использовать `height="100%"` с flex-контейнером, который имеет `flex: 1` и `min-h-0` (Tailwind: `flex-1 min-h-0`). Включить `automaticLayout: true` в options.
**Warning signs:** Редактор не виден, имеет высоту 0px, или не ресайзится при изменении размеров панели.

### Pitfall 2: Stale Editor Content on Tab Switch
**What goes wrong:** При переключении табов содержимое не обновляется или теряется
**Why it happens:** Monaco Editor кэширует модель. Если менять `value` prop без смены `path`, редактор может не перерисоваться.
**How to avoid:** Использовать уникальный `path` prop для каждого таба (например `file:///config.yaml`, `file:///ip_exclude.lst`). Или использовать `key` prop для пересоздания компонента. Лучший подход -- `path` + controlled `value`.
**Warning signs:** Содержимое одного файла отображается в другом табе.

### Pitfall 3: CDN Loading Delay
**What goes wrong:** При первой загрузке Monaco Editor показывает спиннер 1-3 секунды
**Why it happens:** `@monaco-editor/react` загружает Monaco Editor с CDN (jsdelivr) при первом использовании
**How to avoid:** Показать `<Skeleton>` через prop `loading`. Пользователь это увидит только при первом визите страницы -- далее Monaco кэшируется браузером.
**Warning signs:** Белый экран или "Loading..." без визуального индикатора.

### Pitfall 4: js-yaml.dump() Меняет Форматирование
**What goes wrong:** Format (prettify) меняет порядок ключей, удаляет комментарии, меняет стиль кавычек
**Why it happens:** `js-yaml.dump()` сериализует JS-объект обратно в YAML, теряя оригинальное форматирование и комментарии
**How to avoid:** Предупредить пользователя в UI -- "Format удалит комментарии". Format доступен только для YAML-табов. Для plain-text файлов Format неактивен.
**Warning signs:** Пользователь жалуется на потерю комментариев в конфиге.

### Pitfall 5: Race Condition при Apply
**What goes wrong:** Пользователь нажал Apply, файл сохранён, но WebSocket логов подключился поздно -- первые логи mihomo потеряны
**Why it happens:** WS-подключение не мгновенное. Между стартом WS и рестартом mihomo может пройти несколько секунд.
**How to avoid:** Подключать WS ДО отправки Save + Restart. Последовательность: 1) Открыть WS, 2) дождаться `onopen`, 3) PUT config, 4) POST restart.
**Warning signs:** Лог-панель пустая после Apply, хотя mihomo перезапустился.

### Pitfall 6: Несохранённые Изменения при Навигации
**What goes wrong:** Пользователь уходит со страницы редактора без сохранения
**Why it happens:** React Router не блокирует навигацию по умолчанию
**How to avoid:** Использовать `useBeforeUnload` для предупреждения при закрытии вкладки, и `unstable_useBlocker` (React Router v7) или `window.onbeforeunload` для навигации внутри SPA.
**Warning signs:** Пользователь теряет несохранённые изменения без предупреждения.

## Code Examples

Verified patterns from official sources:

### Загрузка Конфига через Config API
```typescript
// Source: existing src/lib/config-api.ts pattern
export async function fetchConfig(): Promise<{ content: string }> {
  const res = await fetch(`${getBaseUrl()}/api/config`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json()
}

export async function saveConfig(content: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to save config')
  }
}

export async function fetchXkeenFile(name: string): Promise<{ content: string }> {
  const res = await fetch(`${getBaseUrl()}/api/xkeen/${name}`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`Failed to fetch ${name}`)
  return res.json()
}

export async function saveXkeenFile(name: string, content: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/xkeen/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Failed to save ${name}`)
  }
}
```

### YAML Format (Prettify)
```typescript
// Source: js-yaml docs
import yaml from 'js-yaml'

function formatYaml(content: string): string {
  const parsed = yaml.load(content)
  return yaml.dump(parsed, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  })
}
```

### Monaco DiffEditor для Превью Изменений
```typescript
// Source: @monaco-editor/react docs
import { DiffEditor } from '@monaco-editor/react'

<DiffEditor
  height="400px"
  language="yaml"
  original={originalContent}
  modified={currentContent}
  theme="vs-dark"
  options={{
    readOnly: true,
    renderSideBySide: true,
    minimap: { enabled: false },
  }}
/>
```

### Keyboard Shortcuts
```typescript
// Source: Monaco Editor API
// В onMount callback:
editor.addCommand(
  monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
  () => handleSave()
)

// Ctrl+1..4 для переключения табов -- через window keydown listener
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key >= '1' && e.key <= '4') {
      e.preventDefault()
      const tabs: TabId[] = ['config', 'ip_exclude', 'port_exclude', 'port_proxying']
      setActiveTab(tabs[Number(e.key) - 1])
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-monaco-editor (webpack-only) | @monaco-editor/react v4 (bundler-agnostic) | 2023 | Работает с Vite без конфигурации |
| PanelGroup/PanelResizeHandle | Group/Panel/Separator (v4 exports) | Feb 2025 | shadcn/ui resizable абстрагирует это, API обёртки не изменился |
| Monaco CDN из unpkg | Monaco CDN из jsdelivr | 2024 | Быстрее, надёжнее |
| js-yaml v3 (safeLoad) | js-yaml v4 (load/dump) | 2021 | `safeLoad` -> `load`, `safeDump` -> `dump` |

**Deprecated/outdated:**
- `js-yaml.safeLoad()` -- удалён в v4, использовать `load()`
- `react-monaco-editor` -- требует webpack, не работает с Vite без плагинов
- `monaco-editor-webpack-plugin` -- не применим для Vite

## Open Questions

1. **Потеря комментариев при Format**
   - What we know: `js-yaml.dump()` теряет комментарии YAML (это ограничение спецификации -- YAML-парсеры не обязаны сохранять комментарии)
   - What's unclear: Насколько критично для пользователей mihomo-конфига
   - Recommendation: Показать предупреждение при Format: "Форматирование удалит комментарии". Вариант: не реализовывать Format как полный reformat, а использовать только indent-нормализацию

2. **Размер бандла Monaco через CDN**
   - What we know: ~2-3 МБ загружается с CDN при первом визите. Кэшируется браузером для последующих визитов.
   - What's unclear: Скорость CDN на роутерах с медленным интернетом
   - Recommendation: CDN по умолчанию. Если окажется проблемой -- можно переключиться на локальный бандл через `@tomjs/vite-plugin-monaco-editor`

3. **Diff перед Apply -- инлайн или модальное окно**
   - What we know: CONTEXT.md говорит "включаемая/отключаемая функция в настройках"
   - What's unclear: Показывать inline (заменяя редактор) или в модальном окне
   - Recommendation: AlertDialog с DiffEditor внутри. При нажатии Apply, если diff включён -- показать диалог с diff + кнопки "Применить" / "Отмена". Если выключён -- стандартный confirmation dialog.

## Sources

### Primary (HIGH confidence)
- [@monaco-editor/react GitHub](https://github.com/suren-atoyan/monaco-react) - API, Editor/DiffEditor/useMonaco, Vite совместимость
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) - v4.6.5, PanelGroup/Panel/Separator API, collapsible
- [shadcn/ui Resizable docs](https://ui.shadcn.com/docs/components/radix/resizable) - Installation, ResizablePanelGroup/ResizablePanel/ResizableHandle
- [Monaco Editor YAML issue #131](https://github.com/microsoft/monaco-editor/issues/131) - Подтверждение встроенной YAML-подсветки
- Existing codebase: `backend/server.py` (API endpoints), `src/lib/config-api.ts`, `src/hooks/use-mihomo-ws.ts`, `src/stores/logs.ts`

### Secondary (MEDIUM confidence)
- [monaco-yaml GitHub](https://github.com/remcohaszing/monaco-yaml) - Альтернативный подход для YAML-валидации (не рекомендован для этой фазы)
- [Monaco Editor Vite sample](https://github.com/microsoft/monaco-editor/blob/main/samples/browser-esm-vite-react/src/userWorker.ts) - Worker configuration pattern
- [js-yaml GitHub](https://github.com/nodeca/js-yaml) - API: load/dump, YAMLException.mark

### Tertiary (LOW confidence)
- WebSearch results for js-yaml YAMLException structure - Подтверждено что mark содержит line/column (0-indexed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - все библиотеки проверены, @monaco-editor/react подтверждённо работает с Vite, shadcn/ui resizable имеет документацию
- Architecture: HIGH - паттерны основаны на существующих паттернах проекта (Zustand stores, config-api.ts, use-mihomo-ws.ts)
- Pitfalls: HIGH - типичные проблемы Monaco Editor хорошо задокументированы в issues и Stack Overflow
- API Integration: HIGH - бэкенд API уже реализован и протестирован (Phase 1)

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (стабильный стек, 30 дней)
