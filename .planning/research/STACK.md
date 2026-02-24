# Исследование стека: Mihomo Config Management

**Дата исследования:** 2026-02-25
**Контекст:** Рефакторинг и улучшение конфигурации mihomo (Clash Meta) для обхода блокировок РФ на роутере Keenetic. Два варианта конфига: личный (полный) и рабочий (без adult).

---

## 1. Форматы Rule-Set: MRS vs YAML vs Text

### Рекомендация: MRS (Meta Rule Set) как основной формат

**Уверенность: ВЫСОКАЯ**

| Формат | Размер | Скорость парсинга | Читаемость | Поддержка behavior |
|--------|--------|-------------------|------------|-------------------|
| **MRS** (бинарный) | Минимальный (~10-50x меньше YAML) | Мгновенный (нативный бинарный) | Нет (бинарный) | domain, ipcidr |
| **YAML** | Большой | Медленный (парсинг текста) | Да | domain, ipcidr, classical |
| **Text** (.lst) | Средний | Средний | Да | domain, ipcidr, classical |

#### Почему MRS:
- **Производительность на роутере**: Keenetic имеет ограниченные RAM/CPU. MRS-файлы парсятся в разы быстрее, занимают меньше памяти при загрузке. Это критично при 20+ rule-провайдерах.
- **Нативный формат MetaCubeX**: Репозиторий `meta-rules-dat` публикует все geosite/geoip наборы в MRS. Это основной формат экосистемы.
- **Быстрая загрузка**: Меньший размер файлов = быстрее скачивание при обновлении (interval: 86400).
- **Целостность**: Бинарный формат не подвержен ошибкам парсинга YAML (неверные отступы, спецсимволы).

#### Когда использовать YAML/Text:
- **classical behavior**: MRS НЕ поддерживает `behavior: classical`. Для правил с AND/OR логикой, PROCESS-NAME, DST-PORT — только YAML или text.
- **inline правила**: Inline rule-providers всегда в YAML-синтаксисе внутри config.yaml.
- **Отладка**: Text-формат (.lst) удобен для ручной проверки списков, но в продакшне лучше MRS.

#### Что НЕ использовать:
- **YAML для больших domain/ipcidr списков** (geosite, OISD, refilter) — расходует RAM, медленный парсинг. Текущий конфиг корректно использует MRS для большинства, но `yandex` provider загружается в YAML без необходимости.
- **Смешивание форматов для одного типа данных** без причины — усложняет поддержку.

#### Конкретная рекомендация для текущего конфига:
```
domain behavior   → MRS  (geosite-*, youtube, telegram, discord, oisd, refilter, etc.)
ipcidr behavior   → MRS  (geoip-*, cloudflare-ips, telegram_ips, etc.)
classical behavior → text (.lst) или YAML  (discord_vc, CDN IP-списки Anton111111, inline rules)
inline rules      → YAML (встроены в config.yaml, для уникальных/малых наборов)
```

---

## 2. Источники Rule-Set

### 2.1 MetaCubeX/meta-rules-dat (Основной)

**Уверенность: ВЫСОКАЯ**

- **URL**: `https://github.com/MetaCubeX/meta-rules-dat`
- **Ветка**: `meta` (для MRS-файлов)
- **Что предоставляет**: Все geosite/geoip наборы, конвертированные из v2fly/domain-list-community и других источников в MRS/YAML/text
- **Путь к файлам**: `https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/{name}.mrs` и `geo/geoip/{name}.mrs`
- **Обновления**: Автоматические через GitHub Actions, ежедневные или по мере обновления upstream
- **Использовать для**: geosite-ru, geoip-ru, youtube, telegram, discord, cloudflare, steam, spotify, netflix, twitch, tiktok, openai, anthropic, google-gemini, category-porn, private, speedtest, remote-control, и все остальные geosite/geoip
- **Почему**: Официальный источник экосистемы MetaCubeX. Поддерживается авторами mihomo. Максимальная совместимость. Все три формата (MRS/YAML/text) доступны параллельно.

