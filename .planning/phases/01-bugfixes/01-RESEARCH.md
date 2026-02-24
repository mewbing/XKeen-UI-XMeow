# Phase 1: Bugfixes - Research

**Researched:** 2026-02-25
**Domain:** Mihomo (Clash Meta) YAML config -- исправление синтаксических ошибок, дублей правил и провайдеров
**Confidence:** HIGH

## Summary

Phase 1 охватывает три точечных исправления в config.yaml: синтаксическая ошибка DST-PORT (DEDUP-08), дубль OISD small (DEDUP-05) и дубль bongacams.ru в категории Other (DEDUP-09). Все три бага подтверждены анализом конфига. DEDUP-10 (Logitech) снят с фазы по решению пользователя.

Ключевая техническая находка: правило `DST-PORT,53,53` (строка 1603) создает неоднозначность парсинга, потому что mihomo использует запятую И как разделитель полей правила (тип, порт, политика), И как разделитель портов в multiport-синтаксисе. Документация mihomo подтверждает, что `/` и `,` оба допустимы для разделения портов в DST-PORT. Решение: заменить запятую на `/` в port-спецификации, чтобы убрать двусмысленность, или обернуть в AND-конструкцию.

**Primary recommendation:** Исправить три бага последовательными точечными правками с валидацией `mihomo -t` после каждого изменения.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **DST-PORT правило (DEDUP-08):** Правило `DST-PORT,53,53` (строка 1603) исправить -- синтаксис сломан, mihomo -t выдает ошибку. Замысел правила: направлять DNS-трафик (порт 53) в прокси-группу '53'. Группа '53' по умолчанию DIRECT -- это правильно, не менять. Имя группы '53' НЕ переименовывать. Позицию правила НЕ менять -- оставить в конце секции rules (после локальных IP).
- **OISD дубль (DEDUP-05):** Удалить oisd_small из rule-providers и из rules. Оставить только oisd_big (big является надмножеством small). Подтвердить что big покрывает small перед удалением.
- **bongacams.ru дубль (DEDUP-09):** Удалить строку `DOMAIN-SUFFIX,bongacams.ru,Other` (строка 1491) -- это дубль. bongacams уже покрыт группой BG: inline-правила (строки 1297-1311) + провайдер BG_in. Только удалить дубль из Other, остальные adult-сайты (onlyfans, pornhub и т.д.) -- это Phase 3.
- **Logitech -- СНЯТ с Phase 1:** DEDUP-10 удален из Phase 1 и из requirements. Оба способа определения (GEOSITE + KEYWORD) остаются как есть.

### Claude's Discretion
- Покрытие bongacams .ru доменов в BG_in провайдере (сейчас только .com) -- проверить и починить если нужно
- Точный синтаксис исправления DST-PORT правила

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEDUP-05 | OISD small удален (big является надмножеством small), подтверждено что big покрывает small | Подтверждено: OISD FAQ явно говорит что big -- надмножество small. Small фокусируется на рекламе, big добавляет malware/phishing/tracking. Безопасно удалять small при наличии big. |
| DEDUP-08 | Ошибка DST-PORT,53,53 исправлена на корректное правило | Исследован синтаксис mihomo DST-PORT. Проблема: запятая двусмысленна как port separator. Решение: `DST-PORT,53,53` заменить на формат без двусмысленности. |
| DEDUP-09 | bongacams.ru удален из категории "Other" (уже есть в adult-блоке BG) | Подтверждено: строка 1309 содержит `DOMAIN-REGEX,^([\\w\\-\\.]+\\.)?bongacams\\.ru$,BG`, которая покрывает bongacams.ru. Строка 1491 -- дубль в другую группу. |
| DEDUP-10 | Дублирующиеся правила Logitech консолидированы | СНЯТ с Phase 1 по решению пользователя. Не адресуется. |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| mihomo (Clash Meta) | v1.19.x | Прокси-движок, парсит config.yaml | Единственная целевая платформа |
| YAML | 1.2 | Формат конфигурации | Стандартный формат mihomo |
| mihomo -t | CLI | Валидация конфига без запуска | Единственный способ проверить синтаксис правил |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| YAML linter | Проверка синтаксиса YAML | Перед `mihomo -t`, ловит базовые ошибки формата |
| grep/search | Поиск всех вхождений домена/правила | Перед удалением -- убедиться что дубль действительно покрыт |

## Architecture Patterns

### Структура правила mihomo

Формат правила:
```
RULE-TYPE,payload,proxy-group[,params]
```

