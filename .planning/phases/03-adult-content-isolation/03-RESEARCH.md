# Phase 3: Adult Content Isolation - Research

**Researched:** 2026-02-25
**Domain:** YAML config restructuring -- adult content marker-based isolation in mihomo (Clash Meta) config
**Confidence:** HIGH

## Summary

Фаза 3 -- чисто структурная операция перемещения и маркировки. Технически простая, но требует внимательного аудита: adult-контент разбросан по 4 секциям конфига (proxy-groups, rule-providers, rules inline, GLOBAL references). Всего идентифицировано 5 proxy-groups, 6 rule-providers, 18+ inline-правил в rules, 5 ссылок в GLOBAL, и 12+ правил в "Other", которые нужно перенести в adult-блок. Дополнительно есть 2 rule-providers (oisd_nsfw_small, oisd_nsfw_big) и 1 rule-provider (category-porn), которые содержат adult-контент, но маршрутизируются в другие группы (Ad-Filter, Other) -- их тоже необходимо маркировать.

Основной риск -- пропустить неочевидный adult-контент (hembed.com как видео-хостинг hanime1, digitaloceanspaces в Sin_in провайдере, category-porn в группе Other). Вторичный риск -- нарушение порядка правил при перемещении: adult-правила в rules ДОЛЖНЫ идти в начале (перед TikTok, Other и т.д.), чтобы adult-домены матчились раньше общих правил. Решение пользователя (CONTEXT.md) четко определяет: блок в начале rules, в конце proxy-groups и rule-providers.

**Primary recommendation:** Выполнить в 2 плана: (1) аудит + перемещение + маркировка всех 4 секций, (2) перенос "Other"-правил в adult-блок + финальная верификация grep-ом.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Один сплошной блок внутри маркеров, без подгрупп и комментариев-разделителей
- Одинаковые маркеры `# >>> ADULT` / `# <<< ADULT` во всех секциях (proxy-groups, rule-providers, rules)
- Скрипт удаляет все между любой парой маркеров -- формат единый
- В секциях proxy-groups и rule-providers: adult-блок перемещается в конец секции
- В секции rules: adult-блок перемещается в начало секции (перед всеми остальными правилами, наивысший приоритет матчинга)
- Полный аудит конфига на adult-домены (не только перечисленные в ADULT-04)
- В adult-блок идут только сайты, чья основная функция -- adult-контент (не смешанные платформы типа Reddit, Imgur, Tumblr)
- Inline-правила сохраняются даже если category-porn покрывает тот же домен (подстраховка)
- Новые находки аудита показать списком перед выполнением для подтверждения
- В GLOBAL select-группе: adult-ссылки сгруппировать вместе и обернуть маркерами `# >>> ADULT` / `# <<< ADULT`
- Проверить все proxy-groups на перекрестные ссылки на adult-группы (не только GLOBAL)
- Если найдутся другие группы со ссылками на adult -- маркировать аналогично
- Имена proxy-groups НЕ менять: Sin, ST, CB, BG, BGP остаются как есть
- Имена rule-providers НЕ менять: Sin_in, ST_in, BG_in, BGP_in, CB_in, category-porn остаются как есть
- Только перемещение и маркировка, без переименования

### Claude's Discretion
- Порядок строк внутри adult-блока (алфавитный, по типу, или как сейчас)
- Точное расстояние маркеров от окружающего кода (пустые строки)
- Формулировки grep-проверки для верификации

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADULT-01 | Все adult proxy-groups (Sin, ST, CB, BG, BGP) перенесены в маркированный блок `# >>> ADULT` / `# <<< ADULT` в секции proxy-groups | Инвентарь: 5 групп на строках 461-504, перемещаются в конец секции proxy-groups (перед GLOBAL) |
| ADULT-02 | Все adult rule-providers (Sin_in, ST_in, BG_in, BGP_in, CB_in, category-porn) перенесены в маркированный блок в секции rule-providers | Инвентарь: 6 провайдеров на строках 611-660 и 767-773, перемещаются в конец секции rule-providers |
| ADULT-03 | Все inline adult-правила (18 строк DOMAIN-SUFFIX/REGEX) перенесены в маркированный блок в секции rules | Инвентарь: 18 inline-правил (строки 1216-1233) + 5 RULE-SET ссылок (строки 1236-1240), перемещаются в начало секции rules |
| ADULT-04 | OnlyFans, Fansly, PornHub, hanime1, e-hentai, rule34 перенесены из "Other" в adult-блок | Инвентарь: 12 правил в "Other" (строки 1351-1397), включая hembed.com (видео-хостинг hanime1) |
| ADULT-05 | Ссылки на adult-группы в GLOBAL select-group тоже маркированы для удаления | Инвентарь: 5 ссылок в GLOBAL (строки 588-592), только в GLOBAL -- перекрестных ссылок в других группах нет |
| ADULT-06 | В work-конфиге ноль упоминаний adult-сайтов (проверено grep-ом) | Верификация: grep по списку (pornhub, stripchat, chaturbate, bongacams, onlyfans, fansly, hentai, rule34, nsfw, porn, sinparty, hembed, hanime) после удаления маркированных блоков |
</phase_requirements>