### 2.2 legiz-ru/mihomo-rule-sets (Россия-специфичный)

**Уверенность: ВЫСОКАЯ**

- **URL**: `https://github.com/legiz-ru/mihomo-rule-sets`
- **Что предоставляет**: re-filter (ECH/noECH), ru-bundle, OISD (big/small/nsfw), торренты (clients/trackers/websites), games-direct, ru-app-list, discord-voice-ip-list
- **Почему**: Специализирован для российских реалий. Поддерживает re-filter (список доменов, заблокированных РКН, с разделением на ECH/noECH). Готовые MRS-файлы. Активно обновляется.
- **Использовать для**: refilter_ech, refilter_noech, refilter_ipsum, ru-bundle, oisd_big/small/nsfw, torrent-*, games-direct, ru-app-list

### 2.3 itdoginfo/allow-domains (Россия, классификация доступа)

**Уверенность: СРЕДНЯЯ**

- **URL**: `https://github.com/itdoginfo/allow-domains`
- **Что предоставляет**: Списки доменов для Russia/inside и Russia/outside в формате clashx (.lst text)
- **inside**: Домены, к которым нужен доступ из РФ (российские сервисы, которые блокируют не-РФ IP)
- **outside**: Домены, заблокированные в РФ (нужен прокси)
- **Формат**: text (.lst), classical behavior
- **Почему использовать**: Хорошо поддерживаемый источник с разделением inside/outside. Дополняет geosite-ru.
- **Ограничение**: Формат text/classical — менее эффективен, чем MRS. Но для classical behavior альтернатив нет.

### 2.4 Anton111111/rule-lists (CDN/Cloud IP-блоки)

**Уверенность: СРЕДНЯЯ**

- **URL**: `https://github.com/Anton111111/rule-lists`
- **Что предоставляет**: IP-диапазоны крупных CDN/облачных провайдеров (Akamai, Amazon, CDN77, Cloudflare, DigitalOcean, Fastly, Google, Hetzner, Mega, Meta, Oracle, OVH, Vultr), а также youtube_ips, telegram_ips, discord_ips, ru_ips, other, politic
- **Формат**: text (.list), classical behavior
- **Почему использовать**: Единственный комплексный источник CDN/Cloud IP-блоков в формате, совместимом с mihomo. Полезно для маршрутизации по IP, когда DNS sniffer не определяет домен.
- **Ограничение**: Релизы привязаны к дате (`lists-20251102-014123-835e3fe`). Нужно следить за обновлениями. URL с конкретной версией не обновляется автоматически — нужно использовать `latest` download link или обновлять вручную.
- **РЕКОМЕНДАЦИЯ**: Проверить, есть ли у Anton111111 `latest` release tag. Если нет — рассмотреть скрипт обновления URL или переход на MetaCubeX geoip аналоги для CDN (cloudflare, google, amazon есть в meta-rules-dat как geoip).

### 2.5 antifilter.download (Россия, реестр блокировок)

**Уверенность: СРЕДНЯЯ**

- **URL**: `https://antifilter.download/`
- **Что предоставляет**: Актуальные списки заблокированных ресурсов из реестра РКН. Форматы: community.lst, ipsum.lst (IP-списки)
- **Почему**: Наиболее оперативное обновление списка блокировок РКН. Автоматическая выгрузка из реестра.
- **Ограничение**: Формат не MRS — требуется конвертация или использование text/classical. Для mihomo удобнее через legiz-ru/mihomo-rule-sets, который уже конвертирует antifilter + re-filter в MRS.

### 2.6 v2fly/domain-list-community (Upstream для geosite)

**Уверенность: ВЫСОКАЯ**

- **URL**: `https://github.com/v2fly/domain-list-community`
- **Что предоставляет**: Исходные данные для всех geosite категорий. MetaCubeX конвертирует эти данные в MRS/YAML/text.
- **Использовать напрямую**: НЕТ. Использовать через MetaCubeX/meta-rules-dat, где данные уже в нужных форматах.

### 2.7 zxc-rv/ad-filter (Кастомный adblock)

