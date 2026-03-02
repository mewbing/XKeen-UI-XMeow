# Phase 13: CI/CD Pipeline - Research

**Researched:** 2026-03-03
**Domain:** GitHub Actions, Go cross-compilation, release automation
**Confidence:** HIGH

## Summary

Phase 13 requires two GitHub Actions workflows: CI (проверка на push/PR) и Release (по тегу `v*.*.*`). Основная сложность -- кросс-компиляция Go для 5 архитектур (arm64, mipsle softfloat, mips softfloat, amd64, arm/v7) с встроенным SPA-фронтендом и UPX-сжатием.

Go нативно поддерживает кросс-компиляцию через GOOS/GOARCH/GOMIPS без CGO, что делает сборку простой -- достаточно установить Go и задать переменные окружения. Frontend собирается один раз (pnpm install + build), после чего `dist/` директория используется всеми Go-сборками через `go:embed`.

UPX 5.1.0 (январь 2026) поддерживает MIPS и включает исправления PT_MIPS_ABIFLAGS. Исторические проблемы с MIPS были исправлены в UPX 3.99+. Однако UPX-сжатие MIPS бинарников остаётся зоной риска -- рекомендуется тестирование на реальном устройстве.

**Primary recommendation:** Использовать `softprops/action-gh-release@v2` для создания релизов, `crazy-max/ghaction-upx@v3` для UPX-сжатия, и матрицу `strategy.matrix` для 5 архитектур. Frontend собирается как отдельный job, передаётся через `actions/upload-artifact`/`actions/download-artifact`.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Имя бинарника: `xmeow-ui`
- Формат артефактов: `xmeow-ui_{version}_{os}_{arch}.tar.gz` (goreleaser-стиль, версия в имени)
- Содержимое tar.gz: бинарник `xmeow-ui` + `README.md` в корне архива (без вложенной папки)
- Дополнительный артефакт: `dist.tar.gz` -- SPA-фронтенд для external-ui режима
- Формат тега: `v*.*.*` (semver с префиксом v)
- Release workflow: только по push тега `v*.*.*` (без workflow_dispatch)
- CI workflow: отдельный `ci.yml` на push/PR в main
- Версия в бинарнике: через Go ldflags `-X main.Version`
- Changelog: auto-generated GitHub
- Pre-release: тег с суффиксом (v1.0.0-beta1) -- pre-release, чистый semver -- стабильный
- Заголовок релиза: "XMeow UI v1.0.0"
- Checksums: генерировать `checksums.txt` (SHA256)
- 5 архитектур: linux/arm64, linux/mipsle (softfloat), linux/mips (softfloat), linux/amd64, linux/arm/v7
- CGO_ENABLED=0 для всех сборок
- UPX-сжатие бинарников

### Claude's Discretion
- Конкретная версия Go в CI (1.25.x или latest stable)
- UPX флаги и уровень сжатия
- Структура и содержание README.md в артефакте
- Кэширование зависимостей в CI (Go modules, npm/pnpm)
- Go ldflags для strip/debug info (-s -w)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CICD-01 | GitHub Actions cross-compiles Go for arm64, mipsle (softfloat), mips (softfloat) | Matrix strategy с GOOS/GOARCH/GOMIPS переменными; CGO_ENABLED=0; расширено до 5 архитектур по решению пользователя |
| CICD-02 | GitHub Actions builds frontend and embeds into Go binary | pnpm install + build в отдельном job; dist/ передаётся через upload/download-artifact; go:embed подхватывает |
| CICD-03 | GitHub Actions creates GitHub Release with architecture-specific binaries | softprops/action-gh-release@v2 с generate_release_notes, prerelease detection, checksums.txt |
| CICD-04 | Version injected via Go ldflags (-X main.Version) at build time | Извлечение версии из GITHUB_REF_NAME (тег), передача через `-ldflags "-s -w -X main.Version=$VERSION"` |

</phase_requirements>

## Standard Stack

### Core (GitHub Actions)