## Complete Adult Content Inventory

### Секция 1: proxy-groups (5 групп)

Текущее расположение: строки 461-504, между группами '53' и 'NAS'.

| Группа | Строки | Сервис |
|--------|--------|--------|
| Sin | 461-468 | sinparty.com |
| ST | 470-477 | stripchat.com |
| CB | 479-486 | chaturbate.com |
| BG | 488-495 | bongacams.com |
| BGP | 497-504 | bongamodels.com |

**Действие:** Вырезать все 5 блоков и переместить в конец секции proxy-groups (перед GLOBAL), обернув маркерами.

### Секция 2: rule-providers (6 провайдеров + 2 NSFW + обсуждение)

**Чистые adult rule-providers:**

| Провайдер | Строки | Тип | Содержимое |
|-----------|--------|-----|------------|
| Sin_in | 611-620 | inline | sinparty домены + digitaloceanspaces (CDN sinparty) |
| ST_in | 621-633 | inline | stripchat, strpst, split.io |
| BG_in | 634-646 | inline | bongacams, bongacams16, bongacam |
| BGP_in | 647-653 | inline | bongamodels |
| CB_in | 654-660 | inline | chaturbate |
| category-porn | 767-773 | http/mrs | MetaCubeX geosite category-porn |

**NSFW-фильтры (блокировка рекламы/трекеров):**

| Провайдер | Строки | Тип | Текущая группа | Рекомендация |
|-----------|--------|-----|----------------|--------------|
| oisd_nsfw_small | 1149-1155 | http/mrs | Ad-Filter | Маркировать -- содержит "nsfw" в имени и URL |
| oisd_nsfw_big | 1156-1162 | http/mrs | Ad-Filter | Маркировать -- содержит "nsfw" в имени и URL |

**Важно:** oisd_nsfw_small и oisd_nsfw_big маршрутизируются в Ad-Filter (блокировщик рекламы), НО:
- Их имена содержат "nsfw" -- grep по "nsfw" найдет их в work-конфиге
- Их URL содержат "nsfw" -- grep по "nsfw" найдет их в work-конфиге
- Их path содержат "nsfw" -- grep по "nsfw" найдет их в work-конфиге

Если эти провайдеры НЕ маркировать, ADULT-06 (grep по "nsfw" = 0) будет провален. Их НЕОБХОДИМО включить в маркированный блок rule-providers И в маркированный блок rules.

**Действие:** Вырезать 6 adult-провайдеров + 2 NSFW-провайдера и переместить в конец секции rule-providers, обернув маркерами.

### Секция 3: rules (inline-правила + RULE-SET ссылки)

**Блок A: Inline adult-правила (строки 1216-1233, 18 правил):**

```yaml
# Текущий порядок в конфиге:
- DOMAIN-SUFFIX,sinparty,Sin          # строка 1216
- DOMAIN-SUFFIX,stripchat,ST          # строка 1217
- DOMAIN-SUFFIX,bongacams,BG          # строка 1218
- DOMAIN-SUFFIX,bongacams16,BG        # строка 1219
- DOMAIN-SUFFIX,bongacam,BG           # строка 1220
- DOMAIN-SUFFIX,chaturbate,CB         # строка 1221
- DOMAIN-SUFFIX,bongamodels,BGP       # строка 1222 (без .com)
- DOMAIN-REGEX,...sinparty...,Sin      # строка 1224
- DOMAIN-REGEX,...stripchat...,ST      # строка 1225
- DOMAIN-REGEX,...bongacams...,BG      # строки 1226-1231
- DOMAIN-REGEX,...chaturbate...,CB     # строка 1232
- DOMAIN-REGEX,...bongamodels...,BGP   # строка 1233
```

