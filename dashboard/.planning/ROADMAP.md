# Roadmap: Mihomo Dashboard

## Overview

Полнофункциональный SPA-дашборд для mihomo прокси на роутере Keenetic. Заменяет zashboard, добавляя визуальное редактирование конфига (drag-and-drop правил и групп), просмотрщик geodata, raw YAML редактор, управление сервисом и самообновление. v1.0 -- React SPA + Flask backend (фазы 1-11). v2.0 -- Go backend (единый бинарник), installer, self-update, CI/CD (фазы 12-16).

## Milestones

- 🚧 **v1.0 Dashboard** - Phases 1-11 (in progress, 6/11 complete)
- 📋 **v0.1.0 Go Backend + Installer** - Phases 12-16 (first release)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

### v1.0 Dashboard

- [x] **Phase 1: Scaffold + Config API + Setup Wizard** - React проект, Flask backend с CRUD для конфига, мастер настройки
- [x] **Phase 2: Overview + Service Management** - Главная страница со статистикой, управление xkeen, обновление ядра (completed 2026-02-27)
- [x] **Phase 3: Proxies Page** - Карточки proxy-groups, переключение прокси, тест задержки (completed 2026-02-27)
- [x] **Phase 4: Connections + Logs** - Таблица подключений в реальном времени, лог-стрим через WebSocket
- [x] **Phase 5: Config Raw Editor** - Monaco Editor с табами (config, ip_exclude, port_exclude, port_proxying), live-лог (completed 2026-02-28)
- [x] **Phase 6: Rules Visual Editor** - Визуальные блоки правил с drag-and-drop приоритизацией
- [ ] **Phase 7: Groups Editor** - Редактор proxy-groups с drag-and-drop и синхронизацией GLOBAL
- [ ] **Phase 8: Providers Page** - Список rule-providers и proxy-providers со статусом и обновлением
- [ ] **Phase 9: Geodata Viewer** - Просмотрщик GeoSite/GeoIP файлов с поиском и копированием правил
- [ ] **Phase 10: Self-Update** - Механизм обновления дашборда и бэкенда из GitHub releases
- [ ] **Phase 11: Polish + Themes** - Тёмная/светлая тема, адаптивность, финальное тестирование

### v0.1.0 Go Backend + Installer

- [x] **Phase 12: Go Backend Core** - Go бинарник с 1:1 API совместимостью Flask, embedded SPA, reverse proxy mihomo (completed 2026-03-02)
- [x] **Phase 13: CI/CD Pipeline** - GitHub Actions cross-compilation arm64/mipsle/mips, автоматические релизы (completed 2026-03-03)
- [x] **Phase 14: Installer (setup.sh)** - Install-only POSIX sh скрипт для Entware с init.d сервисом (completed 2026-03-03)
- [x] **Phase 15: Self-Update Backend** - Проверка и установка обновлений из GitHub releases с атомарной заменой бинарника (completed 2026-03-03)
- [x] **Phase 16: Update Frontend** - Страница обновлений, sidebar badge, авто-проверка (completed 2026-03-04)

## Phase Details

### Phase 1: Scaffold + Config API + Setup Wizard
**Goal**: Работающий скаффолд React + Flask, API для чтения/записи конфига, мастер первоначальной настройки
**Depends on**: Nothing (first phase)
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04, API-01, API-02, API-03, API-04
**Success Criteria**:
  1. `npm run dev` запускает React SPA на localhost
  2. Flask backend отвечает на GET/PUT /api/config
  3. Setup wizard определяет тип установки (локальный/CDN) и сохраняет настройки
  4. Config API создаёт backup перед перезаписью конфига
**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md -- Scaffold Vite + React + TypeScript + Tailwind v4 + shadcn/ui + Flask skeleton
- [x] 01-02-PLAN.md -- Layout (collapsible sidebar), routing, 11 страниц-заглушек, Settings page, Zustand store
- [x] 01-03-PLAN.md -- Flask Config API (GET/PUT config, xkeen files, YAML validation, backup)
- [x] 01-04-PLAN.md -- Setup Wizard (3 шага: тип установки, тест подключения, экран успеха)

### Phase 2: Overview + Service Management
**Goal**: Главная страница с мониторингом и управлением сервисом xkeen
**Depends on**: Phase 1
**Requirements**: API-05, API-06, OVER-01, OVER-02, OVER-03, OVER-04, OVER-05
**Success Criteria**:
  1. Overview показывает uptime, трафик, скорость, активные подключения из mihomo API
  2. Кнопки Start/Stop/Restart работают через Config API
  3. Версия mihomo и дашборда отображаются
  4. Кнопка обновления ядра проверяет и устанавливает обновления