| Action | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| `actions/checkout` | `@v6` | Checkout repository | Стандартный, node24 runtime |
| `actions/setup-go` | `@v6` | Установка Go 1.25 | Встроенное кэширование Go modules |
| `actions/setup-node` | `@v6` | Установка Node.js 22 | Кэширование pnpm, node24 runtime |
| `pnpm/action-setup` | `@v4` | Установка pnpm | Должен стоять ПЕРЕД setup-node |
| `softprops/action-gh-release` | `@v2` | Создание GitHub Release | Поддержка generate_release_notes, prerelease, множественных файлов |
| `crazy-max/ghaction-upx` | `@v3` | UPX-сжатие бинарников | Автоматическая загрузка UPX, поддержка glob patterns |
| `actions/upload-artifact` | `@v4` | Передача артефактов между jobs | Стандартный для multi-job workflows |
| `actions/download-artifact` | `@v4` | Получение артефактов из предыдущих jobs | Парный к upload-artifact |

### Build Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Go | 1.25 | Компиляция бинарников | go.mod указывает go 1.25.0 |
| Node.js | 22 | Frontend build | Vite 7 требует Node.js 20.19+ или 22.12+ |
| pnpm | latest | Пакетный менеджер | Используется в проекте, lockfile существует |
| UPX | latest (5.1.0) | Сжатие бинарников | MIPS-исправления в 3.99+, PT_MIPS_ABIFLAGS в 5.0 |

### Discretion Recommendations

| Area | Recommendation | Reason |
|------|---------------|--------|
| Go version | `'1.25'` (не latest) | Привязка к go.mod, предсказуемость сборки |
| Go ldflags | `-s -w -X main.Version=$VERSION` | `-s` убирает symbol table, `-w` убирает DWARF -- уменьшает бинарник на ~25% |
| UPX flags | `--best --lzma` | Максимальное сжатие (--best = -9, --lzma = лучший алгоритм для больших файлов) |
| Node.js version | `'22'` | LTS, совместим с Vite 7 |
| Кэширование | Go modules (встроенное в setup-go), pnpm (через setup-node cache: 'pnpm') | Ускорение CI на 30-60 секунд |

## Architecture Patterns

### Workflow Structure

```
.github/
  workflows/
    ci.yml          # Push/PR to main -- проверка сборки
    release.yml     # Push tag v*.*.* -- полный релиз
```

### Pattern 1: Two-Workflow Split

**What:** Отдельные CI и Release workflows
**When to use:** Всегда -- разная логика триггеров и артефактов

**ci.yml** -- проверяет что проект собирается:
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v6
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - uses: actions/setup-go@v6
        with:
          go-version: '1.25'
      - run: go build ./cmd/xmeow-ui/
        env:
          CGO_ENABLED: '0'
```

### Pattern 2: Multi-Job Release Pipeline

**What:** Frontend build -> Matrix cross-compile -> UPX -> Package -> Release
**When to use:** Release workflow

```
Job 1: build-frontend
  -> pnpm install + build
  -> upload dist/ as artifact

Job 2: build-binaries (matrix: 5 architectures)
  -> download dist/ artifact
  -> go build with GOOS/GOARCH/GOMIPS
  -> UPX compress
  -> tar.gz packaging
  -> upload archives as artifacts

Job 3: release
  -> download all archives
  -> generate checksums.txt
  -> create GitHub Release with all assets
```

### Pattern 3: Build Matrix for 5 Architectures

**What:** strategy.matrix для кросс-компиляции
**Example:**
```yaml
strategy:
  matrix:
    include:
      - goos: linux
        goarch: arm64
        suffix: linux_arm64
      - goos: linux
        goarch: mipsle
        gomips: softfloat
        suffix: linux_mipsle
      - goos: linux
        goarch: mips
        gomips: softfloat
        suffix: linux_mips
      - goos: linux
        goarch: amd64
        suffix: linux_amd64
      - goos: linux
        goarch: arm
        goarm: '7'
        suffix: linux_armv7
```

### Pattern 4: Version Extraction from Tag

**What:** Извлечение чистой версии из git tag
**Example:**
```yaml
- name: Extract version
  id: version
  run: echo "version=${GITHUB_REF_NAME#v}" >> $GITHUB_OUTPUT