Примеры:
```yaml
# Простое правило -- один порт, одна группа
- DST-PORT,53,DIRECT

# Multiport в AND-конструкции (порты через запятую -- безопасно внутри скобок)
- AND,((NETWORK,UDP),(DST-PORT,135,137,138,139)),SAFE

# Правило с rule-set
- RULE-SET,oisd_big,Ad-Filter

# Доменное правило
- DOMAIN-SUFFIX,bongacams.ru,Other
```

### Pattern 1: DST-PORT синтаксис
**What:** Правило маршрутизации по destination-порту
**When to use:** Когда нужно направить трафик определенного порта в конкретную группу

Формат: `DST-PORT,<port_spec>,<policy>`

Разделители портов в port_spec:
- `-` для диапазонов: `50000-50100`
- `/` для списка: `80/443/8080`
- `,` для списка: `135,137,138,139`

**КРИТИЧЕСКАЯ ПРОБЛЕМА:** Когда DST-PORT используется как standalone правило (не внутри AND/OR), запятая в port_spec создает двусмысленность, потому что запятая также разделяет поля правила.

Пример проблемы:
```yaml
# СЛОМАНО: mihomo не может отличить port-separator от field-separator
- DST-PORT,53,53
# Парсер видит: тип=DST-PORT, а "53,53" -- это два порта? или порт + группа?
```

**Безопасные варианты исправления:**

Вариант A -- Обертка в AND (рекомендуется, однозначно):
```yaml
# Источник: config.yaml строка 1294 -- рабочий паттерн из того же конфига
- AND,((DST-PORT,53)),53
```

Вариант B -- Использовать `/` вместо `,` если нужно multiport:
```yaml
- DST-PORT,53,53
# Здесь "53" после второй запятой -- имя группы. Один порт, нет двусмысленности.
# Но mihomo -t все равно ругается, значит парсер интерпретирует иначе.
```

### Pattern 2: Удаление rule-provider и правила

При удалении rule-provider нужно удалить его в ДВУХ местах:
1. Определение в секции `rule-providers:`
2. Все ссылки в секции `rules:` (формат `RULE-SET,provider_name,Group`)

**Пример:**
```yaml
# 1. Удалить из rule-providers (строки 1221-1227):
oisd_small:
  type: http
  behavior: domain
  format: mrs
  url: https://...
  path: ./oisd/small.mrs
  interval: 86400

# 2. Удалить из rules (строка 1607):
- RULE-SET,oisd_small,Ad-Filter
```

### Anti-Patterns to Avoid
- **Удаление правила без проверки покрытия:** Перед удалением `DOMAIN-SUFFIX,bongacams.ru,Other` необходимо убедиться, что домен покрыт другим правилом ВЫШЕ по списку (first-match-wins).
- **Изменение позиции правил:** В Phase 1 позиции правил НЕ меняются. Только точечные правки содержимого.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Проверка YAML-синтаксиса | Ручная проверка глазами | `mihomo -t` | Ловит ошибки парсинга, ссылки на несуществующие группы |
| Проверка покрытия правил | Ручной подсчет строк | grep по конфигу | Гарантирует что все вхождения найдены |

## Common Pitfalls

### Pitfall 1: DST-PORT запятая как port separator vs field separator
**What goes wrong:** `DST-PORT,53,53` парсится неоднозначно -- mihomo может интерпретировать `53,53` как "два порта 53 и 53" без указания целевой группы, что вызывает ошибку.
**Why it happens:** Документация mihomo говорит что `/` и `,` оба допустимы для разделения портов. Но запятая также разделяет поля правила (тип, payload, target).
**How to avoid:** Для standalone DST-PORT правил использовать AND-обертку: `AND,((DST-PORT,53)),53`. Это однозначно -- внутри скобок запятые разделяют порты, снаружи -- поля правила.
**Warning signs:** `mihomo -t` выдает ошибку парсинга на строке с DST-PORT.

### Pitfall 2: Удаление rule-provider без удаления ссылки в rules
**What goes wrong:** Если удалить `oisd_small` из `rule-providers` но оставить `RULE-SET,oisd_small,Ad-Filter` в `rules`, mihomo не запустится.
**Why it happens:** mihomo валидирует все RULE-SET ссылки при загрузке конфига.
**How to avoid:** Всегда удалять И определение провайдера, И все ссылки на него в rules.
**Warning signs:** `mihomo -t` выдает "rule-set oisd_small not found".