**Plans:** 5/5 plans complete

Plans:
- [x] 02-01-PLAN.md -- Backend API (service management endpoints) + frontend API clients, format utils, shadcn/ui components
- [x] 02-02-PLAN.md -- Overview page: WebSocket hook, Zustand store, metrics cards, traffic chart, version display
- [x] 02-03-PLAN.md -- Service control: Header status badge, start/stop/restart dropdown, kernel update overlay, sidebar versions
- [ ] 02-04-PLAN.md -- Gap closure: Fix metrics overflow, uptime reset, traffic chart colors (UAT tests 1-3)
- [ ] 02-05-PLAN.md -- Gap closure: Fix service status process name, Vite proxy routing, API error handling (UAT test 5)

### Phase 3: Proxies Page
**Goal**: Управление прокси-группами как в zashboard с настраиваемым отображением карточек, переключением прокси и тестом задержки
**Depends on**: Phase 1
**Requirements**: PROX-01, PROX-02, PROX-03
**Success Criteria**:
  1. Все proxy-groups отображаются как карточки с текущим выбором
  2. Клик переключает прокси внутри группы
  3. Тест задержки работает для отдельных прокси
**Plans:** 2/2 plans complete

Plans:
- [x] 03-01-PLAN.md -- Инфраструктура: shadcn/ui компоненты, API-клиент прокси, Zustand stores, Toaster, formatDelay
- [ ] 03-02-PLAN.md -- UI компоненты: карточки групп, inline expand, тулбар, поповер настроек, страница ProxiesPage

### Phase 4: Connections + Logs
**Goal**: Мониторинг подключений в реальном времени и полный лог-стрим
**Depends on**: Phase 1
**Requirements**: CONN-01, CONN-02, CONN-03, LOGS-01, LOGS-02, LOGS-03, LOGS-04
**Success Criteria**:
  1. Таблица подключений обновляется в реальном времени (WebSocket)
  2. Поиск и фильтрация по source/destination/rule/proxy работают
  3. Кнопка закрытия соединения работает
  4. Лог-стрим показывает все уровни с фильтрацией
**Plans:** 3/3 plans complete

Plans:
- [x] 04-01-PLAN.md -- Инфраструктура: @tanstack/react-virtual, shadcn Tabs, Zustand stores (connections + logs), API, табовая страница с WebSocket
- [x] 04-02-PLAN.md -- Connections tab: виртуализированная таблица, тулбар с фильтрами, раскрывающиеся строки, закрытие соединений
- [x] 04-03-PLAN.md -- Logs tab: мини-карточки логов, бейджи уровней, авто-скролл, очистка, экспорт TXT/JSON

### Phase 5: Config Raw Editor
**Goal**: Полноценный YAML-редактор с валидацией и live-логом
**Depends on**: Phase 1
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05
**Success Criteria**:
  1. Monaco Editor загружает config.yaml с подсветкой синтаксиса
  2. Табы переключают между config, ip_exclude, port_exclude, port_proxying
  3. Индикатор валидности YAML обновляется при редактировании
  4. При нажатии Apply в панели логов видна реакция mihomo
**Plans:** 3/3 plans complete

Plans:
- [ ] 05-01-PLAN.md -- Инфраструктура: установка Monaco Editor, js-yaml, shadcn resizable, Zustand store, расширение API-клиента
- [ ] 05-02-PLAN.md -- Ядро редактора: Monaco Editor обёртка, тулбар с табами, Save/Apply/Format, YAML-валидация, диалоги
- [ ] 05-03-PLAN.md -- Лог-панель, diff-превью, ресайзабельная раскладка, сборка ConfigEditorPage

### Phase 6: Rules Visual Editor
**Goal**: Визуальное редактирование правил с drag-and-drop приоритизацией
**Depends on**: Phase 5
**Requirements**: RULE-01, RULE-02, RULE-03, RULE-04, RULE-05, RULE-06, RULE-07, RULE-08
**Success Criteria**:
  1. Правила отображаются как визуальные блоки-карточки по сервисам
  2. Drag-and-drop перемещение блоков меняет приоритет (отражается в config.yaml)
  3. Раскрытие блока показывает все правила внутри
  4. Добавление/удаление правил и смена целевой группы сохраняются в конфиг