```
Для тега `v1.0.0` -> version = `1.0.0`. Используется в ldflags и именах артефактов.

### Pattern 5: Pre-release Detection

**What:** Автоопределение pre-release по суффиксу тега
**Example:**
```yaml
# В softprops/action-gh-release:
- uses: softprops/action-gh-release@v2
  with:
    prerelease: ${{ contains(github.ref_name, '-') }}
    # v1.0.0-beta1 -> true, v1.0.0 -> false
```

### Anti-Patterns to Avoid
- **Один монолитный job:** Нельзя собирать frontend 5 раз -- собрать один раз, передать через artifact
- **CGO_ENABLED по умолчанию:** Go включает CGO по умолчанию на linux/amd64 -- ВСЕГДА явно `CGO_ENABLED=0`
- **GOMIPS не задан для MIPS:** Дефолт -- hardfloat, бинарник упадёт с Illegal Instruction на softfloat роутерах
- **UPX без --lzma на MIPS:** Без LZMA сжатие даёт ~40%, с LZMA -- ~60-70%
- **tar с вложенной директорией:** Пользователь явно решил -- файлы в корне архива, без подпапки

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Release creation | Ручные curl к GitHub API | `softprops/action-gh-release@v2` | Atomic upload, draft-until-complete, auto-notes |
| UPX установка | wget + chmod + cache | `crazy-max/ghaction-upx@v3` | Версионирование, кэширование, cross-platform |
| Checksum generation | Отдельный скрипт | `sha256sum *.tar.gz > checksums.txt` | Однострочник, нечего абстрагировать |
| pnpm setup | curl install script | `pnpm/action-setup@v4` | Интеграция с setup-node cache |
| Artifact passing | git stash / external storage | `actions/upload-artifact` + `actions/download-artifact` | Нативная поддержка GitHub Actions, не требует credentials |

## Common Pitfalls

### Pitfall 1: GOMIPS не задан для mips/mipsle
**What goes wrong:** Бинарник компилируется с hardfloat (дефолт), падает с "Illegal Instruction" на softfloat роутерах
**Why it happens:** Go по умолчанию предполагает hardfloat FPU
**How to avoid:** ВСЕГДА задавать `GOMIPS=softfloat` для GOARCH=mips и GOARCH=mipsle
**Warning signs:** Бинарник собирается без ошибок, но не запускается на устройстве

### Pitfall 2: go:embed требует dist/ перед go build
**What goes wrong:** `go build` падает с ошибкой "pattern all:dist: no matching files found"
**Why it happens:** `embed.go` в корне проекта объявляет `//go:embed all:dist`, директория должна существовать
**How to avoid:** Frontend build ДОЛЖЕН выполняться до go build; dist/ должна быть на месте
**Warning signs:** Сборка падает на первом же go build

### Pitfall 3: pnpm/action-setup ПЕРЕД actions/setup-node
**What goes wrong:** Кэширование pnpm не работает
**Why it happens:** setup-node с cache: 'pnpm' ищет pnpm store path при инициализации
**How to avoid:** Порядок: 1) pnpm/action-setup, 2) actions/setup-node с cache: 'pnpm'
**Warning signs:** Каждый CI run скачивает все npm пакеты заново

### Pitfall 4: UPX на MIPS бинарниках
**What goes wrong:** Сжатый бинарник зависает или не запускается на MIPS устройстве
**Why it happens:** Исторические баги в UPX stub для MIPS (исправлены в 3.99+, улучшены в 5.0)
**How to avoid:** Использовать UPX 5.1.0 (latest); тестировать на реальном устройстве; иметь fallback план отключения UPX для MIPS
**Warning signs:** Бинарник без UPX работает, с UPX -- зависает

### Pitfall 5: tar архив с подпапкой
**What goes wrong:** `tar -czf archive.tar.gz dir/` создаёт `dir/file` внутри архива
**Why it happens:** tar по умолчанию сохраняет структуру путей
**How to avoid:** Использовать `-C` для смены директории: `tar -czf archive.tar.gz -C staging/ .` или указывать файлы явно
**Warning signs:** При распаковке появляется лишняя директория