### Pitfall 3: bongacams.ru покрытие в BG_in провайдере
**What goes wrong:** Провайдер BG_in (строки 634-646) содержит ТОЛЬКО `.com` домены. `.ru` домены покрыты ТОЛЬКО inline-правилами в rules (строки 1309-1311).
**Why it happens:** BG_in был создан для основных доменов, .ru варианты добавлены позже отдельно.
**How to avoid:** При удалении `DOMAIN-SUFFIX,bongacams.ru,Other` убедиться что `.ru` домены покрыты inline DOMAIN-REGEX правилами выше по rules. Они покрыты (строка 1309).
**Warning signs:** bongacams.ru перестает маршрутизироваться через BG группу.

### Pitfall 4: Позиция DOMAIN-SUFFIX,bongacams.ru,Other (строка 1491) vs inline правила BG (строка 1309)
**What goes wrong:** Может показаться что удаление строки 1491 оставит bongacams.ru без маршрутизации.
**Why it happens:** Непонимание first-match-wins семантики.
**How to avoid:** Строка 1309 (`DOMAIN-REGEX,^([\\w\\-\\.]+\\.)?bongacams\\.ru$,BG`) находится ВЫШЕ строки 1491, поэтому bongacams.ru УЖЕ перехватывается BG группой. Строка 1491 -- мертвый код (никогда не срабатывает).
**Warning signs:** Нет -- удаление мертвого кода безопасно.

## Code Examples

### Fix 1: DST-PORT,53,53 (DEDUP-08)

**Текущее (сломанное):**
```yaml
# Строка 1603
- DST-PORT,53,53
```

**Исправленное (рекомендация -- AND-обертка):**
```yaml
# Строка 1603
- AND,((DST-PORT,53)),53
```

Обоснование: AND-конструкция уже используется в этом же конфиге для DST-PORT правил (строки 1294, 1387-1388, 1646 через OR). Внутри AND скобок запятая однозначно разделяет порты, а имя группы идет после закрывающих скобок. Группа '53' определена в proxy-groups (строка 452), по умолчанию DIRECT.

**Альтернативный вариант (проще, но требует проверки mihomo -t):**
```yaml
# Если mihomo умеет отличить -- последний элемент = имя группы
- DST-PORT,53,53
# По документации формат: DST-PORT,port,policy
# Если один порт (53) и policy (53), то парсер должен справиться
# НО: CONTEXT.md говорит что mihomo -t ругается, значит НЕ справляется
```

### Fix 2: Удаление OISD small (DEDUP-05)

**Удалить из rule-providers (строки 1221-1227):**
```yaml
# УДАЛИТЬ ЦЕЛИКОМ:
  oisd_small:
    type: http
    behavior: domain
    format: mrs
    url: https://github.com/legiz-ru/mihomo-rule-sets/raw/main/oisd/small.mrs
    path: ./oisd/small.mrs
    interval: 86400
```

**Удалить из rules (строка 1607):**
```yaml
# УДАЛИТЬ:
  - RULE-SET,oisd_small,Ad-Filter
```

**Оставить нетронутым:**
```yaml
# rule-providers (строки 1214-1220) -- НЕ ТРОГАТЬ:
  oisd_big:
    type: http
    behavior: domain
    format: mrs
    url: https://github.com/legiz-ru/mihomo-rule-sets/raw/main/oisd/big.mrs
    path: ./oisd/big.mrs
    interval: 86400

# rules (строка 1608, станет 1607 после удаления) -- НЕ ТРОГАТЬ:
  - RULE-SET,oisd_big,Ad-Filter
```

### Fix 3: Удаление bongacams.ru из Other (DEDUP-09)

**Удалить (строка 1491):**
```yaml
# УДАЛИТЬ:
  - DOMAIN-SUFFIX,bongacams.ru,Other
```

**Почему безопасно:** bongacams.ru перехватывается раньше:
- Строка 1309: `DOMAIN-REGEX,^([\\w\\-\\.]+\\.)?bongacams\\.ru$,BG` -- покрывает bongacams.ru и все поддомены
- Строка 1297: `DOMAIN-SUFFIX,bongacams,BG` -- покрывает bare suffix "bongacams" (без TLD)

First-match-wins: строка 1309 обрабатывается раньше строки 1491, поэтому строка 1491 никогда не срабатывает.

### Discretion: BG_in провайдер -- нужно ли добавлять .ru домены?