**Plans:** 4 plans

Plans:
- [ ] 06-01-PLAN.md -- Инфраструктура: установка yaml/dnd-kit/zundo, rules-parser с комментариями, Zustand store с undo/redo, настройки
- [ ] 06-02-PLAN.md -- Core UI: карточки блоков, сортируемый список с DnD, тулбар с переключателями группировки/лейаута/плотности, RulesPage
- [ ] 06-03-PLAN.md -- Редактирование: диалоги добавления/создания, смена proxy-group, удаление с подтверждением, DnD внутри блока
- [x] 06-04-PLAN.md -- Save/Apply/Undo: сохранение, diff-превью, Reset, Ctrl+Z, бейдж-счётчик, предупреждения, настройки

### Phase 7: Groups Editor
**Goal**: Визуальное управление proxy-groups с синхронизацией GLOBAL
**Depends on**: Phase 5
**Requirements**: GRPS-01, GRPS-02, GRPS-03, GRPS-04, GRPS-05
**Success Criteria**:
  1. Proxy-groups отображаются как перетаскиваемые карточки
  2. Drag-and-drop изменяет порядок и синхронизирует proxy-groups + GLOBAL.proxies
  3. Редактирование группы (имя, тип, иконка, список прокси) сохраняется
  4. Создание и удаление группы работает
**Plans**: TBD

### Phase 8: Providers Page
**Goal**: Мониторинг и управление rule-providers и proxy-providers
**Depends on**: Phase 1
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04
**Success Criteria**:
  1. Список rule-providers с статусом, кол-вом записей, датой обновления
  2. Список proxy-providers с статусом
  3. Кнопка обновления работает для отдельного провайдера и для всех
**Plans**: TBD

### Phase 9: Geodata Viewer
**Goal**: Просмотрщик GeoSite/GeoIP файлов с поиском для вставки в конфиг
**Depends on**: Phase 1
**Requirements**: API-07, GEO-01, GEO-02, GEO-03, GEO-04, GEO-05, GEO-06
**Success Criteria**:
  1. Список geodata файлов из директории mihomo на роутере
  2. GeoSite: категории раскрываются, показывая домены/правила
  3. GeoIP: коды стран раскрываются, показывая IP-диапазоны
  4. Поиск находит записи по всем категориям (например, "discord" -> все совпадения)
  5. Копирование в формате mihomo-правила работает
**Plans**: TBD

### Phase 10: Self-Update
**Goal**: Самообновление дашборда и бэкенда из GitHub
**Depends on**: Phase 1
**Requirements**: UPDT-01, UPDT-02, UPDT-03
**Success Criteria**:
  1. Проверка обновлений через GitHub releases API
  2. Обновление скачивает dist.zip + новый server.py
  3. После обновления бэкенд перезапускается, SPA загружает новую версию
**Plans**: TBD

### Phase 11: Polish + Themes
**Goal**: Финальная полировка UI, тёмная/светлая тема, тестирование
**Depends on**: All previous phases
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria**:
  1. Переключение тёмной/светлой темы работает на всех страницах
  2. Русский язык по умолчанию для всех элементов интерфейса
  3. Responsive layout работает на desktop и tablet
**Plans**: TBD

### Phase 12: Go Backend Core
**Goal**: Go бинарник полностью заменяет Flask backend с идентичным API-контрактом, embedded SPA и reverse proxy к mihomo
**Depends on**: Phase 6 (needs working SPA frontend to embed)
**Requirements**: GOBK-01, GOBK-02, GOBK-03, GOBK-04, GOBK-05, GOBK-06, GOBK-07, GOBK-08
**Success Criteria** (what must be TRUE):
  1. Go бинарник отвечает на все 15 REST API эндпоинтов идентично Flask (GET/PUT config, xkeen files, service control, status)
  2. WebSocket стрим логов работает с тем же протоколом (initial/append/clear/ping) -- фронтенд подключается без изменений
  3. SPA загружается из embedded файловой системы по корневому URL -- не нужен отдельный каталог static files
  4. Запросы к mihomo API (:9090) проксируются через Go backend с автоматической подстановкой auth header
  5. Конфиг и xkeen файлы валидируются и бэкапятся перед записью -- поведение идентично Flask
**Plans:** 4/4 plans complete

