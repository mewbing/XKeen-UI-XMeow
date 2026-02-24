# Project Research Summary

**Project:** Mihomo Config Management (Refactoring)
**Domain:** Network proxy configuration for censorship circumvention (mihomo / Clash Meta on Keenetic router)
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

Проект представляет собой рефакторинг конфигурации mihomo (Clash Meta) на роутере Keenetic для обхода российских блокировок РКН. Текущий конфиг (~1672 строки) функционально работает -- все ключевые сервисы (YouTube, Discord, Telegram, AI-сервисы, соцсети) доступны через прокси. Однако конфиг накопил значительный технический долг: массивное дублирование правил (17x YouTube, 4x Discord, 8x Telegram, 17x Cloudflare), непоследовательное именование proxy-групп, разбросанный adult-контент, одновременная загрузка OISD big+small (big -- надмножество small), и сломанное правило `DST-PORT,53,53`. Помимо рефакторинга, нужна генерация двух вариантов конфига -- personal (полный) и work (без adult-контента) -- из единого базового файла.

Рекомендуемый подход: поэтапный рефакторинг от низкорисковых исправлений к структурным изменениям. Стек опирается на экосистему MetaCubeX: MRS (Meta Rule Set) как основной бинарный формат правил, MetaCubeX/meta-rules-dat как главный источник geosite/geoip, legiz-ru/mihomo-rule-sets для российской специфики (refilter, OISD, ru-bundle). Генерация вариантов -- Python-скрипт с маркерами `# >>> ADULT` / `# <<< ADULT` для вырезания adult-блоков. Архитектура конфига: 10-фазная структура rules (system -> local -> adblock -> adult -> services -> torrents -> RU -> ECH -> CDN -> catch-all), четкие границы компонентов, миграция с GEOSITE/GEOIP на RULE-SET MRS для экономии RAM роутера.

Ключевые риски: (1) нарушение порядка правил (first-match-wins) при реструктуризации, (2) утечка adult-контента в work-конфиг из-за разбросанности по 4+ секциям, (3) конфликт между российскими blocklist-правилами и широкими DIRECT-правилами для .ru-доменов (заблокированные сайты на .ru TLD могут уйти в DIRECT), (4) фиксированные URL Anton111111 (tag-based releases) устареют без предупреждения. Все риски митигируются при соблюдении предложенного порядка фаз: сначала исправление багов, затем консолидация adult-контента, именование, реструктуризация правил, и только потом -- скрипт генерации.

## Key Findings

### Recommended Stack

Основной формат данных -- MRS (Meta Rule Set), бинарный формат mihomo, дающий 10-50x экономию размера по сравнению с YAML и мгновенный парсинг. Критично для роутера с ограниченными ресурсами. Для правил с AND/OR логикой (classical behavior) -- text (.lst) или YAML, так как MRS не поддерживает classical. Генерация вариантов -- Python-скрипт с маркерами. Валидация -- `yamllint` + `mihomo -t` + кастомный Python-скрипт проверки ссылок.

**Core technologies:**
- **MRS (Meta Rule Set)**: основной формат rule-providers -- бинарный, минимальный размер, мгновенный парсинг, экономия RAM на роутере
- **MetaCubeX/meta-rules-dat**: основной источник geosite/geoip в MRS -- официальный, обновляется ежедневно, 35+ категорий сервисов
- **legiz-ru/mihomo-rule-sets**: российская специфика -- refilter (ECH/noECH), ru-bundle, OISD в MRS, торренты, Discord voice IPs
- **Python 3.x + pyyaml**: генерация вариантов конфига -- маркеры `# >>> ADULT` / `# <<< ADULT`, валидация YAML, проверка утечек
- **mihomo -t**: встроенная валидация конфига -- проверка синтаксиса, proxy-groups, rule-providers

**Critical version/source requirement:**
- Заменить geosite-источник с v2fly `dlc.dat` на MetaCubeX `geosite.dat` -- текущий v2fly не содержит категорий `anthropic`, `google-gemini`, которые используются в конфиге.

### Expected Features