**Уверенность: НИЗКАЯ**

- **URL**: `https://github.com/zxc-rv/ad-filter`
- **Текущее использование**: `hagezi_pro` provider в конфиге
- **Рекомендация**: Оценить, не дублирует ли OISD. Если OISD big покрывает те же домены — удалить для упрощения. Если есть уникальные правила — оставить, но документировать.

### Что НЕ использовать:
- **Старые clash-правила из случайных gist/gist.github.com** — нет гарантии обновлений, могут содержать устаревшие домены
- **OMchik33/custom-rules** (gaming-ips, gaming-domains) — текущий конфиг использует его. **Проверить актуальность**: последний коммит, частота обновлений. Если заброшен — найти замену или включить правила в inline.

---

## 3. Инструменты генерации конфигов

### 3.1 Рекомендация: Собственный скрипт на Python

**Уверенность: ВЫСОКАЯ**

Для задачи "один базовый конфиг → personal + work" готовых инструментов в экосистеме mihomo нет. Нужен кастомный скрипт.

#### Подход 1: Маркеры + вырезание (Простой)

```python
# Скрипт читает config.yaml, удаляет блоки между маркерами
# # >>> ADULT
# ...adult rules...
# # <<< ADULT
# Результат: work-config.yaml
```

**Преимущества**: Минимальная сложность, один файл-источник, понятная логика.
**Недостатки**: Маркеры в YAML могут сломать структуру (если adult-правило в середине списка).

#### Подход 2: YAML merge/override (Продвинутый)

```python
# base.yaml — общие настройки
# personal.yaml — adult proxy-groups и rules
# work.yaml — пустой оверрайд (или с дополнительными ограничениями)
# Скрипт: merge(base + personal) → personal-config.yaml
#          merge(base + work)     → work-config.yaml
```

**Преимущества**: Чистое разделение, нет маркеров в основном файле.
**Недостатки**: Сложнее поддерживать, нужно учитывать порядок правил при merge.

#### Рекомендация для данного проекта:

**Подход 1 (маркеры)** — оптимален по соотношению сложность/результат.

**Инструментарий**:
- **Язык**: Python 3.x (установлен на Windows, кроссплатформенный)
- **Библиотека**: `pyyaml` для валидации итогового YAML, `re` для обработки маркеров
- **Альтернатива**: PowerShell скрипт (нативен для Windows, не требует Python)
- **Формат маркеров**:
  ```yaml
  # >>> ADULT:GROUP  (начало adult-блока в секции proxy-groups)
  - name: 'ST'
    ...
  # <<< ADULT:GROUP

  # >>> ADULT:RULE  (начало adult-блока в секции rules)
  - RULE-SET,ST_in,ST
  ...
  # <<< ADULT:RULE

  # >>> ADULT:PROVIDER  (начало adult-блока в секции rule-providers)
  ST_in:
    ...
  # <<< ADULT:PROVIDER
  ```

**Что скрипт должен делать**:
1. Прочитать `config.yaml`
2. Удалить все блоки между `# >>> ADULT` и `# <<< ADULT` (включая маркеры)
3. Удалить ссылки на удалённые proxy-groups из GLOBAL group
4. Валидировать результат как YAML
5. Записать `work-config.yaml`
6. Опционально: генерировать secure secret для dashboard (заменить `admin`)

### 3.2 Существующие инструменты экосистемы

- **mihomo itself**: Нет встроенной генерации вариантов. Конфиг — один файл.
- **Sub-Store / subconverter**: Конвертеры подписок, не подходят для генерации вариантов из одного конфига.
- **Clash Verge / Mihomo Party**: GUI-клиенты с merge-конфигами (override). Не подходят для роутера.

### Что НЕ использовать:
- **Jinja2 шаблоны** — избыточная сложность для задачи вырезания блоков
- **sed/awk** — ненадёжны для YAML, могут сломать структуру
- **Ручное поддержание двух файлов** — неизбежно разойдутся

---

## 4. Инструменты валидации

### 4.1 mihomo -t (Встроенная валидация)