Plans:
- [x] 12-01-PLAN.md -- Go scaffold: module init, chi router, SPA embed, CORS/auth middleware, config loading, health endpoint
- [x] 12-02-PLAN.md -- REST API: все 14 handlers (config, xkeen, service, versions, system, logs, proxies) + route registration
- [x] 12-03-PLAN.md -- WebSocket: log streaming с fsnotify lazy watcher, bidirectional protocol, polling fallback
- [x] 12-04-PLAN.md -- Reverse proxy mihomo API с auth injection + Vite dev config update + integration checkpoint

### Phase 13: CI/CD Pipeline
**Goal**: GitHub Actions автоматически собирает Go бинарники для всех архитектур роутера и создаёт GitHub Release
**Depends on**: Phase 12
**Requirements**: CICD-01, CICD-02, CICD-03, CICD-04
**Success Criteria** (what must be TRUE):
  1. Push тега `v*` запускает workflow, который собирает бинарники для linux/arm64, linux/mipsle (softfloat), linux/mips (softfloat)
  2. Frontend собирается (npm run build) и встраивается в Go бинарник на этапе сборки
  3. GitHub Release создаётся автоматически с тремя архитектурно-специфичными .tar.gz артефактами
  4. Версия в бинарнике соответствует git tag (через Go ldflags -X main.Version)
**Plans:** 1/1 plans complete

Plans:
- [x] 13-01-PLAN.md -- CI workflow (push/PR проверка) + Release workflow (3-job pipeline: frontend build, matrix cross-compile 5 arch, GitHub Release)

### Phase 14: Installer (setup.sh)
**Goal**: Пользователь устанавливает серверную часть на роутер одной командой `curl | sh` — только установка, обновления через дашборд UI
**Depends on**: Phase 13 (needs CI-produced release binaries to download)
**Requirements**: INST-01, INST-02, INST-03, INST-04, INST-05
**Success Criteria** (what must be TRUE):
  1. Команда `curl -sL https://...setup.sh | sh` скачивает и запускает установщик на роутере
  2. Установщик определяет архитектуру роутера (arm64/mipsle/mips) и скачивает правильный бинарник из GitHub releases
  3. Скрипт install-only: без update/uninstall меню (обновления через UI дашборда)
  4. После установки создан init.d скрипт S99xmeow-ui, сервис запущен, дашборд доступен в браузере на порту 5000
**Plans:** 2 plans

Plans:
- [x] 14-01-PLAN.md -- CI rename (xmeow-ui -> xmeow-server) + Go --version flag
- [x] 14-02-PLAN.md -- setup.sh install-only script (arch detection, binary download, SHA256, init.d, .gitattributes for LF)

### Phase 15: Self-Update Backend
**Goal**: Go backend умеет проверять и устанавливать обновления из GitHub releases, атомарно заменяя свой бинарник. В external-ui режиме — отдельно обновляет SPA файлы в директории mihomo.
**Depends on**: Phase 14 (needs init.d service script for restart mechanism)
**Requirements**: SUPD-01, SUPD-02, SUPD-03, SUPD-04, SUPD-05, SUPD-06
**Success Criteria** (what must be TRUE):
  1. GET /api/update/check возвращает информацию о доступном обновлении (текущая версия, последняя версия, changelog, есть ли update)
  2. POST /api/update/apply скачивает новый бинарник, заменяет текущий атомарно (rename) с сохранением backup для rollback
  3. После замены бинарника сервис перезапускается через init.d -- новая версия обслуживает запросы без ручного вмешательства
  4. Результат проверки кэшируется на 1 час -- повторные вызовы check не обращаются к GitHub API
  5. Backend автоопределяет режим работы (embedded SPA vs external-ui) и выбирает стратегию обновления
  6. В external-ui режиме POST /api/update/apply скачивает dist.tar.gz и распаковывает в директорию external-ui mihomo
**Plans:** 2/2 plans complete