**Must have (table stakes):**
- TS-1: Обход YouTube (включая googlevideo.com CDN) -- замедление через DPI-throttling, критичный сервис
- TS-2: Обход Discord (текст + голос UDP 50000-50100) -- полная блокировка
- TS-3: Instagram/Facebook/Twitter через прокси -- полная блокировка
- TS-4: AI-сервисы (ChatGPT, Claude, Gemini) через прокси -- блокировка РКН + гео-ограничения сервисов
- TS-5: Telegram через прокси -- нестабильное прямое подключение
- TS-6: Прямая маршрутизация российского трафика (Yandex, VK, .ru) -- DIRECT
- TS-7: Блокировка рекламы (OISD big) -- DNS-level
- TS-8: Защита локальной сети (private IPs -> DIRECT)

**Should have (differentiators):**
- D-1: ECH-aware маршрутизация -- ECH-домены DIRECT (экономия прокси-трафика), noECH через прокси
- D-7: Изоляция adult-контента маркерами -- предпосылка для генерации work-конфига
- D-9: Скрипт генерации personal/work конфигов -- автоматическая генерация двух вариантов
- D-10: Единообразное именование proxy-groups -- emoji + полное имя для читаемости dashboard
- D-5: Торрент-маршрутизация -- клиенты DIRECT, сайты через VPN
- D-8: QUIC-блокировка -- обход замедления YouTube через QUIC

**Defer (v2+):**
- D-6: Детальные gaming-правила (Tarkov, OSU отдельно) -- консолидировать в одну группу, детализировать позже
- D-3: CDN/Cloud IP routing по 13 отдельным провайдерам -- оценить необходимость, возможно заменить MetaCubeX geoip
- D-12: Remote control как отдельная категория -- низкий приоритет

**Anti-features (НЕ делать):**
- AF-1: Полный tunnel -- расход трафика, гео-блокировка российских сервисов
- AF-4: OISD big + small одновременно -- big является надмножеством small
- AF-5: Дублирование в inline + RULE-SET + GEOSITE -- один метод на сервис
- AF-8: Автообновление конфига на роутере -- риск потери доступа при ошибке

### Architecture Approach

Конфиг строится как единый YAML-файл с 10 секциями в порядке разрешения зависимостей: system -> sniffer -> geo -> profile -> DNS -> proxy-providers -> proxies -> proxy-groups -> rule-providers -> rules. Rules используют 10-фазную структуру (system/protocol -> local network -> adblock -> adult -> services -> torrents -> RU regional -> ECH/refilter -> CDN -> catch-all). Adult-контент изолирован в 4 маркированных блоках (groups, providers, rules, GLOBAL refs). Генерация вариантов -- построчное удаление блоков между маркерами.

**Major components:**
1. **config.yaml** -- единый источник истины, содержит маркеры `# >>> ADULT` / `# <<< ADULT` в 4 местах
2. **generate.py** -- Python-скрипт генерации: strip adult blocks -> validate YAML -> grep adult keywords -> write output
3. **Rule-providers** -- ~50 внешних источников (MetaCubeX MRS, legiz-ru MRS, Anton111111 text, itdoginfo text, inline YAML)
4. **Proxy-groups** -- иерархия: base (VPN/Fastest/Available) -> service (по категориям) -> adult (маркированные) -> management -> catch-all

### Critical Pitfalls

