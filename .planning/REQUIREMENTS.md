# Requirements: Mihomo Config Refactoring

**Defined:** 2026-02-25
**Core Value:** Весь заблокированный в РФ трафик надёжно проходит через прокси, российские сайты идут напрямую, а рабочая версия конфига не содержит следов adult-контента.

## v1 Requirements

### Дубликаты и ошибки (DEDUP)

- [x] **DEDUP-01**: Все дублирующиеся правила YouTube удалены (17 inline DOMAIN-SUFFIX при наличии GEOSITE + RULE-SET), с подтверждением что это реальные дубли
- [x] **DEDUP-02**: Все дублирующиеся правила Discord удалены (4+ определения: discord_vc, discord_voiceips, discord_ips, discord_domains), с проверкой покрытия
- [x] **DEDUP-03**: Все дублирующиеся правила Telegram удалены (8+ определений), с проверкой покрытия
- [x] **DEDUP-04**: Все дублирующиеся правила Cloudflare удалены (17 inline DOMAIN-SUFFIX при наличии RULE-SET)
- [x] **DEDUP-05**: OISD small удалён (big является надмножеством small), подтверждено что big покрывает small
- [x] **DEDUP-06**: Дублирующиеся торрент-правила удалены (определены дважды в rules-секции)
- [x] **DEDUP-07**: Дублирующийся refilter_ipsum консолидирован (используется в двух секциях)
- [x] **DEDUP-08**: Ошибка DST-PORT,53,53 исправлена на корректное правило
- [x] **DEDUP-09**: bongacams.ru удалён из категории "Other" (уже есть в adult-блоке BG)
- [ ] **DEDUP-10**: Дублирующиеся правила Logitech консолидированы (KEYWORD + GEOSITE)

### Adult-контент изоляция (ADULT)

- [x] **ADULT-01**: Все adult proxy-groups (Sin, ST, CB, BG, BGP) перенесены в маркированный блок `# >>> ADULT` / `# <<< ADULT` в секции proxy-groups
- [x] **ADULT-02**: Все adult rule-providers (Sin_in, ST_in, BG_in, BGP_in, CB_in, category-porn, oisd_nsfw_small, oisd_nsfw_big) перенесены в маркированный блок в секции rule-providers
- [x] **ADULT-03**: Все inline adult-правила (17 строк DOMAIN-SUFFIX/REGEX) перенесены в маркированный блок в секции rules
- [x] **ADULT-04**: OnlyFans, Fansly, PornHub, hanime1, hembed, e-hentai, rule34 перенесены из "Other" в adult-блок
- [x] **ADULT-05**: Ссылки на adult-группы в GLOBAL select-group тоже маркированы для удаления
- [x] **ADULT-06**: В work-конфиге ноль упоминаний adult-сайтов (проверено grep-ом по 16 keywords)

### Скрипт генерации (SCRIPT)

- [ ] **SCRIPT-01**: Python-скрипт читает базовый config.yaml и генерирует два файла: config-personal.yaml и config-work.yaml
- [ ] **SCRIPT-02**: Скрипт удаляет всё между маркерами `# >>> ADULT` и `# <<< ADULT` для work-варианта
- [ ] **SCRIPT-03**: Скрипт валидирует выходной YAML (парсинг без ошибок)
- [ ] **SCRIPT-04**: Скрипт проверяет work-конфиг на отсутствие adult-keywords (grep по списку доменов)
- [ ] **SCRIPT-05**: Скрипт работает на Windows (Python 3.x)

### Актуализация URL-источников (URL)

- [x] **URL-01**: URL-ы Anton111111/rule-lists проверены на актуальность и обновлены до свежего тега/latest
- [x] **URL-02**: Неиспользуемые rule-providers идентифицированы и удалены (hagezi_pro, gaming-ips и др. — если не используются в rules)
- [x] **URL-03**: Все rule-provider URL-ы проверены на доступность (HTTP 200)
- [x] **URL-04**: Пароль web-dashboard изменён с 'admin' на сгенерированный

## v2 Requirements

### Именование и структура

- **NAME-01**: Единообразное именование proxy-groups (emoji + полное имя)
- **NAME-02**: Консолидация мелких proxy-groups (OSU, intel, NAS, Logitech -> категории)
- **NAME-03**: Стратегия "один RULE-SET на сервис" вместо inline + GEOSITE + RULE-SET

### Продвинутые фичи

- **ADV-01**: ECH-aware маршрутизация (оптимизация re:filter ECH/noECH)
- **ADV-02**: Миграция providers на MRS формат (где доступен)
- **ADV-03**: DPI circumvention оптимизация (ECH, QUIC, фрагментация)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Настройка прокси-серверов | Серверы работают, не трогаем |
| Отключение geodata-mode | Пользователь хочет сохранить geodata-mode |
| Миграция на sing-box | mihomo устраивает |
| GUI/автоматизация обновлений | Ручное управление предпочтительно |
| Мониторинг и алерты | Домашнее использование |
| Полный tunnel (всё через прокси) | Расход трафика, нагрузка на прокси |
| Встроенный DNS-over-HTTPS в mihomo | DNS обрабатывается роутером Keenetic |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEDUP-01 | Phase 2 | Complete |
| DEDUP-02 | Phase 2 | Complete |
| DEDUP-03 | Phase 2 | Complete |
| DEDUP-04 | Phase 2 | Complete |
| DEDUP-05 | Phase 1 | Complete |
| DEDUP-06 | Phase 2 | Complete |
| DEDUP-07 | Phase 2 | Complete |
| DEDUP-08 | Phase 1 | Complete |
| DEDUP-09 | Phase 1 | Complete |
| DEDUP-10 | Phase 1 | Pending |
| ADULT-01 | Phase 3 | Complete |
| ADULT-02 | Phase 3 | Complete |
| ADULT-03 | Phase 3 | Complete |
| ADULT-04 | Phase 3 | Complete |
| ADULT-05 | Phase 3 | Complete |
| ADULT-06 | Phase 3 | Complete |
| SCRIPT-01 | Phase 5 | Pending |
| SCRIPT-02 | Phase 5 | Pending |
| SCRIPT-03 | Phase 5 | Pending |
| SCRIPT-04 | Phase 5 | Pending |
| SCRIPT-05 | Phase 5 | Pending |
| URL-01 | Phase 4 | Complete |
| URL-02 | Phase 4 | Complete |
| URL-03 | Phase 4 | Complete |
| URL-04 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after roadmap creation*
