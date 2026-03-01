# Phase 12: Go Backend Core - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Go бинарник полностью заменяет Flask backend (backend/server.py) с идентичным API-контрактом. Embedded SPA через embed.FS. Reverse proxy к mihomo как опция. Фронтенд (React SPA) не меняется — только backend.

Два режима работы фронтенда сохраняются:
- **Полный режим** — Go backend установлен: конфиг-редактор, сервис-менеджмент, логи + прокси/подключения через mihomo
- **Лайт-режим** — Без backend: только просмотр прокси, подключений, логов напрямую через mihomo :9090

</domain>

<decisions>
## Implementation Decisions

### HTTP Framework и зависимости
- Go 1.23+ (embed.FS, generics, новый ServeMux)
- gorilla/websocket для WebSocket стриминга логов
- Конкретный HTTP фреймворк (Chi/Gin/stdlib) — Claude's Discretion, с учётом:
  - Минимальный размер бинарника (target: Keenetic arm64/mipsle/mips)
  - Совместимость с net/http middleware
  - Удобный роутинг для 15+ эндпоинтов

### Аутентификация
- API key аутентификация через заголовок (Bearer token или X-API-Key)
- Ключ берётся из поля `secret` в mihomo config.yaml (тот же файл, который Go уже читает)
- Фронтенд уже хранит mihomo secret в settings store — будет отправлять его же для Go API
- Единый пароль для всего: mihomo API и Go backend API

### Архитектура маршрутизации
- **Два порта**: Go backend на :5000, mihomo на :9090 — как текущая схема с Flask
- **Reverse proxy как опция**: Go может проксировать mihomo API (например `/api/mihomo/*`) для полного режима, но фронтенд по умолчанию ходит на :9090 напрямую
- **Адрес mihomo**: Go читает `external-controller` из mihomo config.yaml (автоматически, не нужна отдельная настройка)
- **Порт :5000** — совместимость с текущими настройками фронтенда, без миграции

### Структура Go-проекта
- **Standard Go layout**: cmd/antigravity/main.go + internal/ packages (server, config, proxy, logs)
- **Монорепо**: go.mod в корне dashboard/, рядом с package.json и src/
- **Module name**: `github.com/mewbing/XKeen-UI-Xmeow`
- embed.FS ссылается на dist/ (результат `npm run build`)
- CI/CD (фаза 13) создаст 2 артефакта в релизе: Go бинарник + standalone frontend.tar.gz

### Мониторинг логов
- **fsnotify (inotify)** для реактивного отслеживания изменений лог-файлов — меньше нагрузки чем polling
- **Ленивый watcher**: fsnotify активен только когда есть WS-клиенты (0 клиентов → watcher остановлен)
- При подключении WS: Go читает последние строки из файла напрямую → initial message с историей
- **1000 строк** истории по умолчанию, настраивается через settings
- Лог-файлы персистентны на диске — ошибки видны сразу при входе в панель

### Claude's Discretion
- Конкретный HTTP фреймворк (Chi vs Gin vs stdlib) — оптимальный для размера бинарника и поддерживаемости
- YAML библиотека для Go (gopkg.in/yaml.v3 или альтернативы)
- SPA serving: embedded файлы + fallback на index.html для SPA routing
- Backup mechanism (идентичный Flask: timestamped copies)
- Exact internal package structure (server/, config/, proxy/, logs/)
- CORS middleware реализация
- Graceful shutdown

</decisions>

<specifics>
## Specific Ideas

- Пароль для API берётся из mihomo config.yaml поле `secret` — один пароль на всё
- Пользователи без backend (лайт-режим) скачивают только frontend.tar.gz из GitHub releases
- Go бинарник ~13-17 МБ (vs Python 25-30 МБ) — выигрыш в размере и простоте
- При заходе в панель — сразу видны логи до момента открытия (initial read из файла)
- GitHub: `mewbing/XKeen-UI-Xmeow`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/server.py` (650 строк): полный эталон всех 15 REST эндпоинтов + WS протокол. Go backend — 1:1 портирование.
- `src/lib/config-api.ts`: TypeScript API клиент — контракт запросов/ответов для всех Flask эндпоинтов
- `src/hooks/useLogWebSocket.ts`: WS протокол клиента (initial/append/clear/switchFile/reload/ping/pong)
- `vite.config.ts`: routing rules — какие пути идут на Flask, какие на mihomo

### Established Patterns
- JSON responses: `{content: string}` для GET, `{error: string}` для ошибок, `{message: string, backup: path}` для PUT
- WebSocket protocol: bidirectional JSON, types: initial/append/clear/switchFile/reload/ping/pong
- Environment variables для конфигурации путей (MIHOMO_CONFIG_PATH, XKEEN_DIR, BACKUP_DIR, etc.)
- YAML validation перед записью config; backup перед каждой записью
- Service actions через subprocess вызов `xkeen -{action}`

### Integration Points
- Frontend `useSettingsStore` хранит configApiUrl (для Go backend) и mihomoHost (для mihomo direct)
- Frontend `useHealthCheck` проверяет доступность API через GET /api/health
- Dev proxy в vite.config.ts нужно обновить для dev-режима с Go backend
- Log parsing regex: 2 формата (xray v5 structured, mihomo plain) — портировать в Go

</code_context>

<deferred>
## Deferred Ideas

- UPX compression для уменьшения бинарника — DFRD-04 (отложено на будущее)
- Frontend-only релиз артефакт — уточнить в Phase 13 (CI/CD)

</deferred>

---

*Phase: 12-go-backend-core*
*Context gathered: 2026-03-02*