**Уверенность: ВЫСОКАЯ**

```bash
mihomo -t -d /path/to/config/dir
# или
mihomo -t -f /path/to/config.yaml
```

- **Что делает**: Проверяет синтаксис конфига, валидность proxy-groups, rule-providers, правил
- **Ограничения**: Требует наличие mihomo binary. На Windows — можно скачать mihomo.exe.
- **URL**: `https://github.com/MetaCubeX/mihomo/releases`
- **Рекомендация**: Включить в скрипт генерации — после создания work-config.yaml запускать `mihomo -t` для проверки.

### 4.2 YAML lint (yamllint)

**Уверенность: ВЫСОКАЯ**

```bash
pip install yamllint
yamllint config.yaml
```

- **Что делает**: Проверяет валидность YAML-синтаксиса (отступы, дубликаты ключей, спецсимволы)
- **Не проверяет**: Семантику mihomo (валидность proxy-groups, правил, rule-providers)
- **Рекомендация**: Использовать как первый этап валидации перед `mihomo -t`

### 4.3 Python-скрипт кастомной валидации

**Уверенность: СРЕДНЯЯ**

Для проекта полезен скрипт, который:
1. Парсит config.yaml как YAML
2. Проверяет, что все proxy-groups, упомянутые в rules, определены в proxy-groups
3. Проверяет, что все rule-providers, упомянутые в rules, определены в rule-providers
4. Находит дубликаты правил (DOMAIN-SUFFIX, DOMAIN-KEYWORD, RULE-SET с одинаковыми параметрами)
5. Проверяет, что URL rule-providers доступны (опциональный online-check)
6. Выявляет неиспользуемые proxy-groups и rule-providers

### 4.4 Zashboard / Dashboard

- **Текущее использование**: Уже настроен в конфиге
- **Возможности**: Визуальная проверка работы правил, логов, proxy-groups в runtime
- **Ограничение**: Не замена статической валидации — работает только с запущенным mihomo

### Что НЕ использовать:
- **Онлайн YAML-валидаторы** — не знают схему mihomo, не помогут найти семантические ошибки
- **JSON Schema для Clash** — устаревшие, не покрывают mihomo-специфичные расширения (MRS, behaviors)

---

## 5. GeoData: Источники и форматы

### 5.1 Форматы: DAT vs MMDB

| Характеристика | `.dat` (V2Ray/mihomo) | `.mmdb` (MaxMind) |
|---|---|---|
| **GeoIP** | `geoip.dat` — V2Ray формат, поддерживает множественные категории (RU, telegram, cloudflare и т.д.) | `geoip.metadb` / `country.mmdb` — MaxMind-совместимый, только страновые коды |
| **GeoSite** | `geosite.dat` / `dlc.dat` — категории доменов (category-ru, youtube, telegram и т.д.) | Не существует (MMDB = только IP) |
| **Скорость** | Быстрый для категорийных запросов | Быстрый для country lookup |
| **Размер** | Больше (содержит все категории) | Меньше (только IP→country) |
| **Совместимость с mihomo** | Полная (`geodata-mode: true`) | Полная (`geodata-mode: false`, default) |

### 5.2 Рекомендация: DAT-формат + Rule-Set MRS

**Уверенность: ВЫСОКАЯ**

Текущий конфиг использует `geodata-mode: true` с DAT-файлами. Это **правильный выбор**, но с оговоркой:

**Оптимальная стратегия: Гибридная**

1. **GeoData (DAT)** — оставить для `GEOSITE,*` и `GEOIP,*` правил, которые ещё используются в rules-секции
2. **Rule-Set (MRS)** — постепенно мигрировать с `GEOSITE,*`/`GEOIP,*` на `RULE-SET,*` с MRS-провайдерами

**Почему мигрировать с GEOSITE/GEOIP на RULE-SET:**
- GEOSITE/GEOIP загружают ВЕСЬ `.dat` файл в память (~20-40 МБ), даже если используется 5 категорий из 500+
- RULE-SET с MRS загружает только нужные категории (~50-500 КБ каждая)
- На роутере с ограниченной RAM это существенная экономия
- RULE-SET обновляются независимо (interval per provider), а .dat — целиком

