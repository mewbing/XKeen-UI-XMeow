---
phase: 15-self-update-backend
verified: 2026-03-03T11:15:00Z
status: passed
score: 6/6 must-haves verified
must_haves:
  truths:
    - "GET /api/update/check возвращает JSON с current_version, latest_version, has_update, release_notes"
    - "POST /api/update/apply скачивает, верифицирует SHA256 и заменяет бинарник атомарно с backup"
    - "После замены бинарника сервис перезапускается через init.d S99xmeow-ui"
    - "Результат проверки кэшируется на 1 час (повторные вызовы check не обращаются к GitHub)"
    - "Backend автоопределяет режим embedded vs external-ui по полю в mihomo config"
    - "В external-ui режиме POST /api/update/apply-dist скачивает и распаковывает dist.tar.gz"
  artifacts:
    - path: "internal/updater/updater.go"
      provides: "Updater struct with Check/Apply/Rollback/ApplyDist, ReleaseInfo, cache"
    - path: "internal/updater/github.go"
      provides: "GitHub API client, fetchLatestRelease, findAssets, compareVersions, downloadFile"
    - path: "internal/updater/archive.go"
      provides: "extractBinaryFromTarGz, verifyChecksum, extractDistTarGz with security"
    - path: "internal/updater/disk_linux.go"
      provides: "checkDiskSpace via unix.Statfs with 20MB minimum"
    - path: "internal/updater/disk_other.go"
      provides: "No-op checkDiskSpace stub for non-Linux dev builds"
    - path: "internal/handler/update.go"
      provides: "HTTP handlers: CheckUpdate, ApplyUpdate, RollbackUpdate, ApplyDist"
    - path: "internal/server/routes.go"
      provides: "Route registration for /api/update/* under auth middleware"
    - path: "internal/server/server.go"
      provides: "Updater creation and wiring into NewRouter"
    - path: "internal/config/config.go"
      provides: "Exported ReadMihomoField for cross-package access"
  key_links:
    - from: "internal/updater/updater.go"
      to: "internal/updater/github.go"
      via: "fetchLatestRelease call in Check()"
    - from: "internal/updater/updater.go"
      to: "internal/updater/archive.go"
      via: "extractBinaryFromTarGz, verifyChecksum in Apply()"
    - from: "internal/handler/update.go"
      to: "internal/updater/updater.go"
      via: "u.updater.Check/Apply/Rollback/ApplyDist calls"
    - from: "internal/server/routes.go"
      to: "internal/handler/update.go"
      via: "uh.CheckUpdate/ApplyUpdate/RollbackUpdate/ApplyDist"
    - from: "internal/server/server.go"
      to: "internal/updater/updater.go"
      via: "updater.NewUpdater(cfg)"
---

# Phase 15: Self-Update Backend Verification Report

