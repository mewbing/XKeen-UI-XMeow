# Phase 13: CI/CD Pipeline - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

GitHub Actions автоматически собирает Go бинарники для всех архитектур роутера и создаёт GitHub Release с артефактами. Два workflow: CI проверка (push/PR) и Release (по тегу).

</domain>

<decisions>
## Implementation Decisions

### Именование и упаковка
- Имя бинарника: `xmeow-ui`
- Формат артефактов: `xmeow-ui_{version}_{os}_{arch}.tar.gz` (goreleaser-стиль, версия в имени)
- Содержимое tar.gz: бинарник `xmeow-ui` + `README.md` в корне архива (без вложенной папки)
- Дополнительный артефакт: `dist.tar.gz` — SPA-фронтенд для external-ui режима (Phase 15 использует для обновления)

### Триггеры и версионирование
- Формат тега: `v*.*.*` (semver с префиксом v, например v1.0.0)
- Release workflow: только по push тега `v*.*.*` (без workflow_dispatch)
- CI workflow: отдельный `ci.yml` на push/PR в main — проверяет go build + npm build без создания релиза
- Версия в бинарнике: через Go ldflags `-X main.Version` (уже реализовано в cmd/xmeow-ui/main.go)

### Содержимое релиза
- Changelog: auto-generated GitHub (из коммитов/PR между тегами)
- Pre-release: тег с суффиксом (v1.0.0-beta1) создаёт pre-release, чистый semver (v1.0.0) — стабильный
- Заголовок релиза: "XMeow UI v1.0.0"
- Checksums: генерировать `checksums.txt` (SHA256) и прикладывать как артефакт релиза

### Матрица сборки
- 5 архитектур: linux/arm64, linux/mipsle (softfloat), linux/mips (softfloat), linux/amd64, linux/arm/v7
- CGO_ENABLED=0 для всех сборок (статические бинарники, работают на Entware/OpenWrt)
- UPX-сжатие бинарников (уменьшает размер ~60-70%, важно для MIPS роутеров с ограниченной флешкой)

### Claude's Discretion
- Конкретная версия Go в CI (1.25.x или latest stable)
- UPX флаги и уровень сжатия
- Структура и содержание README.md в артефакте
- Кэширование зависимостей в CI (Go modules, npm/pnpm)
- Go ldflags для strip/debug info (-s -w)

</decisions>

<specifics>
## Specific Ideas

- SPA собирается один раз (npm run build), затем Go embed использует dist/ для всех архитектурных сборок
- dist.tar.gz нужен для Phase 15 (Self-Update Backend) — обновление external-ui директории mihomo без замены бинарника
- Инсталлятор (Phase 14) будет использовать предсказуемый URL формат артефактов для автоскачивания

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cmd/xmeow-ui/main.go`: уже имеет `var Version = "dev"` с ldflags комментарием
- `embed.go`: `//go:embed all:dist` — SPA встраивается из директории dist/
- `go.mod`: модуль `github.com/mewbing/XKeen-UI-Xmeow`, Go 1.25.0
- `package.json`: build скрипт `tsc -b && vite build`, пакетный менеджер pnpm

### Established Patterns
- Go entry point: `cmd/xmeow-ui/main.go` — единственный main package
- Version injection: `-X main.Version=` через ldflags уже предусмотрен
- Frontend → Go embed: npm build → dist/ → go:embed — последовательная цепочка сборки

### Integration Points
- GitHub repo: `github.com/mewbing/XKeen-UI-Xmeow`
- Нет существующих .github/workflows — создаём с нуля
- Нет Makefile — CI workflow содержит все команды сборки

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-ci-cd-pipeline*
*Context gathered: 2026-03-02*