**Блок B: RULE-SET ссылки на adult-провайдеры (строки 1236-1240, 5 правил):**

```yaml
- RULE-SET,Sin_in,Sin     # строка 1236
- RULE-SET,ST_in,ST       # строка 1237
- RULE-SET,BG_in,BG       # строка 1238
- RULE-SET,BGP_in,BGP     # строка 1239
- RULE-SET,CB_in,CB       # строка 1240
```

**Блок C: Adult-правила из "Other" (строки 1351-1397):**

| Строка | Правило | Статус |
|--------|---------|--------|
| 1351 | DOMAIN-SUFFIX,onlyfans.com,Other | --> adult |
| 1352 | DOMAIN-SUFFIX,fansly.com,Other | --> adult |
| 1354 | DOMAIN-SUFFIX,pornhub.org,Other | --> adult |
| 1355 | DOMAIN-SUFFIX,pornhub.com,Other | --> adult |
| 1360 | DOMAIN-KEYWORD,pornhub,Other | --> adult |
| 1363 | DOMAIN-SUFFIX,hanime1.me,Other | --> adult |
| 1364 | DOMAIN-KEYWORD,hanime1,Other | --> adult |
| 1365 | DOMAIN-SUFFIX,hembed.com,Other | --> adult (CDN для hanime1) |
| 1366 | DOMAIN-KEYWORD,hembed,Other | --> adult (CDN для hanime1) |
| 1375 | DOMAIN-KEYWORD,e-hentai,Other | --> adult |
| 1376 | DOMAIN-SUFFIX,e-hentai.org,Other | --> adult |
| 1386 | DOMAIN-KEYWORD,rule34,Other | --> adult |
| 1397 | RULE-SET,category-porn,Other | --> adult |

**Блок D: OISD NSFW правила (строки 1472-1473):**

| Строка | Правило | Статус |
|--------|---------|--------|
| 1472 | RULE-SET,oisd_nsfw_small,Ad-Filter | --> adult |
| 1473 | RULE-SET,oisd_nsfw_big,Ad-Filter | --> adult |

**Итого в секции rules: 18 + 5 + 13 + 2 = 38 правил для adult-блока.**

**Действие:** Все 38 правил перемещаются в начало секции rules (после QUIC/SAFE, перед всем остальным), в единый маркированный блок. Правила из "Other" меняют целевую группу на подходящую adult-группу или общую adult-группу.

### Секция 4: GLOBAL references (5 ссылок)

```yaml
# Строки 588-592 в GLOBAL proxy-group:
- 'Sin'
- 'ST'
- 'CB'
- 'BG'
- 'BGP'
```

**Проверка перекрестных ссылок:** Ни одна другая proxy-group НЕ ссылается на Sin, ST, CB, BG, BGP. Только GLOBAL содержит эти ссылки.

**Действие:** Обернуть строки 588-592 маркерами `# >>> ADULT` / `# <<< ADULT` внутри GLOBAL блока.

## Architecture Patterns

### Целевая структура маркеров

```yaml
# === proxy-groups ===
proxy-groups:
  # ... все обычные группы ...
  # >>> ADULT
  - name: 'Sin'
    ...
  - name: 'ST'
    ...
  - name: 'CB'
    ...
  - name: 'BG'
    ...
  - name: 'BGP'
    ...
  # <<< ADULT
  - name: GLOBAL
    ...
    proxies:
      # ... обычные ссылки ...
      # >>> ADULT
      - 'Sin'
      - 'ST'
      - 'CB'
      - 'BG'
      - 'BGP'
      # <<< ADULT
      # ... остальные ссылки (QUIC, SAFE, 53, DIRECT) ...

# === rule-providers ===
rule-providers:
  # ... все обычные провайдеры ...
  # >>> ADULT
  Sin_in:
    ...
  ST_in:
    ...
  BG_in:
    ...
  BGP_in:
    ...
  CB_in:
    ...
  category-porn:
    ...
  oisd_nsfw_small:
    ...
  oisd_nsfw_big:
    ...
  # <<< ADULT

# === rules ===
rules:
  - RULE-SET,quic,QUIC
  - AND,((NETWORK,UDP),(DST-PORT,135,137,138,139)),SAFE
  # >>> ADULT
  - DOMAIN-SUFFIX,sinparty,Sin
  - DOMAIN-SUFFIX,stripchat,ST
  - ... (все 18 inline + 5 RULE-SET + 13 из Other + 2 NSFW)
  # <<< ADULT
  - DOMAIN-SUFFIX,tiktokw,TikTok
  # ... все остальные правила ...
```