**План миграции:**
```
ТЕКУЩЕЕ:                              ЦЕЛЕВОЕ:
GEOSITE,youtube,YouTube        →  RULE-SET,youtube,YouTube         (уже есть MRS-провайдер)
GEOSITE,telegram,Telegram      →  RULE-SET,telegram_domains,Telegram (уже есть MRS-провайдер)
GEOIP,telegram,Telegram        →  RULE-SET,telegram_ips,Telegram    (уже есть MRS-провайдер)
GEOSITE,discord,Discord        →  RULE-SET,discord_domains,Discord  (уже есть MRS-провайдер)
GEOSITE,category-ru,RU трафик  →  RULE-SET,geosite-ru,RU трафик    (уже есть MRS-провайдер)
GEOIP,RU,RU трафик             →  RULE-SET,geoip-ru,RU трафик      (уже есть MRS-провайдер)
... и остальные GEOSITE/GEOIP правила
```

После полной миграции: `geodata-mode` и `geox-url` можно будет удалить, что сэкономит ~40 МБ RAM на роутере.

### 5.3 Конкретные источники GeoData

#### Для GeoIP (DAT — текущий):
- **URL**: `https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geoip.dat`
- **Источник**: MetaCubeX сборка на базе MaxMind + дополнительные категории (telegram, cloudflare, etc.)
- **Альтернатива (MMDB)**: `https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geoip-lite.metadb` — если переключиться на `geodata-mode: false`

#### Для GeoSite (DAT — текущий):
- **Текущий URL**: `https://github.com/v2fly/domain-list-community/releases/latest/download/dlc.dat`
- **РЕКОМЕНДАЦИЯ**: Заменить на MetaCubeX-сборку: `https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geosite.dat`
- **Почему**: MetaCubeX-сборка включает дополнительные категории (google-gemini, anthropic и другие AI-сервисы), которых нет в оригинальном v2fly. Текущий конфиг использует `GEOSITE,anthropic` и `GEOSITE,google-gemini`, которые могут отсутствовать в v2fly dlc.dat.

#### Для Rule-Set MRS (целевой):
- **URL-шаблон**: `https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/{category}.mrs`
- **URL-шаблон**: `https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/{country}.mrs`
- **Полный список категорий**: см. содержимое ветки `meta` репозитория

### Что НЕ использовать:
- **v2fly dlc.dat для geosite** — если используются MetaCubeX-специфичные категории (anthropic, google-gemini). Текущий конфиг некорректно использует v2fly dlc.dat для geosite, но MetaCubeX geoip.dat для geoip.
- **Самосборные .dat файлы** — нет необходимости, MetaCubeX покрывает все потребности
- **GeoLite2 MMDB напрямую** — не содержит категорий (telegram, cloudflare), только страны

---

## 6. Сводная таблица рекомендаций

| Компонент | Текущее состояние | Рекомендация | Приоритет |
|-----------|-------------------|--------------|-----------|
| Формат rule-set | MRS + YAML + text (смешанный) | MRS для domain/ipcidr, text для classical | Средний |
| GeoSite источник | v2fly dlc.dat | MetaCubeX geosite.dat ИЛИ полная миграция на RULE-SET MRS | Высокий |
| GeoIP источник | MetaCubeX geoip.dat | Оставить ИЛИ мигрировать на RULE-SET MRS | Средний |
| geodata-mode | true (DAT) | Мигрировать на RULE-SET MRS, отключить geodata-mode | Средний |
| Основной источник правил | MetaCubeX meta-rules-dat | Оставить | — |
| РФ-специфичные правила | legiz-ru + itdoginfo + Anton111111 | Оставить legiz-ru + itdoginfo, оценить замену Anton111111 на MetaCubeX geoip | Низкий |
| CDN/Cloud IP-блоки | Anton111111 (фиксированная версия) | Проверить наличие latest-тега или заменить MetaCubeX geoip аналогами | Средний |
| Генерация вариантов | Нет | Python-скрипт с маркерами `# >>> ADULT` / `# <<< ADULT` | Высокий |
| Валидация | Нет | `yamllint` + `mihomo -t` + кастомный Python-скрипт проверки дубликатов/ссылок | Высокий |
| Adblock | OISD big+small+nsfw + hagezi_pro | Оставить только OISD big (small — подмножество big), убрать дубль | Высокий |
| yandex provider | YAML формат | Перевести на MRS (`yandex.mrs`) | Низкий |
| gaming-ips | OMchik33 YAML | Проверить актуальность, при необходимости заменить | Низкий |