**Phase Goal:** Go backend умеет проверять и устанавливать обновления из GitHub releases, атомарно заменяя свой бинарник с backup/rollback. В external-ui режиме -- отдельно обновляет SPA файлы в директории mihomo.
**Verified:** 2026-03-03T11:15:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/update/check возвращает информацию о доступном обновлении (текущая версия, последняя версия, changelog, has_update) | VERIFIED | `internal/handler/update.go:35-48` -- CheckUpdate handler с 15s timeout, вызывает `u.updater.Check(ctx)`, возвращает ReleaseInfo через writeJSON. ReleaseInfo struct (`updater.go:17-32`) содержит все поля с JSON-тегами: current_version, latest_version, has_update, release_notes, published_at, asset_name, asset_size, dist_size, is_prerelease |
| 2 | POST /api/update/apply скачивает новый бинарник, заменяет текущий атомарно (rename) с сохранением backup для rollback | VERIFIED | `internal/handler/update.go:52-81` -- ApplyUpdate handler с 5min timeout, вызывает `u.updater.Apply(ctx)`. Apply() в `updater.go:114-197` выполняет полный цикл: downloadFile -> verifyChecksum -> extractBinaryFromTarGz -> os.Rename(exePath, bakPath) -> os.Rename(newBinaryPath, exePath) с rollback при ошибке (строки 186-188) |
| 3 | После замены бинарника сервис перезапускается через init.d -- новая версия без ручного вмешательства | VERIFIED | `internal/handler/update.go:80` -- `time.AfterFunc(1*time.Second, restartService)` после отправки HTTP ответа. `restartService()` (строки 158-168) вызывает `exec.Command("/opt/etc/init.d/S99xmeow-ui", "restart").Start()` -- fire-and-forget. HTTP response отправляется и flush'ится ДО рестарта (строки 71-77) |
| 4 | Результат проверки кэшируется на 1 час -- повторные вызовы check не обращаются к GitHub API | VERIFIED | `updater.go:49` -- `cacheTTL: 1 * time.Hour`. Check() (строки 58-64): `u.cached != nil && time.Since(u.cachedAt) < u.cacheTTL` -- возвращает копию кэша без обращения к API. InvalidateCache() (строки 231-234) обнуляет кэш после Apply() |
| 5 | Backend автоопределяет режим работы (embedded SPA vs external-ui) и выбирает стратегию обновления | VERIFIED | `updater.go:239-242` -- IsExternalUI() вызывает `config.ReadMihomoField(u.cfg.MihomoConfigPath, "external-ui")`, возвращает true если поле не пустое. Используется в `handler/update.go:110` для guard на ApplyDist endpoint |
| 6 | В external-ui режиме POST /api/update/apply-dist скачивает dist.tar.gz и распаковывает в директорию external-ui mihomo | VERIFIED | `handler/update.go:109-153` -- ApplyDist handler: проверяет IsExternalUI(), разрешает путь external-ui из mihomo config (относительный -> абсолютный), вызывает `u.updater.ApplyDist(ctx, externalUIDir)`. ApplyDist() в `updater.go:247-297`: download -> verify SHA256 -> extractDistTarGz() с zip-slip защитой |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `internal/updater/updater.go` | Updater struct with Check/Apply/Rollback/ApplyDist, ReleaseInfo, cache | VERIFIED | 297 строк. Экспортирует: Updater, NewUpdater, ReleaseInfo, Check, Apply, Rollback, IsUpdating, InvalidateCache, IsExternalUI, ApplyDist. RWMutex кэш, atomic.Bool update lock |
| `internal/updater/github.go` | GitHub API client, release parsing, asset matching | VERIFIED | 163 строки. fetchLatestRelease с context/timeout, findAssets по runtime.GOOS/GOARCH, compareVersions с semver parsing, downloadFile с streaming io.Copy |
| `internal/updater/archive.go` | tar.gz extraction, SHA256 verification, dist extraction | VERIFIED | 180 строк. extractBinaryFromTarGz с filepath.Base (security) + LimitReader 100MB. verifyChecksum: SHA256 hash comparison. extractDistTarGz с zip-slip protection |
| `internal/updater/disk_linux.go` | Disk space check via unix.Statfs | VERIFIED | 30 строк. unix.Statfs, Bavail * Bsize, минимум 20MB |
| `internal/updater/disk_other.go` | No-op stub for non-Linux | VERIFIED | 9 строк. Build tag `!linux`, возвращает nil |
| `internal/handler/update.go` | HTTP handlers for 4 update endpoints | VERIFIED | 168 строк. CheckUpdate (GET), ApplyUpdate (POST), RollbackUpdate (POST), ApplyDist (POST). restartService() через init.d |
| `internal/server/routes.go` | Route registration for /api/update/* | VERIFIED | Строки 85-90: r.Route("/update", ...) с 4 маршрутами под auth middleware group |
| `internal/server/server.go` | Updater wiring | VERIFIED | Строка 27: `upd := updater.NewUpdater(cfg)`, строка 28: передача в NewRouter |
| `internal/config/config.go` | Exported ReadMihomoField | VERIFIED | Строки 71-101: ReadMihomoField экспортирована (заглавная R), используется GetMihomoSecret и GetMihomoExternalController как обёртки |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `updater.go` | `github.go` | fetchLatestRelease call in Check() | WIRED | updater.go:67 -- `fetchLatestRelease(ctx, "XMeow-UI/"+u.cfg.Version)` |
| `updater.go` | `archive.go` | extractBinaryFromTarGz, verifyChecksum in Apply() | WIRED | updater.go:162 -- `verifyChecksum(...)`, updater.go:168 -- `extractBinaryFromTarGz(...)` |
| `updater.go` | `archive.go` | extractDistTarGz in ApplyDist() | WIRED | updater.go:292 -- `extractDistTarGz(tmpPath, destDir)` |
| `updater.go` | `config.go` | ReadMihomoField for external-ui detection | WIRED | updater.go:240 -- `config.ReadMihomoField(u.cfg.MihomoConfigPath, "external-ui")` |
| `handler/update.go` | `updater.go` | Updater dependency injection | WIRED | update.go:39 `u.updater.Check(ctx)`, update.go:63 `u.updater.Apply(ctx)`, update.go:86 `u.updater.Rollback()`, update.go:142 `u.updater.ApplyDist(ctx, ...)` |
| `routes.go` | `handler/update.go` | Route registration | WIRED | routes.go:46 `uh := handler.NewUpdateHandler(upd, cfg)`, routes.go:86-89 `uh.CheckUpdate/ApplyUpdate/RollbackUpdate/ApplyDist` |
| `server.go` | `updater.go` | NewUpdater creation | WIRED | server.go:27 `upd := updater.NewUpdater(cfg)`, server.go:28 `NewRouter(cfg, spaHandler, logHub, upd)` |
| `handler/update.go` | init.d script | exec.Command for restart | WIRED | update.go:165 `exec.Command(initdScript, "restart").Start()` where initdScript = "/opt/etc/init.d/S99xmeow-ui" |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SUPD-01 | 15-01, 15-02 | Backend checks GitHub releases for newer version via API | SATISFIED | `github.go:39-69` fetchLatestRelease с GitHub API, `updater.go:56-108` Check() сравнивает версии, `handler/update.go:35-48` CheckUpdate endpoint |
| SUPD-02 | 15-01, 15-02 | Backend downloads and replaces own binary atomically with rollback backup | SATISFIED | `updater.go:114-197` Apply(): download -> SHA256 verify -> os.Rename backup -> os.Rename replace. Rollback() строки 200-223: restore .bak |
| SUPD-03 | 15-02 | Backend restarts gracefully after self-update via init.d | SATISFIED | `handler/update.go:80,103` time.AfterFunc(1s, restartService), `update.go:158-168` exec.Command(S99xmeow-ui, "restart") |
| SUPD-04 | 15-01 | Backend caches update check results (1h TTL) | SATISFIED | `updater.go:49` cacheTTL 1*time.Hour, `updater.go:58-64` RLock check cache validity, `updater.go:102-105` WLock save to cache |
| SUPD-05 | 15-01, 15-02 | Backend auto-detects deployment mode (embedded vs external-ui) | SATISFIED | `updater.go:239-242` IsExternalUI() reads "external-ui" field from mihomo config. Used in `handler/update.go:110` |
| SUPD-06 | 15-02 | In external-ui mode: downloads and extracts dist.tar.gz | SATISFIED | `updater.go:247-297` ApplyDist(): download dist.tar.gz -> verify SHA256 -> extractDistTarGz with zip-slip protection. `handler/update.go:109-153` ApplyDist endpoint |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `internal/updater/updater.go` | 75 | Hardcoded `"linux", "arm64"` in error message instead of `runtime.GOOS`/`runtime.GOARCH` | Info | Misleading error message on non-arm64 platforms; actual asset search in `findAssets()` correctly uses runtime values. Cosmetic issue only |

### Human Verification Required

### 1. Полный цикл обновления на роутере

**Test:** Собрать бинарник v0.0.1, задеплоить на роутер, создать релиз v0.0.2 на GitHub, вызвать POST /api/update/apply, проверить что сервис перезапустился с новой версией.
**Expected:** GET /api/versions показывает v0.0.2 после рестарта.
**Why human:** Требует реальное окружение: GitHub release, роутер с init.d, Entware FS. Нельзя проверить grep'ом.

### 2. Rollback после неудачного обновления

**Test:** Обновить бинарник, затем вызвать POST /api/update/rollback.
**Expected:** Сервис перезапускается с предыдущей версией, GET /api/versions возвращает старую версию.
**Why human:** Требует реальный бинарник и init.d перезапуск.

### 3. External-UI dist обновление

**Test:** Настроить mihomo с external-ui, вызвать POST /api/update/apply-dist.
**Expected:** Файлы в external-ui директории обновляются, UI перезагружается с новой версией.
**Why human:** Требует настроенное external-ui окружение на роутере.

### 4. Кэширование 1h TTL

**Test:** Вызвать GET /api/update/check дважды с интервалом < 1 часа.
**Expected:** Второй вызов не делает запрос к GitHub API (проверить через network monitoring или логи).
**Why human:** Требует мониторинг реальных HTTP запросов к GitHub.

### Gaps Summary

Gaps не обнаружены. Все 6 success criteria из ROADMAP.md выполнены. Все 6 требований (SUPD-01 через SUPD-06) удовлетворены. Все артефакты существуют, содержат substantive реализацию (не stubs), и правильно связаны между собой.

Три коммита подтверждены: `62269e3` (github.go + archive.go), `13fec1d` (updater.go + config.go), `d42ac26` (handler/update.go + routes + server wiring).

Все пакеты компилируются (`go build`) и проходят `go vet` без ошибок.

Единственное замечание (Info severity): в `updater.go:75` сообщение об ошибке содержит хардкод `"linux", "arm64"` вместо `runtime.GOOS`/`runtime.GOARCH` -- косметическая проблема, не влияющая на функциональность.

---

_Verified: 2026-03-03T11:15:00Z_
_Verifier: Claude (gsd-verifier)_