### Pattern: Позиционирование adult-блока в rules

**Почему adult-правила ПЕРЕД остальными:**
- mihomo использует first-match-wins семантику
- Некоторые adult-домены на .ru TLD (bongacams.ru) -- если они окажутся ПОСЛЕ `DOMAIN-SUFFIX,ru,RU трафик`, трафик уйдет в DIRECT вместо прокси
- Правила category-porn (RULE-SET) покрывают тысячи доменов -- они должны матчиться до общих правил типа `RULE-SET,other_domains`

**Исключение для QUIC/SAFE:** Правила QUIC-блокировки и SAFE (UDP ports) остаются ПЕРЕД adult-блоком, так как они работают на сетевом уровне и не конфликтуют с domain-based правилами.

### Pattern: Перенос правил из "Other" в adult-группу

Правила из "Other" (onlyfans, fansly, pornhub, hanime1, e-hentai, rule34, hembed, category-porn) при переносе в adult-блок нужно **перенаправить на подходящую adult proxy-group**. Варианты:

1. **Выделенная adult-группа** -- создать новую группу (нарушает решение "только перемещение")
2. **Направить в одну из существующих adult-групп** -- неточно (onlyfans != sinparty)
3. **Оставить маршрутизацию в "Other"** -- просто переместить в adult-блок с сохранением `,Other`

**Рекомендация:** Оставить маршрутизацию `,Other` для правил из блока C. При удалении adult-блока скриптом (Phase 5) эти правила удалятся целиком. В personal-конфиге они продолжат работать через "Other" группу.

Аналогично для oisd_nsfw -- оставить маршрутизацию `,Ad-Filter`.

### Anti-Patterns to Avoid

- **Не создавать новые proxy-groups** -- решение пользователя: "только перемещение и маркировка, без переименования"
- **Не разбивать маркированный блок** -- один сплошной блок, без подгрупп
- **Не менять порядок внутри блока без причины** -- сохранить логическую группировку: сначала inline DOMAIN-SUFFIX, потом DOMAIN-REGEX, потом RULE-SET
- **Не забыть пустые строки** -- маркер не должен "слипаться" с предыдущим/следующим элементом

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Поиск adult-доменов | Ручной просмотр | grep по списку keywords | Человек пропустит hembed или oisd_nsfw |
| Проверка перекрестных ссылок | Визуальный поиск | grep -c по именам групп | Точность: искать "Sin" "ST" "CB" "BG" "BGP" в proxies-списках |
| Валидация result | Ручное чтение | grep -c post-removal | Механическая проверка: 0 совпадений по всем keywords |

## Common Pitfalls

### Pitfall 1: Пропуск oisd_nsfw провайдеров
**What goes wrong:** grep по "nsfw" находит oisd_nsfw_small и oisd_nsfw_big в work-конфиге
**Why it happens:** Эти провайдеры маршрутизируются в Ad-Filter, а не в adult-группу, и кажутся "не adult"
**How to avoid:** Маркировать oisd_nsfw_small и oisd_nsfw_big в ОБЕИХ секциях (rule-providers + rules)
**Warning signs:** ADULT-06 верификация показывает "nsfw" в grep

### Pitfall 2: Пропуск hembed.com
**What goes wrong:** hembed.com (видео CDN для hanime1) остается в "Other", grep по "hembed" не входит в стандартный adult-список
**Why it happens:** hembed -- неочевидное имя, не содержит adult-keywords
**How to avoid:** Аудит связей: hanime1 использует hembed.com для видео-эмбедов. Включить в adult-блок
**Warning signs:** hembed.com доступен в work-конфиге (косвенная утечка adult-контента)

### Pitfall 3: Нарушение порядка правил при перемещении
**What goes wrong:** Adult-домены на .ru (bongacams.ru) попадают в DIRECT вместо прокси
**Why it happens:** Если adult-правила оказываются ПОСЛЕ `DOMAIN-SUFFIX,ru,RU трафик` (строка 1452)
**How to avoid:** Adult-блок в rules размещается В САМОМ НАЧАЛЕ (после QUIC/SAFE)
**Warning signs:** bongacams.ru перестает открываться через прокси