1. **Нарушение порядка правил при реструктуризации (CRITICAL)** -- first-match-wins семантика; adult-домены на .ru TLD (bongacams.ru) должны матчиться ДО широкого `DOMAIN-SUFFIX,ru,RU Traffic`. Превенция: создать тест-матрицу из 20-30 доменов, проверять before/after.
2. **Утечка adult-контента в work-конфиг (CRITICAL)** -- adult разбросан по 4+ секциям, включая неочевидные места (pornhub в "Other", category-porn в "blocked sites", OISD NSFW). Превенция: консолидировать ВСЕ adult в маркированные блоки + grep-проверка в скрипте.
3. **Конфликт blocklist vs. DIRECT для .ru доменов (CRITICAL)** -- заблокированные сайты на .ru (tvrain.ru, novayagazeta.ru) попадут в DIRECT если blocklist-правила стоят после `DOMAIN-SUFFIX,ru`. Превенция: blocklist ПЕРЕД широкими RU-правилами.
4. **Переименование proxy-groups без обновления всех ссылок (CRITICAL)** -- имя группы используется в proxy-groups, rules, GLOBAL. Одно пропущенное -- mihomo не запустится. Превенция: rename mapping table + validate reference count.
5. **Stale кэш rule-set при смене URL/формата (HIGH)** -- при смене URL или format нужно менять path и чистить кэш на роутере. Превенция: новый path при новом URL, ручной refresh через API.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Immediate Fixes (Bug Fixes & Dead Code Removal)
**Rationale:** Низкий риск, нулевое изменение поведения, немедленная отдача. Устраняет баги и мертвый код, которые могут усложнить дальнейший рефакторинг.
**Delivers:** Чистый конфиг без багов, ~150 строк удалено, корректная работа DNS-правила.
**Addresses:** AF-4 (OISD dedup), AF-5 (дублирование правил), часть TS-1..TS-5 (удаление дублей)
**Avoids:** Pitfall 7 (DST-PORT,53,53 bug), Pitfall 12 (OISD overlap), Pitfall 9 (dead duplicate rules)
**Actions:**
- Fix `DST-PORT,53,53` -> remove or `DST-PORT,53,DIRECT`
- Remove OISD small (keep only big), remove OISD nsfw_small (keep only nsfw_big)
- Remove duplicate telegram/youtube/cloudflare providers (keep MetaCubeX MRS, remove Anton111111 text duplicates)
- Remove 17 inline YouTube DOMAIN-SUFFIX, 17 Cloudflare, 24 Discord (covered by RULE-SET)
- Remove duplicate torrent rules
- Fix geosite source: v2fly dlc.dat -> MetaCubeX geosite.dat
- Move geox-url above proxy-providers

### Phase 2: Adult Content Consolidation
**Rationale:** Критическая зависимость для генерации work-конфига (Phase 6). Пока adult разбросан по 4+ секциям, автоматическая генерация невозможна. Средний риск -- перемещение, не удаление.
**Delivers:** Все adult-контент в 4 маркированных блоках `# >>> ADULT` / `# <<< ADULT`. Готовность к автогенерации.
**Addresses:** D-7 (adult isolation), частично D-9 (prerequisite для скрипта)
**Avoids:** Pitfall 8 (adult leaking into work config)
**Actions:**
- Создать consolidated `adult-sites` inline rule-provider
- Добавить маркеры в proxy-groups, rule-providers, rules, GLOBAL
- Перенести pornhub/onlyfans/fansly/hanime/e-hentai/rule34 из "Other" в adult-блок
- Переименовать ST/CB/BG/BGP/Sin в полные имена (Stripchat/Chaturbate/Bongacams/Bongamodels/Sinparty)

### Phase 3: Naming Convention & Group Cleanup
**Rationale:** Зависимость: после adult-консолидации имена групп стабилизированы. Атомарная операция -- все ссылки обновляются одновременно. Упрощает дальнейший рефакторинг правил.
**Delivers:** Единообразные имена proxy-groups (emoji + полное имя), консолидация мелких групп, читаемый dashboard.
**Addresses:** D-10 (единообразное именование), частично AF-3 (консолидация мелких групп)
**Avoids:** Pitfall 2 (rename without updating references), Pitfall 3 (MATCH catch-all)
**Actions:**
- Применить конвенцию `Emoji Name` ко всем группам
- Обновить ВСЕ ссылки (rules, GLOBAL, group cross-refs) атомарно
- Консолидировать OSU/Tarkov/Gaming в одну группу
- Аудит неиспользуемых групп (intel, NAS, 53)