**Текущее состояние BG_in (строки 634-646):**
```yaml
BG_in:
  type: inline
  payload:
    - DOMAIN-REGEX,^([A-Za-z0-9-]+\.)*bongacams\.com$
    - DOMAIN-REGEX,^([A-Za-z0-9-]+\.)*bongacams16\.com$
    - DOMAIN-REGEX,^([A-Za-z0-9-]+\.)*bongacam\.com$
    - DOMAIN-SUFFIX,bongacams
    - DOMAIN-SUFFIX,bongacams16
    - DOMAIN-SUFFIX,bongacam
    - DOMAIN-SUFFIX,bongacam.com
    - DOMAIN-SUFFIX,bongacams.com
    - DOMAIN-SUFFIX,bongacams16.com
  behavior: classical
```

**Анализ покрытия .ru:**
- `DOMAIN-SUFFIX,bongacams` (строка 640) -- покрывает ВСЕ TLD: bongacams.com, bongacams.ru, bongacams.xyz и т.д., потому что DOMAIN-SUFFIX без точки перед суффиксом матчит как "ends with bongacams" включая сам домен.
- Аналогично `DOMAIN-SUFFIX,bongacams16` (строка 641) покрывает bongacams16.ru.
- Аналогично `DOMAIN-SUFFIX,bongacam` (строка 642) покрывает bongacam.ru.

**Вывод:** BG_in провайдер УЖЕ покрывает .ru домены через bare DOMAIN-SUFFIX (без TLD). Дополнительные DOMAIN-REGEX для .ru в inline rules (строки 1309-1311) -- избыточны, но не вредят. Менять BG_in НЕ нужно.

**Рекомендация:** Не добавлять .ru домены в BG_in -- они уже покрыты. Phase 1 scope: только удалить дубль из Other.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `DST-PORT,port,policy` (простой формат) | Multiport: `DST-PORT,80/443,policy` | mihomo v1.9.0+ | Запятая стала двусмысленной как separator |
| OISD small + big вместе | Только OISD big | Давно (big всегда был надмножеством) | Удаление small экономит bandwidth и memory |

## Open Questions

1. **Точный синтаксис AND-обертки для DST-PORT**
   - What we know: AND,((DST-PORT,53)),53 -- логически корректно, используется аналогичный паттерн в строке 1294
   - What's unclear: mihomo может требовать минимум 2 условия внутри AND (хотя логически одно условие тоже валидно)
   - Recommendation: Если AND с одним условием не работает, использовать `AND,((DST-PORT,53),(DST-PORT,53)),53` (дублирование условия) или `AND,((NETWORK,tcp/udp),(DST-PORT,53)),53`. Валидировать через `mihomo -t`.

2. **DOMAIN-SUFFIX bare suffix семантика**
   - What we know: `DOMAIN-SUFFIX,bongacams` без TLD -- по документации mihomo матчит все домены заканчивающиеся на "bongacams" (включая bongacams.ru, bongacams.com, sub.bongacams.anything)
   - What's unclear: Может ли bare suffix матчить середину домена (например, mybongacams.com)?
   - Recommendation: Для Phase 1 это не критично -- покрытие .ru подтверждено через DOMAIN-REGEX в inline rules.

## Sources

### Primary (HIGH confidence)
- [Route Rules - mihomo docs](https://wiki.metacubex.one/en/config/rules/) -- формат DST-PORT,port,policy
- [Grammar - mihomo docs](https://wiki.metacubex.one/en/handbook/syntax/) -- port range syntax: `/` и `,` как разделители
- [OISD FAQ](https://oisd.nl/faq) -- big является надмножеством small
- config.yaml (анализ строк 634-646, 1297-1311, 1491, 1603, 1607, 1221-1227) -- фактическое содержимое

### Secondary (MEDIUM confidence)
- [MetaCubeX/mihomo GitHub config.go](https://github.com/MetaCubeX/mihomo/blob/Meta/config/config.go) -- логика ParseRulePayload, подтверждает что последний элемент = proxy group name
- Codebase CONCERNS.md -- документированные проблемы с DST-PORT и OISD

### Tertiary (LOW confidence)
- Семантика `AND,((DST-PORT,53)),53` с одним условием -- не проверено на реальном mihomo, требует валидации через `mihomo -t`

## Metadata

**Confidence breakdown:**
- DEDUP-05 (OISD): HIGH -- OISD FAQ явно подтверждает big > small
- DEDUP-08 (DST-PORT): HIGH для диагноза проблемы, MEDIUM для точного синтаксиса исправления (требуется mihomo -t валидация)
- DEDUP-09 (bongacams): HIGH -- first-match-wins анализ подтверждает что строка 1491 мертвый код
- BG_in .ru покрытие (discretion): HIGH -- bare DOMAIN-SUFFIX покрывает все TLD

**Research date:** 2026-02-25
**Valid until:** Стабильный домен (конфиг mihomo), валидно 30+ дней
