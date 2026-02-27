# Roadmap: Mihomo Dashboard

## Overview

Полнофункциональный SPA-дашборд для mihomo прокси на роутере Keenetic. Заменяет zashboard, добавляя визуальное редактирование конфига (drag-and-drop правил и групп), просмотрщик geodata, raw YAML редактор, управление сервисом и самообновление. 11 фаз от скаффолда до финальной полировки.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Scaffold + Config API + Setup Wizard** - React проект, Flask backend с CRUD для конфига, мастер настройки
- [ ] **Phase 2: Overview + Service Management** - Главная страница со статистикой, управление xkeen, обновление ядра
- [ ] **Phase 3: Proxies Page** - Карточки proxy-groups, переключение прокси, тест задержки
- [ ] **Phase 4: Connections + Logs** - Таблица подключений в реальном времени, лог-стрим через WebSocket
- [ ] **Phase 5: Config Raw Editor** - Monaco Editor с табами (config, ip_exclude, port_exclude, port_proxying), live-лог
- [ ] **Phase 6: Rules Visual Editor** - Визуальные блоки правил с drag-and-drop приоритизацией
- [ ] **Phase 7: Groups Editor** - Редактор proxy-groups с drag-and-drop и синхронизацией GLOBAL
- [ ] **Phase 8: Providers Page** - Список rule-providers и proxy-providers со статусом и обновлением
- [ ] **Phase 9: Geodata Viewer** - Просмотрщик GeoSite/GeoIP файлов с поиском и копированием правил
- [ ] **Phase 10: Self-Update** - Механизм обновления дашборда и бэкенда из GitHub releases
- [ ] **Phase 11: Polish + Themes** - Тёмная/светлая тема, адаптивность, финальное тестирование

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
**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md -- Backend API (service management endpoints) + frontend API clients, format utils, shadcn/ui components
- [x] 02-02-PLAN.md -- Overview page: WebSocket hook, Zustand store, metrics cards, traffic chart, version display
- [ ] 02-03-PLAN.md -- Service control: Header status badge, start/stop/restart dropdown, kernel update overlay, sidebar versions

### Phase 3: Proxies Page
**Goal**: Управление прокси-группами как в zashboard
**Depends on**: Phase 1
**Requirements**: PROX-01, PROX-02, PROX-03
**Success Criteria**:
  1. Все proxy-groups отображаются как карточки с текущим выбором
  2. Клик переключает прокси внутри группы
  3. Тест задержки работает для отдельных прокси
**Plans**: TBD

### Phase 4: Connections + Logs
**Goal**: Мониторинг подключений в реальном времени и полный лог-стрим
**Depends on**: Phase 1
**Requirements**: CONN-01, CONN-02, CONN-03, LOGS-01, LOGS-02, LOGS-03, LOGS-04
**Success Criteria**:
  1. Таблица подключений обновляется в реальном времени (WebSocket)
  2. Поиск и фильтрация по source/destination/rule/proxy работают
  3. Кнопка закрытия соединения работает
  4. Лог-стрим показывает все уровни с фильтрацией
**Plans**: TBD

### Phase 5: Config Raw Editor
**Goal**: Полноценный YAML-редактор с валидацией и live-логом
**Depends on**: Phase 1
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05
**Success Criteria**:
  1. Monaco Editor загружает config.yaml с подсветкой синтаксиса
  2. Табы переключают между config, ip_exclude, port_exclude, port_proxying
  3. Индикатор валидности YAML обновляется при редактировании
  4. При нажатии Apply в панели логов видна реакция mihomo
**Plans**: TBD

### Phase 6: Rules Visual Editor
**Goal**: Визуальное редактирование правил с drag-and-drop приоритизацией
**Depends on**: Phase 5
**Requirements**: RULE-01, RULE-02, RULE-03, RULE-04, RULE-05, RULE-06, RULE-07, RULE-08
**Success Criteria**:
  1. Правила отображаются как визуальные блоки-карточки по сервисам
  2. Drag-and-drop перемещение блоков меняет приоритет (отражается в config.yaml)
  3. Раскрытие блока показывает все правила внутри
  4. Добавление/удаление правил и смена целевой группы сохраняются в конфиг
**Plans**: TBD

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

## Progress

**Execution Order:**
Phases 1 -> 2 -> 3/4/8 (parallel) -> 5 -> 6/7 (parallel) -> 9 -> 10 -> 11
Note: Phases 3, 4, 8 depend only on Phase 1. Phases 6, 7 depend on Phase 5.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffold + Config API + Setup | 4/4 | Complete | 2026-02-27 |
| 2. Overview + Service Mgmt | 2/3 | In Progress | - |
| 3. Proxies Page | 0/? | Not started | - |
| 4. Connections + Logs | 0/? | Not started | - |
| 5. Config Raw Editor | 0/? | Not started | - |
| 6. Rules Visual Editor | 0/? | Not started | - |
| 7. Groups Editor | 0/? | Not started | - |
| 8. Providers Page | 0/? | Not started | - |
| 9. Geodata Viewer | 0/? | Not started | - |
| 10. Self-Update | 0/? | Not started | - |
| 11. Polish + Themes | 0/? | Not started | - |