### Phase 4: Rules Restructuring
**Rationale:** Самая рисковая фаза, но к этому моменту конфиг уже очищен от дублей (Phase 1), adult консолидирован (Phase 2), имена стандартизированы (Phase 3). 10-фазная структура правил оптимизирует порядок оценки.
**Delivers:** Оптимальный порядок правил, local network в начале, adblock перед сервисами, blocklist перед RU DIRECT.
**Addresses:** TS-6 (RU routing correctness), D-1 (ECH-aware positioning), все table stakes (correct rule ordering)
**Avoids:** Pitfall 1 (breaking rule priority -- CRITICAL), Pitfall 6 (blocklist vs. RU DIRECT conflict), Pitfall 15 (DOMAIN-KEYWORD audit)
**Actions:**
- Реализовать 10-фазную структуру правил
- Local network rules -> Phase 1 (сейчас в конце)
- Ad-blocking -> Phase 2 (сейчас в конце)
- Blocklist rules ПЕРЕД broad RU DIRECT rules
- Удалить habr.com из RU DIRECT (конфликт с ru-inline-banned)
- Аудит DOMAIN-KEYWORD правил на false positives

### Phase 5: RULE-SET Migration & URL Updates
**Rationale:** После стабилизации правил -- миграция оставшихся GEOSITE/GEOIP на RULE-SET MRS для экономии RAM. Обновление устаревших URL.
**Delivers:** Полная миграция на RULE-SET MRS, отключение geodata-mode, экономия ~40 МБ RAM на роутере.
**Addresses:** STACK recommendation (GEOSITE/GEOIP -> RULE-SET MRS migration), D-3 (CDN audit)
**Avoids:** Pitfall 4 (stale caches), Pitfall 5 (format mismatches), Pitfall 11 (offline sources)
**Actions:**
- Замена GEOSITE правил на RULE-SET (youtube, telegram, discord, ru, etc.)
- Замена GEOIP правил на RULE-SET MRS
- Отключение geodata-mode и geox-url
- Проверка Anton111111 latest release tag
- Аудит CDN IP-списков (нужны ли все 13?)

### Phase 6: Generation Script
**Rationale:** К этому моменту adult консолидирован (Phase 2), имена стандартны (Phase 3), правила реструктурированы (Phase 4). Скрипт может надежно работать с чистым конфигом.
**Delivers:** generate.py -- автоматическая генерация config-personal.yaml и config-work.yaml.
**Addresses:** D-9 (generation script), D-7 (validation of adult removal)
**Avoids:** Pitfall 8 (adult leaking -- final validation), Pitfall 13 (marker boundary errors)
**Actions:**
- Реализация strip_adult_blocks, validate_yaml, check_no_adult_references
- Обработка CRLF/LF, валидация маркеров
- Замена dashboard password для work-варианта
- grep-проверка: pornhub, onlyfans, fansly, stripchat, chaturbate, bongacams, nsfw, porn, hentai

### Phase 7: DPI Circumvention & Advanced
**Rationale:** Опциональная фаза. ECH-routing уже работает, но может быть оптимизирован. QUIC-политика требует пересмотра (blanket REJECT -> selective).
**Delivers:** Оптимизированная ECH-маршрутизация, selective QUIC, мониторинг источников.
**Addresses:** D-1 (ECH optimization), D-8 (QUIC refinement)
**Avoids:** Pitfall 10 (DPI circumvention breaking routing), Pitfall 14 (blocklist overlap)
**Actions:**
- Пересмотр QUIC REJECT (selective вместо blanket)
- Аудит пересечений refilter/ru-bundle/antifilter
- Настройка мониторинга URL-источников
- Изменение log-level с silent на warning

### Phase Ordering Rationale

