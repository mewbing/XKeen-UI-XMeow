# Phase 15: Self-Update Backend - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Go backend умеет проверять и устанавливать обновления из GitHub releases, атомарно заменяя свой бинарник с backup/rollback. Включает API для проверки обновлений, применения обновления, и отката. CI дополняется генерацией checksums.txt и dist.tar.gz. Фронтенд обновлений (UI страница, sidebar badge, авто-проверка) — Phase 16.

</domain>

<decisions>
## Implementation Decisions

### GitHub API и проверка обновлений
- Репозиторий: `mewbing/XKeen-UI-Xmeow` — хардкод, форки не поддерживаются
- Только public releases, без GitHub token
- Кэширование в памяти с TTL 1 час — повторные GET /api/update/check отдают кэш
- Определение артефакта: `runtime.GOOS` + `runtime.GOARCH` → ищет `xmeow-server-{os}-{arch}.tar.gz` в assets релиза
- Сравнение версий: текущая Version (ldflags) vs latest release tag

### Процесс обновления бинарника
- В embedded-режиме: скачиваем xmeow-server-{os}-{arch}.tar.gz, извлекаем бинарник, атомарная замена
- В external-ui режиме: только бинарник (SPA обновляется через UI дашборда, Phase 16)
- Backup: rename xmeow-server → xmeow-server.bak перед заменой (один предыдущий бэкап)
- dist.tar.gz добавить как отдельный артефакт в CI релиз (для Phase 16 — обновление SPA через UI)

### Перезапуск сервиса
- Если нет init.d скрипта — ошибка с инструкцией ручного перезапуска
- Конкретный механизм перезапуска (init.d restart vs self-exec) — Claude's Discretion

### Безопасность и edge cases
- SHA256 верификация обязательна: CI генерирует checksums.txt в релизе, backend проверяет после скачивания
- Скачивание во временный файл (например /tmp), при ошибке/прерывании — удаление временного файла
- Rollback API: POST /api/update/rollback — переименовывает .bak обратно и перезапускает сервис
- Проверка свободного места на диске перед скачиванием — ошибка если не хватает

### Claude's Discretion
- Конкретный механизм перезапуска (init.d restart vs syscall.Exec)
- Как UI узнаёт что обновление завершено (poll health + versions vs SSE)
- Формат ответа GET /api/update/check (changelog, release notes, размер артефакта)
- Обработка ошибок при распаковке tar.gz
- Минимальный порог свободного места на диске

</decisions>

<specifics>
## Specific Ideas

- UI обновляется через сам дашборд "как zashboard" — backend предоставляет API для скачивания dist.tar.gz, но триггер из UI (Phase 16)
- Бинарник уже имеет --version/-v флаг, Version через ldflags — инфраструктура для сравнения версий готова
- GET /api/versions уже возвращает dashboard version — можно расширить для update info

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `internal/config/config.go`: AppConfig с Version (ldflags), LoadConfig() — расширить для update-специфичных настроек
- `internal/handler/versions.go`: GetVersions — уже отдаёт текущую версию, можно расширить
- `internal/handler/helpers.go`: writeJSON helper — для ответов update API
- `internal/server/routes.go`: chi router с auth группировкой — добавить /api/update/* эндпоинты
- `internal/backup/backup.go`: существующий пакет для бэкапов — паттерн для backup бинарника

### Established Patterns
- Handler struct с *config.AppConfig dependency injection через NewHandlers()
- Auth middleware через AuthMiddleware(getSecret) — update эндпоинты должны быть под auth
- Graceful shutdown через signal.NotifyContext в main.go
- exec.CommandContext для внешних процессов (xkeen -v, service actions) — переиспользовать для init.d restart

### Integration Points
- `cmd/xmeow-server/main.go`: main.Version — источник текущей версии для сравнения
- `internal/server/routes.go`: r.Route("/api", ...) — добавить update route group
- CI workflow (.github/workflows/release.yml) — добавить checksums.txt и dist.tar.gz артефакты
- setup.sh — S99xmeow-ui init.d скрипт с start/stop/restart — механизм перезапуска

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-self-update-backend*
*Context gathered: 2026-03-03*