### Pitfall 6: GOARM не задан для arm/v7
**What goes wrong:** Go использует GOARM=5 по умолчанию (ARMv5), не оптимально для ARMv7
**Why it happens:** Go выбирает минимальный ARM уровень для совместимости
**How to avoid:** Задать `GOARM=7` при `GOARCH=arm`
**Warning signs:** Бинарник работает, но не использует ARMv7 инструкции

### Pitfall 7: Vite 7 + Node.js 18
**What goes wrong:** `pnpm run build` падает
**Why it happens:** Vite 7 требует Node.js 20.19+ или 22.12+
**How to avoid:** Использовать Node.js 22 в CI
**Warning signs:** Ошибка про unsupported Node version при запуске vite

## Code Examples

### Complete Release Workflow Structure

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

permissions:
  contents: write

jobs:
  build-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v6
        with:
          node-version: '22'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm run build

      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  build-binaries:
    needs: build-frontend
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - goos: linux
            goarch: arm64
            suffix: linux_arm64
          - goos: linux
            goarch: mipsle
            gomips: softfloat
            suffix: linux_mipsle
          - goos: linux
            goarch: mips
            gomips: softfloat
            suffix: linux_mips
          - goos: linux
            goarch: amd64
            suffix: linux_amd64
          - goos: linux
            goarch: arm
            goarm: '7'
            suffix: linux_armv7
    steps:
      - uses: actions/checkout@v6

      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - uses: actions/setup-go@v6
        with:
          go-version: '1.25'

      - name: Extract version
        id: version
        run: echo "version=${GITHUB_REF_NAME#v}" >> $GITHUB_OUTPUT

      - name: Build binary
        run: |
          go build -ldflags "-s -w -X main.Version=${{ steps.version.outputs.version }}" \
            -o xmeow-ui ./cmd/xmeow-ui/
        env:
          CGO_ENABLED: '0'
          GOOS: ${{ matrix.goos }}
          GOARCH: ${{ matrix.goarch }}
          GOMIPS: ${{ matrix.gomips }}
          GOARM: ${{ matrix.goarm }}

      - name: Compress with UPX
        uses: crazy-max/ghaction-upx@v3
        with:
          version: latest
          files: xmeow-ui
          args: --best --lzma

      - name: Package
        run: |
          tar -czf xmeow-ui_${{ steps.version.outputs.version }}_${{ matrix.suffix }}.tar.gz \
            xmeow-ui README.md

      - uses: actions/upload-artifact@v4
        with:
          name: binary-${{ matrix.suffix }}
          path: '*.tar.gz'

  release:
    needs: [build-frontend, build-binaries]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          pattern: binary-*
          merge-multiple: true

      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - name: Package dist.tar.gz
        run: tar -czf dist.tar.gz -C dist/ .

      - name: Generate checksums
        run: sha256sum *.tar.gz > checksums.txt

      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          name: "XMeow UI ${{ github.ref_name }}"
          generate_release_notes: true
          prerelease: ${{ contains(github.ref_name, '-') }}
          files: |
            *.tar.gz
            checksums.txt
```

### CI Workflow Structure

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v6
        with:
          node-version: '22'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm run build

      - uses: actions/setup-go@v6
        with:
          go-version: '1.25'

      - name: Build Go binary
        run: go build -ldflags "-s -w" ./cmd/xmeow-ui/
        env:
          CGO_ENABLED: '0'
```

### Checksums Format

```
e3b0c44298fc1c149afbf4c8996fb92427ae41e4...  xmeow-ui_1.0.0_linux_arm64.tar.gz
a1b2c3d4e5f6789012345678901234567890abcd...  xmeow-ui_1.0.0_linux_mipsle.tar.gz
...
d4e5f6a7b8c9012345678901234567890abcdef0...  dist.tar.gz
4f5e6d7c8b9a012345678901234567890abcdef1...  checksums.txt
```