- **Phase 1 first**: исправление багов не меняет поведение, очищает поле для дальнейшей работы. Удаление дублей уменьшает конфиг на ~150 строк, упрощая все последующие фазы.
- **Phase 2 before Phase 3**: adult-группы будут переименованы в Phase 3, но сначала нужно собрать их в маркированные блоки. Переименование разбросанных элементов сложнее, чем консолидированных.
- **Phase 3 before Phase 4**: реструктуризация правил использует имена proxy-групп. Если имена меняются после реструктуризации -- двойная работа.
- **Phase 4 is highest risk**: к этому моменту конфиг максимально чистый, что минимизирует риск ошибки. Тест-матрица из 20-30 доменов обязательна.
- **Phase 5 after Phase 4**: миграция GEOSITE->RULE-SET зависит от стабильных правил. Менять формат провайдеров одновременно с порядком правил -- чрезмерный риск.
- **Phase 6 after Phase 2-4**: скрипт генерации требует чистой структуры маркеров, стабильных имен, корректных правил. Без предыдущих фаз скрипт будет работать с грязными данными.
- **Phase 7 is optional**: ECH и QUIC уже работают. Оптимизация -- nice-to-have.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Rules Restructuring):** CRITICAL -- требует создания тест-матрицы доменов, понимания взаимодействия ECH/refilter/RU-blocklist/DIRECT правил. Рекомендуется `/gsd:research-phase`.
- **Phase 5 (RULE-SET Migration):** нужна проверка наличия MetaCubeX MRS-аналогов для всех текущих GEOSITE/GEOIP правил. Проверка Anton111111 latest tag.
- **Phase 7 (DPI Circumvention):** изменчивая область -- методы блокировок РКН обновляются. Нужна актуальная информация о состоянии ECH/QUIC блокировок.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Immediate Fixes):** стандартная дедупликация, исправление опечаток -- не требует исследований.
- **Phase 2 (Adult Consolidation):** перемещение блоков текста между секциями -- стандартная операция.
- **Phase 3 (Naming Convention):** find-and-replace с валидацией -- стандартный паттерн.
- **Phase 6 (Generation Script):** алгоритм strip-by-markers хорошо документирован в ARCHITECTURE.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | MRS формат, MetaCubeX источники, Python для генерации -- хорошо задокументированы в экосистеме mihomo |
| Features | HIGH | Все table stakes уже реализованы в текущем конфиге, дублирование подтверждено анализом 1672 строк |
| Architecture | HIGH | 10-фазная структура правил, маркерный подход, component boundaries -- четко определены с примерами |
| Pitfalls | HIGH | 15 питфолов идентифицированы с конкретными номерами строк, warning signs, и стратегиями превенции |

**Overall confidence:** HIGH

Исследование основано на анализе реального конфига (1672 строки), знании экосистемы mihomo/MetaCubeX, и структуры российских блокировок. Все рекомендации специфичны для данного проекта.

### Gaps to Address

- **Anton111111 latest release tag**: необходимо проверить вручную, доступен ли `latest` tag для автообновления URL. Если нет -- нужен скрипт обновления или замена на MetaCubeX geoip аналоги.
- **OMchik33/custom-rules актуальность**: дата последнего коммита неизвестна. Если заброшен -- включить gaming-правила в inline.
- **hagezi_pro использование**: определен как rule-provider, но может не быть ссылок в rules. Требуется верификация.
- **Производительность MRS vs YAML на Keenetic**: теоретическая оценка. Для точных данных нужен бенчмарк на целевом оборудовании.
- **DNS leak для заблокированных доменов**: текущий sniffer помогает, но plain HTTP/UDP трафик может утекать. Рассмотреть fake-ip mode.

## Sources

### Primary (HIGH confidence)
- MetaCubeX/meta-rules-dat (`https://github.com/MetaCubeX/meta-rules-dat`) -- основной источник geosite/geoip MRS
- legiz-ru/mihomo-rule-sets (`https://github.com/legiz-ru/mihomo-rule-sets`) -- российская специфика, refilter, OISD MRS
- v2fly/domain-list-community (`https://github.com/v2fly/domain-list-community`) -- upstream для geosite категорий
- MetaCubeX/mihomo (`https://github.com/MetaCubeX/mihomo`) -- бинарник mihomo, `mihomo -t` валидация

### Secondary (MEDIUM confidence)
- itdoginfo/allow-domains (`https://github.com/itdoginfo/allow-domains`) -- inside/outside RU domain lists
- Anton111111/rule-lists (`https://github.com/Anton111111/rule-lists`) -- CDN/Cloud IP blocks (pinned releases)
- antifilter.download (`https://antifilter.download`) -- реестр блокировок РКН

### Tertiary (LOW confidence)
- OMchik33/custom-rules (`https://github.com/OMchik33/custom-rules`) -- gaming rules, актуальность не проверена
- zxc-rv/ad-filter (`https://github.com/zxc-rv/ad-filter`) -- hagezi_pro, возможно дублирует OISD

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