---

## 7. Конкретные URL для использования

### MetaCubeX meta-rules-dat (ветка meta, MRS):
```
# GeoSite (domain behavior, MRS)
https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/{name}.mrs

# GeoIP (ipcidr behavior, MRS)
https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/{name}.mrs

# GeoSite (domain behavior, YAML) — только если нужна читаемость
https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/{name}.yaml

# DAT-файлы (для geodata-mode: true)
https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geosite.dat
https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geoip.dat
https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geoip-lite.metadb
```

### legiz-ru/mihomo-rule-sets:
```
https://github.com/legiz-ru/mihomo-rule-sets/raw/main/re-filter/re-filter-ech.mrs
https://github.com/legiz-ru/mihomo-rule-sets/raw/main/re-filter/re-filter-noech.mrs
https://github.com/legiz-ru/mihomo-rule-sets/raw/main/re-filter/ip-rule.mrs
https://github.com/legiz-ru/mihomo-rule-sets/raw/main/re-filter/domain-rule.mrs
https://github.com/legiz-ru/mihomo-rule-sets/raw/main/ru-bundle/rule.mrs
https://github.com/legiz-ru/mihomo-rule-sets/raw/main/oisd/big.mrs
https://github.com/legiz-ru/mihomo-rule-sets/raw/main/oisd/nsfw.mrs
https://github.com/legiz-ru/mihomo-rule-sets/raw/main/other/torrent-clients.yaml
https://github.com/legiz-ru/mihomo-rule-sets/raw/main/other/torrent-trackers.mrs
https://github.com/legiz-ru/mihomo-rule-sets/raw/main/other/torrent-websites.mrs
https://github.com/legiz-ru/mihomo-rule-sets/raw/main/other/games-direct.yaml
https://github.com/legiz-ru/mihomo-rule-sets/raw/main/other/ru-app-list.yaml
https://github.com/legiz-ru/mihomo-rule-sets/raw/main/other/discord-voice-ip-list.mrs
```

### itdoginfo/allow-domains:
```
https://raw.githubusercontent.com/itdoginfo/allow-domains/main/Russia/inside-clashx.lst
https://raw.githubusercontent.com/itdoginfo/allow-domains/main/Russia/outside-clashx.lst
```

### Anton111111/rule-lists:
```
https://github.com/Anton111111/rule-lists/releases/latest/download/{name}.list
# ВНИМАНИЕ: проверить работает ли latest tag — в текущем конфиге используется фиксированная версия
```

### mihomo binary (для валидации):
```
https://github.com/MetaCubeX/mihomo/releases/latest
```

### Zashboard (Dashboard UI):
```
https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip
```

---

## 8. Ограничения исследования

- **Внешние источники не были проверены онлайн** — рекомендации основаны на знании экосистемы mihomo по состоянию на начало 2025 года и анализе текущего конфига. URL-ы MetaCubeX и legiz-ru стабильны и используют GitHub-хостинг с предсказуемой структурой.
- **Anton111111/rule-lists** — необходимо проверить наличие `latest` release tag вручную.
- **OMchik33/custom-rules** — необходимо проверить дату последнего обновления.
- **Производительность MRS vs YAML на конкретном Keenetic** — оценка теоретическая. Для точных данных нужен бенчмарк на целевом оборудовании.

---

*Исследование: 2026-02-25*
*Уровень уверенности: Высокий для форматов и основных источников, Средний для инструментов генерации*