### Pitfall 4: Забытые ссылки в GLOBAL
**What goes wrong:** GLOBAL содержит ссылки Sin, ST, CB, BG, BGP в work-конфиге, mihomo выдает ошибку "group not found"
**Why it happens:** Proxy-groups удалены маркерами, но ссылки в GLOBAL не маркированы
**How to avoid:** ADULT-05 требует маркировку ссылок в GLOBAL теми же маркерами
**Warning signs:** mihomo -t выдает ошибку при загрузке work-конфига

### Pitfall 5: category-porn маршрутизируется в "Other" -- при удалении adult-блока правило для Other останется без category-porn
**What goes wrong:** В work-конфиге category-porn просто отсутствует -- это правильное поведение. Но нужно убедиться что rule-provider category-porn тоже удален.
**Why it happens:** Если category-porn удален из rules но остался в rule-providers -- лишний скачиваемый файл (не критично, но грязно). Или наоборот -- удален из rule-providers но остался в rules -- mihomo ошибка.
**How to avoid:** Маркировать category-porn в ОБЕИХ секциях (rule-providers И rules)
**Warning signs:** mihomo -t ошибка "rule-provider not found"

### Pitfall 6: digitaloceanspaces в Sin_in
**What goes wrong:** Sin_in содержит домены digitaloceanspaces -- это CDN DigitalOcean, используемый sinparty для хранения контента
**Why it happens:** Общий CDN-домен внутри adult-провайдера
**How to avoid:** Sin_in целиком включается в adult-блок (решение пользователя). DigitalOcean IPs отдельно маршрутизируются через digitalocean_ips провайдер, так что non-adult DO трафик не пострадает
**Warning signs:** Нет -- это ожидаемое поведение

## Detailed Audit Results

### Полный список adult-keywords для grep-проверки (ADULT-06)

```
pornhub|stripchat|chaturbate|bongacams|bongacam|bongamodels|onlyfans|fansly|hentai|e-hentai|rule34|nsfw|porn|sinparty|hanime|hembed
```

**Расширенный список относительно Success Criteria:**
- Добавлены: `sinparty`, `hanime`, `hembed`, `bongacam` (без s), `bongamodels`
- Из Success Criteria: `pornhub, stripchat, chaturbate, bongacams, onlyfans, fansly, hentai, rule34, nsfw, porn`

### Сводка: что перемещается

| Секция | Количество элементов | Откуда | Куда |
|--------|---------------------|--------|------|
| proxy-groups | 5 групп | строки 461-504 (середина) | конец секции (перед GLOBAL) |
| rule-providers | 8 провайдеров | строки 611-660, 767-773, 1149-1162 | конец секции |
| rules (inline) | 18 правил | строки 1216-1233 | начало rules (после QUIC/SAFE) |
| rules (RULE-SET adult) | 5 правил | строки 1236-1240 | начало rules (после QUIC/SAFE) |
| rules (из Other) | 13 правил | строки 1351-1397 (разбросаны) | начало rules (после QUIC/SAFE) |
| rules (NSFW) | 2 правила | строки 1472-1473 | начало rules (после QUIC/SAFE) |
| GLOBAL refs | 5 ссылок | строки 588-592 | остаются на месте, оборачиваются маркерами |

**Итого: 5 групп + 8 провайдеров + 38 правил + 5 GLOBAL-ссылок = 56 элементов**

### Элементы, которые НЕ adult (подтверждено)

| Элемент | Почему не adult |
|---------|-----------------|
| kemono.su (строка 668, ru-inline-banned) | Пиратский агрегатор Patreon/Fanbox, не adult-сайт по основной функции |
| patreon.com (строка 1353) | Платформа для авторов, не adult по основной функции |
| split.io (в ST_in) | A/B тестинг сервис, используемый stripchat -- часть adult-провайдера, удаляется вместе с ним |
| strpst.com (в ST_in) | CDN stripchat -- часть adult-провайдера, удаляется вместе с ним |

### Кандидаты для обсуждения с пользователем (новые находки аудита)

Согласно решению пользователя ("новые находки аудита показать списком перед выполнением для подтверждения"):

1. **hembed.com / hembed** (строки 1365-1366) -- видео-embed CDN для hanime1.me. Рекомендация: adult.
2. **oisd_nsfw_small** (строки 1149-1155, 1472) -- NSFW-фильтр OISD. Рекомендация: adult (иначе grep "nsfw" найдет).
3. **oisd_nsfw_big** (строки 1156-1162, 1473) -- NSFW-фильтр OISD. Рекомендация: adult (иначе grep "nsfw" найдет).