Plans:
- [x] 15-01-PLAN.md -- Core updater package: GitHub API client, archive extraction, SHA256 verification, atomic binary replacement, cache, rollback
- [x] 15-02-PLAN.md -- HTTP handlers (/api/update/*), route registration, init.d restart, external-ui dist update, checkpoint

### Phase 16: Update Frontend
**Goal**: Пользователь видит доступные обновления в UI и может обновить дашборд одним кликом. В external-ui режиме — раздельный статус версий сервера и дашборда.
**Depends on**: Phase 15 (needs backend update API)
**Requirements**: UPUI-01, UPUI-02, UPUI-03, UPUI-04, UPUI-05, UPUI-06
**Success Criteria** (what must be TRUE):
  1. Страница обновлений показывает текущую и последнюю версию с визуальным сравнением
  2. Changelog из GitHub release notes отображается как отформатированный markdown
  3. Кнопка "Обновить" запускает процесс с прогресс-оверлеем -- после завершения страница перезагружается с новой версией
  4. В sidebar появляется badge-индикатор когда доступно обновление
  5. Проверка обновлений происходит автоматически при загрузке приложения и каждые 6 часов
  6. В external-ui режиме UI показывает раздельный статус версий сервера и дашборда с возможностью обновить каждый компонент независимо
**Plans:** 2/2 plans complete

Plans:
- [ ] 16-01-PLAN.md -- Backend is_external_ui + npm deps + API client + Zustand store + settings + sidebar badge + auto-check
- [ ] 16-02-PLAN.md -- Update page UI: status cards, markdown changelog, progress overlay, external-ui dual-card mode

### Phase 17: Web Terminal
**Goal**: Веб-терминал с SSH бэкендом (Go) и xterm.js фронтендом для удалённого shell-доступа к роутеру через модальное окно дашборда
**Depends on**: Phase 16
**Requirements**: TERM-01, TERM-02, TERM-03, TERM-04, TERM-05, TERM-06, TERM-07, TERM-08, TERM-09, TERM-10, TERM-11, TERM-12, TERM-13
**Success Criteria** (what must be TRUE):
  1. Go backend устанавливает SSH-соединение к роутеру и мостит I/O через WebSocket
  2. WS endpoint /ws/terminal защищён Bearer токеном (mihomo secret)
  3. Одна SSH-сессия одновременно с 30-минутным таймаутом неактивности
  4. xterm.js отображает терминал с темой Antigravity в модальном окне
  5. Модальное окно доступно с любой страницы через кнопку в хедере и Ctrl+`
  6. SSH-сессия сохраняется при закрытии/открытии модального окна
  7. Тулбар: подключение/отключение, очистка, поиск, размер шрифта, полный экран
  8. Диалог подключения запрашивает логин/пароль (логин сохраняется, пароль нет)
  9. Терминал автоматически подстраивается под размер контейнера с отправкой resize на бэкенд
**Plans:** 3 plans

Plans:
- [ ] 17-01-PLAN.md -- Go backend: SSH terminal package (session + hub) + WS handler с auth + route registration
- [ ] 17-02-PLAN.md -- Frontend infrastructure: xterm.js deps + Zustand store + WS hook + settings SSH fields
- [ ] 17-03-PLAN.md -- Frontend UI: TerminalModal + TerminalView + TerminalToolbar + ConnectDialog + Header integration

## Progress

**Execution Order:**
v1.0: Phases 1 -> 2 -> 3/4/8 (parallel) -> 5 -> 6/7 (parallel) -> 9 -> 10 -> 11
v2.0: Phases 12 -> 13 -> 14 -> 15 -> 16 (linear chain)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Scaffold + Config API + Setup | v1.0 | 4/4 | Complete | 2026-02-27 |
| 2. Overview + Service Mgmt | v1.0 | 3/5 | Complete | 2026-02-27 |
| 3. Proxies Page | v1.0 | 2/2 | Complete | 2026-02-27 |
| 4. Connections + Logs | v1.0 | 3/3 | Complete | 2026-02-28 |
| 5. Config Raw Editor | v1.0 | 0/3 | Complete | 2026-02-28 |
| 6. Rules Visual Editor | v1.0 | 4/4 | Complete | 2026-03-01 |
| 7. Groups Editor | v1.0 | 0/? | Not started | - |
| 8. Providers Page | v1.0 | 0/? | Not started | - |
| 9. Geodata Viewer | v1.0 | 0/? | Not started | - |
| 10. Self-Update | v1.0 | 0/? | Not started | - |
| 11. Polish + Themes | v1.0 | 0/? | Not started | - |
| 12. Go Backend Core | v2.0 | 4/4 | Complete | 2026-03-02 |
| 13. CI/CD Pipeline | v2.0 | 1/1 | Complete | 2026-03-03 |
| 14. Installer (setup.sh) | v2.0 | 2/2 | Complete | 2026-03-03 |
| 15. Self-Update Backend | v2.0 | 2/2 | Complete | 2026-03-03 |
| 16. Update Frontend | v2.0 | 2/2 | Complete | 2026-03-04 |
| 17. Web Terminal | - | 0/3 | Planned | - |