Примечание: checksums.txt НЕ должен включать сам себя. Генерация: `sha256sum *.tar.gz > checksums.txt`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `actions/checkout@v4` | `actions/checkout@v6` | 2025-2026 | Node 24 runtime |
| `actions/setup-go@v4` | `actions/setup-go@v6` | 2025-2026 | Встроенный кэш Go modules по умолчанию |
| `actions/setup-node@v4` | `actions/setup-node@v6` | 2025-2026 | Node 24 runtime |
| `pnpm/action-setup@v2` | `pnpm/action-setup@v4` | 2024-2025 | v2 сломан с новыми Node |
| `softprops/action-gh-release@v1` | `@v2` | 2024 | Draft-until-complete, prerelease input |
| UPX 3.96 (MIPS сломан) | UPX 5.1.0 | 2026-01 | PT_MIPS_ABIFLAGS, MIPS stub fixes |
| goreleaser | Ручной workflow | -- | Goreleaser избыточен для 5 Linux-only архитектур без CGO |

**Deprecated/outdated:**
- `actions/create-release` -- archived, заменён `softprops/action-gh-release`
- `actions/upload-release-asset` -- archived, `softprops/action-gh-release` делает всё в одном шаге
- `pnpm/action-setup@v2` -- не работает с Node 20+

## Open Questions

1. **UPX + MIPS на реальном устройстве**
   - What we know: UPX 5.0+ исправил PT_MIPS_ABIFLAGS, 3.99+ исправил stub. Теоретически работает.
   - What's unclear: Реальное тестирование Go 1.25 + UPX 5.1 + MIPS softfloat не подтверждено
   - Recommendation: Включить UPX для всех архитектур, но иметь план отключения для MIPS (комментарий в workflow). Пользователь сможет проверить на устройстве после первого релиза.

2. **README.md для артефакта**
   - What we know: Решено включать в tar.gz
   - What's unclear: Содержимое README -- инструкция по установке? Changelog?
   - Recommendation: Краткий README с: описание проекта, инструкция запуска, ссылка на GitHub repo. Содержание определить при планировании.

3. **packageManager в package.json**
   - What we know: Поле `packageManager` не задано в package.json; pnpm/action-setup@v4 может использовать его для автоопределения версии
   - What's unclear: Нужно ли добавить его
   - Recommendation: В pnpm/action-setup@v4 не указывать version -- action возьмёт latest. Или добавить `packageManager` поле в package.json для воспроизводимости.

## Sources

### Primary (HIGH confidence)
- `cmd/xmeow-ui/main.go` -- var Version = "dev" с ldflags комментарием, подтверждает injection point
- `embed.go` -- `//go:embed all:dist`, подтверждает что dist/ нужна перед go build
- `go.mod` -- go 1.25.0, модуль github.com/mewbing/XKeen-UI-Xmeow
- `package.json` -- pnpm, build script: `tsc -b && vite build`, Vite 7
- [softprops/action-gh-release](https://github.com/softprops/action-gh-release) -- v2.5.0, generate_release_notes, prerelease
- [crazy-max/ghaction-upx](https://github.com/crazy-max/ghaction-upx) -- v3.2.0, version/files/args inputs
- [actions/setup-go](https://github.com/actions/setup-go) -- v6, built-in cache, go-version support
- [UPX releases](https://github.com/upx/upx/releases) -- v5.1.0 (2026-01-07)
- [UPX NEWS](https://github.com/upx/upx/blob/master/NEWS) -- 5.0: PT_MIPS_ABIFLAGS forwarding

### Secondary (MEDIUM confidence)
- [pnpm CI docs](https://pnpm.io/continuous-integration) -- pnpm/action-setup перед setup-node
- [Go MIPS wiki](https://go.dev/wiki/GoMips) -- GOMIPS=softfloat обязателен для softfloat устройств
- [Vite 7 migration](https://vite.dev/guide/migration) -- требует Node.js 20.19+ или 22.12+
- [UPX issue #339](https://github.com/upx/upx/issues/339) -- MIPS hang fix в 3.99+

### Tertiary (LOW confidence)
- UPX + Go 1.25 + MIPS softfloat -- нет подтверждённых тестов именно этой комбинации

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- все actions проверены через официальные репозитории и README
- Architecture: HIGH -- паттерн multi-job с matrix стандартен для Go cross-compilation
- Pitfalls: HIGH -- GOMIPS, go:embed, pnpm order -- подтверждены множеством источников
- UPX MIPS: MEDIUM -- исправления подтверждены, но конкретная комбинация не тестирована

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (30 days -- stable domain, actions pinned to major versions)