Все остальные элементы -- однозначно adult, подтверждения не требуют.

## Recommended Plan Structure

### Plan 03-01: Аудит + перемещение + маркировка всех секций

**Scope:** Все 4 секции конфига (proxy-groups, rule-providers, rules, GLOBAL)

**Actions:**
1. Показать пользователю список находок аудита (hembed, oisd_nsfw) для подтверждения
2. Секция proxy-groups: вырезать 5 adult-групп (Sin, ST, CB, BG, BGP) и вставить перед GLOBAL с маркерами
3. Секция rule-providers: вырезать 8 adult-провайдеров и вставить в конец секции с маркерами
4. Секция rules: вырезать/собрать 38 adult-правил, вставить в начало rules (после QUIC/SAFE) с маркерами
5. Секция GLOBAL: обернуть 5 adult-ссылок маркерами
6. Верификация: grep по расширенному списку keywords вне маркерных блоков

**Estimated complexity:** Средняя -- много перемещений, но логика простая (cut-paste + wrap)

### Verification Strategy

```bash
# Шаг 1: Подсчитать строки внутри маркеров
grep -n ">>> ADULT\|<<< ADULT" config.yaml
# Ожидание: 8 маркеров (4 пары: proxy-groups, rule-providers, rules, GLOBAL)

# Шаг 2: Убедиться что grep вне маркеров = 0
# Удалить всё между маркерами, grep по keywords
sed '/# >>> ADULT/,/# <<< ADULT/d' config.yaml | grep -icE 'pornhub|stripchat|chaturbate|bongacams|bongacam|bongamodels|onlyfans|fansly|hentai|e-hentai|rule34|nsfw|porn|sinparty|hanime|hembed'
# Ожидание: 0

# Шаг 3: Проверить YAML-валидность
# mihomo -t config.yaml (или python -c "import yaml; yaml.safe_load(open('config.yaml'))")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Adult-контент разбросан по 4 секциям | Консолидация в маркированные блоки | Phase 3 (текущая) | Возможность автогенерации work-конфига |
| Ручное создание двух конфигов | Один конфиг + скрипт | Phase 5 (будущая) | Единый источник истины |

## Open Questions

1. **patreon.com -- adult или нет?**
   - What we know: Patreon -- универсальная платформа, не adult по основной функции. Однако используется авторами adult-контента.
   - What's unclear: Пользователь может считать patreon adult в контексте своего использования.
   - Recommendation: НЕ включать в adult (соответствует решению "только сайты с основной функцией adult"). Patreon.com остается в "Other".

2. **kemono.su -- adult или нет?**
   - What we know: Пиратский агрегатор контента с Patreon/Fanbox. Содержит как adult так и non-adult контент.
   - What's unclear: Основная функция -- пиратство, не adult.
   - Recommendation: НЕ включать в adult. kemono.su в ru-inline-banned (заблокированный в РФ), остается там.

3. **DOMAIN-KEYWORD,porn (строка 1360 -- `DOMAIN-KEYWORD,pornhub,Other`) vs category-porn**
   - What we know: DOMAIN-KEYWORD,pornhub покрывает все домены с "pornhub" в имени. category-porn покрывает тысячи porn-доменов.
   - Recommendation: Оба переносятся в adult-блок. Избыточность допустима (подстраховка, решение пользователя).

## Sources

### Primary (HIGH confidence)
- config.yaml -- прямой анализ конфига (1532 строки), полный grep-аудит
- 03-CONTEXT.md -- решения пользователя, зафиксированные в дискуссии
- REQUIREMENTS.md -- требования ADULT-01..ADULT-06
- STATE.md -- текущая позиция проекта (Phase 2 complete)
- ROADMAP.md -- структура фаз и зависимостей
- .planning/research/SUMMARY.md -- результаты начального исследования проекта

### Secondary (MEDIUM confidence)
- hembed.com как CDN hanime1 -- вывод из расположения в конфиге (рядом с hanime1, в одном блоке)

## Metadata

**Confidence breakdown:**
- Инвентарь adult-элементов: HIGH -- полный grep-аудит конфига
- Структура маркеров: HIGH -- решения пользователя четко зафиксированы
- Порядок правил: HIGH -- подтверждено research/SUMMARY.md (first-match-wins)
- Побочные эффекты (oisd_nsfw): HIGH -- grep по "nsfw" однозначно найдет

**Research date:** 2026-02-25
**Valid until:** До завершения Phase 3 (конфиг стабилен после Phase 2)
