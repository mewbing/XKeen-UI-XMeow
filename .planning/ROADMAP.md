# Roadmap: Mihomo Config Refactoring

## Overview

Рефакторинг конфига mihomo на Keenetic-роутере: от конфига с техническим долгом (дубли правил, разбросанный adult-контент, устаревшие URL) к чистому, поддерживаемому конфигу с автоматической генерацией двух вариантов (personal/work). Пять фаз идут от низкорисковых багфиксов к структурным изменениям и завершаются скриптом генерации.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Bugfixes** - Исправление ошибок и удаление очевидного мертвого кода (OISD дубль, DST-PORT баг, bongacams дубль, Logitech дубль)
- [ ] **Phase 2: Service Deduplication** - Удаление дублирующихся правил сервисов (YouTube, Discord, Telegram, Cloudflare, торренты, refilter)
- [ ] **Phase 3: Adult Content Isolation** - Консолидация всего adult-контента в маркированные блоки для автоматического вырезания
- [ ] **Phase 4: URL Audit & Cleanup** - Проверка актуальности и доступности всех URL-источников, удаление неиспользуемых провайдеров, смена пароля dashboard
- [ ] **Phase 5: Generation Script** - Python-скрипт генерации config-personal.yaml и config-work.yaml из базового конфига

## Phase Details

### Phase 1: Bugfixes
**Goal**: Конфиг не содержит известных ошибок и очевидного мертвого кода
**Depends on**: Nothing (first phase)
**Requirements**: DEDUP-05, DEDUP-08, DEDUP-09, DEDUP-10
**Success Criteria** (what must be TRUE):
  1. Правило DST-PORT,53,53 заменено на корректное (mihomo -t не выдает ошибок на этом правиле)
  2. OISD small удален, загружается только OISD big (одна запись в rule-providers, одно правило в rules)
  3. bongacams.ru присутствует только в adult-блоке, не в категории "Other"
  4. Logitech определен одним способом (KEYWORD или GEOSITE, не оба одновременно)
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Service Deduplication
**Goal**: Каждый сервис определен одним способом маршрутизации, дубли правил полностью устранены
**Depends on**: Phase 1
**Requirements**: DEDUP-01, DEDUP-02, DEDUP-03, DEDUP-04, DEDUP-06, DEDUP-07
**Success Criteria** (what must be TRUE):
  1. YouTube-правила не содержат inline DOMAIN-SUFFIX (используется только RULE-SET/GEOSITE), общее число YouTube-правил сокращено с 17+ до 1-2
  2. Discord определен через один RULE-SET без дублирования в inline-правилах (discord_vc, discord_voiceips и т.д. консолидированы)
  3. Telegram определен через один RULE-SET без дублирующих inline/GEOSITE записей (8+ определений сокращены)
  4. Cloudflare определен через один RULE-SET без 17 inline DOMAIN-SUFFIX
  5. Торрент-правила не дублируются (один блок правил, не два)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: Adult Content Isolation
**Goal**: Весь adult-контент собран в маркированных блоках, готов к автоматическому вырезанию скриптом
**Depends on**: Phase 2
**Requirements**: ADULT-01, ADULT-02, ADULT-03, ADULT-04, ADULT-05, ADULT-06
**Success Criteria** (what must be TRUE):
  1. Все adult proxy-groups (Sin, ST, CB, BG, BGP и переименованные) находятся между маркерами `# >>> ADULT` / `# <<< ADULT` в секции proxy-groups
  2. Все adult rule-providers находятся между маркерами в секции rule-providers
  3. Все inline adult-правила (DOMAIN-SUFFIX, DOMAIN-REGEX) находятся между маркерами в секции rules
  4. OnlyFans, Fansly, PornHub, hanime1, e-hentai, rule34 перенесены из "Other" в adult-блок
  5. Ручное удаление строк между маркерами и grep по списку adult-доменов (pornhub, stripchat, chaturbate, bongacams, onlyfans, fansly, hentai, rule34, nsfw, porn) дает 0 совпадений
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: URL Audit & Cleanup
**Goal**: Все внешние URL-источники актуальны, доступны, и нет мертвых/неиспользуемых провайдеров
**Depends on**: Phase 2
**Requirements**: URL-01, URL-02, URL-03, URL-04
**Success Criteria** (what must be TRUE):
  1. URL-ы Anton111111/rule-lists указывают на актуальный release (проверен tag/latest)
  2. Каждый rule-provider из секции rule-providers используется хотя бы в одном правиле в секции rules (нет сирот)
  3. Все URL rule-providers возвращают HTTP 200 (проверено скриптом или вручную)
  4. Пароль web-dashboard заменен с 'admin' на сгенерированный
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Generation Script
**Goal**: Автоматическая генерация двух вариантов конфига (personal и work) из единого базового файла
**Depends on**: Phase 3
**Requirements**: SCRIPT-01, SCRIPT-02, SCRIPT-03, SCRIPT-04, SCRIPT-05
**Success Criteria** (what must be TRUE):
  1. Запуск `python generate.py` на Windows создает два файла: config-personal.yaml и config-work.yaml
  2. config-work.yaml не содержит ни одного упоминания adult-доменов (проверено grep-ом по списку: pornhub, stripchat, chaturbate, bongacams, onlyfans, fansly, hentai, rule34, nsfw, porn)
  3. Оба сгенерированных файла парсятся как валидный YAML без ошибок
  4. Скрипт выводит отчет: сколько строк удалено, результат проверки adult-keywords
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5
Note: Phase 3 and Phase 4 зависят от Phase 2, но не друг от друга. Phase 5 зависит от Phase 3.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Bugfixes | 0/2 | Not started | - |
| 2. Service Deduplication | 0/3 | Not started | - |
| 3. Adult Content Isolation | 0/3 | Not started | - |
| 4. URL Audit & Cleanup | 0/2 | Not started | - |
| 5. Generation Script | 0/2 | Not started | - |
