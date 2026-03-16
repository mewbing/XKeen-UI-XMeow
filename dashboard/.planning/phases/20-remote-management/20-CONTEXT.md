# Phase 20: Remote Management & Reverse SSH Tunnel - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Удалённое подключение и управление XMeow-панелями на роутерах за NAT. Включает:
1. SSH-сервер на мастере для приёма reverse tunnels от агентов
2. Отдельный лёгкий бинарник `xmeow-agent` для клиентских роутеров
3. UI для управления удалёнными роутерами (страница + переключатель контекста)
4. Опционально: поддержка внешнего VPS/relay как альтернативы прямому подключению

Не входит: mesh-networking между агентами, автообнаружение устройств, мониторинг-дашборд для провайдеров.

</domain>

<decisions>
## Implementation Decisions

### Архитектура туннеля
- **Протокол**: SSH reverse tunnel (`golang.org/x/crypto/ssh` — уже в проекте)
- **SSH-сервер встраивается в xmeow-server** (мастер) — принимает подключения от агентов
- **Режимы подключения**: прямой (агент → мастер по IP/домену) + VPS/relay (агент → VPS ← мастер). Конфигурируется в агенте
- **Пробрасываемые порты**: XMeow API (5000), mihomo API (9090), SSH (22) удалённого роутера
- **Масштаб**: без ограничения количества одновременных агентов (зависит от ресурсов мастера)
- **Auto-reconnect**: агент автоматически переподключается при обрыве связи

### Агент (xmeow-agent)
- **Отдельный бинарник** `xmeow-agent`, путь `/opt/etc/xmeow-ui/xmeow-agent`
- **Отдельный init.d скрипт** (напр. `S99xmeow-agent`)
- **Функции**: поддержание SSH reverse tunnel + периодический heartbeat к мастеру
- **Heartbeat данные**: версия mihomo, uptime роутера, архитектура, имя устройства, IP
- **Конфигурация**: YAML/JSON файл `/opt/etc/xmeow-ui/agent.conf` с полями: server_host, server_port, token, device_name
- **Установка**: опция `setup.sh --agent` в существующем установщике. При установке интерактивный ввод данных подключения (адрес сервера, токен) или пропуск для ручной настройки позже
- **Сборка**: отдельный `cmd/xmeow-agent/main.go`, те же 3 архитектуры (arm64, armv7, mipsle)
- **Самообновление**: аналогично xmeow-server (через GitHub releases, отдельный артефакт)

### UI мастер-панели
- **Страница «Удалённые»**: новая страница в sidebar с иконкой. Список подключённых и offline агентов
- **Переключатель контекста**: в sidebar/header — селектор роутера. При выборе удалённого роутера весь дашборд переключается на его API через проксирование запросов через SSH туннель
- **Карточки клиентов**: минималистичные — имя устройства + статус (online/offline) + кнопка «Подключиться»
- **Empty state**: когда нет агентов — описание возможностей функции + инструкция по установке агента (с командой копирования)
- **Видимость**: страница всегда видна в sidebar, но можно скрыть в настройках
- **Генерация токена**: кнопка в UI для создания нового токена агента (копируется в буфер)
- **Проксирование API**: при работе с удалённым роутером — запросы из SPA идут на мастер-бэкенд, который проксирует их через SSH-туннель на удалённый XMeow API / mihomo API

### Безопасность и авторизация
- **Авторизация агентов**: пре-сгенерированный токен. Мастер генерирует уникальный токен для каждого агента
- **Управление доступом**: список зарегистрированных агентов с возможностью отзыва токена (бан/удаление)
- **Шифрование**: SSH достаточно, без дополнительных слоёв (mTLS не нужен)
- **Аудит-лог**: не нужен. Достаточно текущего статуса online/offline
- **Хранение токенов на мастере**: JSON-файл или встроенная KV-store (bolt/badger) — Claude's Discretion

### Claude's Discretion
- Порт SSH-сервера на мастере (по умолчанию, конфигурируемый)
- Формат токена (UUID, random hex, base64)
- Интервал heartbeat (например, 30с)
- Формат конфиг-файла агента (YAML vs JSON)
- Хранение списка агентов/токенов на мастере (файл vs embedded DB)
- Точная иконка для страницы «Удалённые» в sidebar
- Анимации переключения контекста роутера

</decisions>

<specifics>
## Specific Ideas

- Агент должен быть максимально лёгким — на роутерах с 256MB RAM (MIPS) не должен заметно влиять на производительность
- Установка агента через `setup.sh --agent` — не нужен отдельный скрипт, расширяем существующий
- При установке агента пользователь может ввести данные подключения интерактивно или пропустить для ручной настройки
- Страница «Удалённые» должна работать как onboarding: если агентов нет — объяснить что это, зачем и как настроить
- Поддержка VPS/relay важна для сценария когда ОБА роутера за NAT провайдера

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`golang.org/x/crypto/ssh`**: уже в go.mod, используется для SSH-клиента в `internal/terminal/session.go`. Нужно добавить SSH server mode
- **`gorilla/websocket`**: для heartbeat/status WebSocket endpoint
- **`internal/terminal/hub.go`**: паттерн Hub для управления сессиями — можно адаптировать для управления SSH-туннелями
- **`internal/server/middleware.go`**: AuthMiddleware — переиспользовать для API агентов
- **`useBackendAvailable.ts`**: adaptive polling — переиспользовать для проверки доступности удалённого роутера
- **`useTerminalWs.ts`**: WebSocket hook — паттерн для remote status WebSocket
- **`stores/settings.ts`**: persisted settings — добавить настройки remote management
- **`setup.sh`**: расширить arch detection + download для agent binary

### Established Patterns
- **Chi router groups** с AuthMiddleware — новые API endpoints для remote management
- **NDJSON streaming** для progress (установка, подключение) — `readNDJSONStream` в releases-api.ts
- **Zustand stores** с persist — для remote state management
- **Init.d service scripts** — S99xmeow-agent по аналогии с S99xmeow-ui
- **Cross-compile** 3 arch — добавить xmeow-agent в CI matrix

### Integration Points
- **Routes**: новая группа `/api/remote/*` для management API (list agents, generate token, revoke, proxy)
- **SSH server**: новый пакет `internal/sshserver/` для приёма туннелей
- **Agent binary**: новый `cmd/xmeow-agent/main.go`
- **Frontend routing**: новая страница `/remote` в React Router
- **Sidebar**: новый пункт меню + переключатель контекста роутера
- **Settings store**: настройка видимости страницы «Удалённые»
- **CI/CD**: новый job для сборки xmeow-agent, отдельные артефакты в release

</code_context>

<deferred>
## Deferred Ideas

- **Mesh-networking между агентами** — агенты общаются напрямую, без мастера. Отдельная фаза
- **Автообнаружение устройств** в локальной сети — не требует SSH tunnel. Отдельная фаза
- **Групповые операции** — обновить mihomo/правила на всех удалённых роутерах одновременно. Отдельная фаза
- **Мониторинг-дашборд** — единая сводка метрик всех удалённых роутеров. Отдельная фаза
- **Мобильное приложение** для удалённого управления. Отдельная фаза

</deferred>

---

*Phase: 20-remote-management*
*Context gathered: 2026-03-17*
