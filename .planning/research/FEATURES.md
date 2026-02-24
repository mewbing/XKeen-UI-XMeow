# Features Research: Mihomo Config для обхода блокировок РФ

**Дата исследования:** 2026-02-25
**Контекст:** Рефакторинг конфигурации mihomo (Clash Meta) на роутере Keenetic для обхода российских блокировок. Два варианта конфига: personal (полный) и work (без adult).

---

## 1. Текущая ситуация с блокировками в РФ (2025-2026)

### Заблокированные / замедленные сервисы

| Сервис | Статус | Тип блокировки | Приоритет |
|--------|--------|----------------|-----------|
| YouTube | Замедление CDN (googlevideo.com) | DPI-based throttling видеопотока | Критичный |
| Discord | Полная блокировка (голос и текст) | DNS + IP block, voice UDP 50000-50100 | Критичный |
| Instagram | Полная блокировка | DNS + IP block | Высокий |
| Facebook | Полная блокировка | DNS + IP block | Высокий |
| Twitter/X | Полная блокировка | DNS + IP block | Высокий |
| Telegram | Частично работает (прямое подключение нестабильно) | DNS poisoning, IP block | Высокий |
| LinkedIn | Полная блокировка | DNS + IP block | Средний |
| AI-сервисы (ChatGPT, Claude, Gemini) | Блокировка по гео-IP на стороне сервисов + блокировка РКН | DNS + geo-restriction | Высокий |
| Торрент-трекеры | Блокировка сайтов-трекеров | DNS block | Средний |
| VPN-протоколы | Активная блокировка (WireGuard, OpenVPN) | DPI + protocol fingerprinting | Критичный |
| Adult-сайты (PornHub, Stripchat и др.) | Полная блокировка | DNS + IP block | Средний |
| Независимые СМИ (Meduza, Novaya Gazeta, TVRain) | Полная блокировка | DNS + IP block | Низкий-Средний |
| Аниме-сайты (AnimeGo, Anilibria) | Блокировка по решению правообладателей | DNS block | Низкий |

### Методы блокировок РКН

1. **DNS Poisoning** — подмена DNS-ответов на уровне ISP
2. **IP-блокировка** — блокировка по IP-адресам через ТСПУ (DPI-оборудование)
3. **DPI-throttling** — замедление определённых протоколов (YouTube, QUIC)
4. **SNI filtering** — анализ Server Name Indication в TLS handshake
5. **Protocol fingerprinting** — определение VPN-протоколов (WireGuard, OpenVPN)
6. **ECH blocking** — блокировка Encrypted Client Hello для предотвращения маскировки SNI

---

## 2. Экосистема списков блокировок для mihomo

### 2.1. antifilter.download

**Описание:** Один из старейших и наиболее известных проектов для обхода блокировок РКН.

**Доступные списки:**
- `community.lst` — community-maintained список заблокированных доменов
- `ipsum.lst` — IP-адреса заблокированных ресурсов (из выгрузки РКН)
- Форматы: plaintext (домены/IP, один на строку), совместимы с различными инструментами
- Обновление: регулярное (обычно несколько раз в сутки)

**URL:** `https://antifilter.download/`

**Применимость для mihomo:** Напрямую не в MRS-формате. Требуется конвертация или использование через community-обёртки (legiz-ru).

**Статус в текущем конфиге:** Не используется напрямую. Используются производные через legiz-ru/mihomo-rule-sets.

---

### 2.2. re:filter (Реакция на блокировки)

**Описание:** Проект, ориентированный на обход блокировок с учётом ECH (Encrypted Client Hello). Предоставляет раздельные списки для доменов с поддержкой ECH и без.

**Доступные списки (через legiz-ru/mihomo-rule-sets):**

| Файл | Формат | Описание |
|------|--------|----------|
| `re-filter/re-filter-ech.mrs` | MRS (domain) | Домены, поддерживающие ECH — можно маршрутизировать DIRECT, т.к. SNI скрыт |
| `re-filter/re-filter-noech.mrs` | MRS (domain) | Домены без ECH — требуют проксирования |
| `re-filter/ip-rule.mrs` | MRS (ipcidr) | IP-адреса заблокированных ресурсов |
| `re-filter/domain-rule.mrs` | MRS (domain) | Полный объединённый список доменов |

**Логика ECH:**
- Домены с ECH (`re-filter-ech.mrs`): могут идти DIRECT, т.к. SNI зашифрован и DPI не видит, какой именно сайт запрашивается
- Домены без ECH (`re-filter-noech.mrs`): должны идти через прокси, т.к. DPI видит SNI
- Текущая реализация в конфиге: `refilter_ech` -> DIRECT, `refilter_noech` -> ECH-Refilter (выбор VPN/DIRECT)

**Статус в текущем конфиге:** Используется (rule-providers: `refilter_domains`, `refilter_ech`, `refilter_noech`, `refilter_ipsum`). Есть дублирование — `refilter_ipsum` используется и в секции "Комьюнити", и в секции "ECH-Refilter".

---

### 2.3. legiz-ru/mihomo-rule-sets (основной community-репозиторий)

**URL:** `https://github.com/legiz-ru/mihomo-rule-sets`

**Описание:** Ключевой community-репозиторий с rule-sets специально для mihomo в MRS-формате. Агрегирует данные из antifilter, re:filter и собственные списки.

**Структура:**

| Категория | Файлы | Формат | Назначение |
|-----------|-------|--------|------------|
| **re-filter/** | `re-filter-ech.mrs`, `re-filter-noech.mrs`, `ip-rule.mrs`, `domain-rule.mrs` | MRS | Обход блокировок с учётом ECH |
| **ru-bundle/** | `rule.mrs` | MRS (domain) | Агрегированный список российских заблокированных доменов |
| **oisd/** | `big.mrs`, `small.mrs`, `nsfw.mrs`, `nsfw_small.mrs` | MRS (domain) | Блокировка рекламы/трекеров (OISD конвертированный в MRS) |
| **other/** | `discord-voice-ip-list.mrs` | MRS (ipcidr) | Discord voice IP ranges |
| **other/** | `torrent-clients.yaml`, `torrent-trackers.mrs`, `torrent-websites.mrs` | YAML/MRS | Торрент-клиенты, трекеры, сайты |
| **other/** | `games-direct.yaml` | YAML | Игровые сервера (direct-маршрутизация) |
| **other/** | `ru-app-list.yaml` | YAML | Российские приложения |

**Статус в текущем конфиге:** Активно используется — 14 rule-providers ссылаются на этот репозиторий.

---

### 2.4. itdoginfo/allow-domains

**URL:** `https://github.com/itdoginfo/allow-domains`

**Описание:** Списки доменов, разделённые на "внутри России" и "снаружи России". Помогает определить, какие домены доступны из РФ напрямую, а какие — нет.

**Файлы:**
| Файл | Формат | Назначение |
|------|--------|------------|
| `Russia/inside-clashx.lst` | text (classical) | Домены, доступные внутри РФ — идут DIRECT |
| `Russia/outside-clashx.lst` | text (classical) | Домены, заблокированные в РФ — требуют прокси |

**Статус в текущем конфиге:** Используется (`ru-inside`, `ru-outside`).

---

### 2.5. OMchik33/custom-rules

**URL:** `https://github.com/OMchik33/custom-rules`

**Описание:** Пользовательские правила для mihomo, фокус на игровых серверах.

**Файлы:**
| Файл | Формат | Назначение |
|------|--------|------------|
| `mihomo/gaming-ips.yaml` | YAML (ipcidr) | IP-адреса игровых серверов |
| `mihomo/gaming-domains.yaml` | YAML (domain) | Домены игровых платформ (Steam и др.) |

**Статус в текущем конфиге:** Используется (`gaming-ips`, `steam-domain`).

---

### 2.6. Anton111111/rule-lists

**URL:** `https://github.com/Anton111111/rule-lists`

**Описание:** Структурированные списки IP-адресов CDN-провайдеров и сервисов. Фиксированные релизы (tagged releases).

**Файлы (release: lists-20251102):**

| Категория | Файлы | Назначение |
|-----------|-------|------------|
| CDN/Cloud IPs | `akamai_ips`, `amazon_ips`, `cdn77_ips`, `cloudflare_ips`, `digitalocean_ips`, `fastly_ips`, `google_ips`, `hetzner_ips`, `mega_ips`, `meta_ips`, `oracle_ips`, `ovh_ips`, `vultr_ips` | IP-сети облачных провайдеров |
| Сервисы | `discord_ips`, `telegram_ips`, `youtube.list`, `youtube_ips`, `ru_ips` | Сервис-специфичные IP/домены |
| Тематические | `other.list`, `politic.list` | Прочие и политические домены |

**Проблема:** Используют фиксированный тег релиза (`lists-20251102-014123-835e3fe`). При обновлении репозитория URL сломается. Нужно следить за новыми релизами вручную.

**Статус в текущем конфиге:** Активно используется — 17 rule-providers.

---

### 2.7. MetaCubeX/meta-rules-dat

**URL:** `https://github.com/MetaCubeX/meta-rules-dat`

**Описание:** Официальные GeoSite/GeoIP rule-sets для mihomo в MRS-формате. Основной источник правил по сервисам.

**Используемые категории:**

| Тип | Категории |
|-----|-----------|
| GeoSite (domain) | category-ru, category-gov-ru, youtube, telegram, discord, cloudflare, openai, anthropic, google-gemini, spotify, netflix, tidal, instagram, facebook, twitter, tiktok, linkedin, steam, github, microsoft, google, google-play, intel, logitech, cdn77, amazon, whatsapp, speedtest, ookla-speedtest, category-anticensorship, category-remote-control, drweb, category-porn, mailru, yandex, private |
| GeoIP (ipcidr) | ru, by, private, telegram, cloudflare |

**Формат:** MRS (Meta Rules Set) — бинарный формат mihomo для быстрой загрузки.

**Статус в текущем конфиге:** Основной источник — 20+ rule-providers.

---

### 2.8. zxc-rv/ad-filter (Hagezi Pro)

**URL:** `https://github.com/zxc-rv/ad-filter`

**Описание:** Адблок-список в MRS-формате, предположительно основанный на Hagezi Pro.

**Статус в текущем конфиге:** Подключён как `hagezi_pro`, но не видно ссылки в секции `rules`. Возможно, неиспользуемый provider.

---

## 3. MRS-формат: специфика для mihomo

**MRS (Meta Rules Set)** — бинарный формат правил, специфичный для mihomo (Clash Meta).

**Преимущества:**
- Компактный размер (в 3-10x меньше YAML/text)
- Быстрая загрузка и парсинг
- Встроенная поддержка в mihomo без конвертации
- Поддержка behaviors: `domain`, `ipcidr`, `classical`

**Ограничения:**
- Не human-readable (нельзя проверить содержимое без декодирования)
- Не все community-источники предоставляют MRS напрямую
- Конвертация из text/YAML в MRS требует утилиту mihomo

**Текущее покрытие MRS в конфиге:**
- MetaCubeX: все GeoSite/GeoIP — MRS
- legiz-ru: re-filter, ru-bundle, oisd, торренты — MRS
- Anton111111: text-формат (не MRS)
- itdoginfo: text-формат (не MRS)
- OMchik33: YAML-формат (не MRS)

---

## 4. Категоризация фич

### 4.1. TABLE STAKES (must-have для работающего прокси в РФ)

> Без этих фич конфиг не выполняет свою основную задачу.

#### TS-1: Обход блокировки YouTube
- **Что:** Маршрутизация всего трафика YouTube (включая googlevideo.com CDN) через прокси
- **Источники:** MetaCubeX/youtube.mrs, Anton111111/youtube.list + youtube_ips.list
- **Текущий статус:** Работает, но с массивным дублированием (GEOSITE + RULE-SET + 17 inline DOMAIN-SUFFIX)
- **Зависимости:** Прокси-сервер с достаточной полосой для видеопотока

#### TS-2: Обход блокировки Discord (текст + голос)
- **Что:** Маршрутизация текстового трафика Discord + UDP voice (порты 50000-50100) через прокси
- **Источники:** MetaCubeX/discord.mrs, legiz-ru/discord-voice-ip-list.mrs, Anton111111/discord_ips.list
- **Текущий статус:** Работает, но 4+ дублирующихся определения (discord, discord_vc, discord_voiceips, discord_ips, discord_domains + inline rules)
- **Зависимости:** Прокси с поддержкой UDP

#### TS-3: Обход блокировки Instagram/Facebook/Twitter
- **Что:** Полная маршрутизация через прокси
- **Источники:** MetaCubeX GeoSite (instagram, facebook, twitter)
- **Текущий статус:** Работает через GEOSITE
- **Зависимости:** Нет

#### TS-4: Доступ к AI-сервисам (ChatGPT, Claude, Gemini, etc.)
- **Что:** Маршрутизация через прокси с зарубежным IP (сервисы блокируют российские IP)
- **Источники:** MetaCubeX/category-ai-!cn.mrs, inline github-ai list, MetaCubeX/google-gemini.mrs
- **Текущий статус:** Работает, большой inline-список + GEOSITE + RULE-SET
- **Зависимости:** Прокси в стране, поддерживаемой AI-сервисами (не RU, не CN)

#### TS-5: Обход блокировки Telegram
- **Что:** Маршрутизация доменов + IP Telegram через прокси
- **Источники:** MetaCubeX/telegram.mrs (domain + IP), Anton111111/telegram_ips.list
- **Текущий статус:** Работает, но 8+ дублирующихся определений
- **Зависимости:** Нет

#### TS-6: Прямая маршрутизация российского трафика
- **Что:** Российские сайты (.ru, .su, .by, Yandex, VK, Avito, etc.) идут DIRECT
- **Источники:** MetaCubeX/category-ru.mrs + geoip-ru.mrs, itdoginfo/inside-clashx.lst, inline ru-inline
- **Текущий статус:** Работает. Большой набор inline-правил + GEOSITE + GEOIP
- **Зависимости:** Актуальные GeoIP/GeoSite данные

#### TS-7: Блокировка рекламы и трекеров
- **Что:** DNS-level блокировка рекламных/трекерных доменов
- **Источники:** legiz-ru/oisd (big.mrs, small.mrs)
- **Текущий статус:** Работает, но одновременно big + small (дублирование)
- **Зависимости:** Нет

#### TS-8: Защита локальной сети
- **Что:** Приватные IP (192.168.x.x, 10.x.x.x, 172.16.x.x) идут DIRECT
- **Источники:** Inline IP-CIDR + MetaCubeX/geosite-private + geoip-private
- **Текущий статус:** Работает
- **Зависимости:** Нет

---

### 4.2. DIFFERENTIATORS (quality of life, продвинутые фичи)

> Улучшают качество работы, но конфиг функционален и без них.

#### D-1: ECH-aware маршрутизация (re:filter)
- **Что:** Разделение заблокированных доменов на ECH/noECH. ECH-домены могут идти DIRECT (экономия прокси-трафика), noECH — через прокси
- **Источники:** legiz-ru/re-filter (re-filter-ech.mrs, re-filter-noech.mrs)
- **Текущий статус:** Реализовано, но с дублированием `refilter_ipsum` в двух секциях
- **Ценность:** Экономия трафика на прокси, снижение нагрузки на сервер
- **Зависимости:** TS-1..TS-5 (основные блокировки), актуальность ECH-списков

#### D-2: Consolidated ru-bundle
- **Что:** Единый агрегированный список заблокированных доменов вместо нескольких мелких
- **Источники:** legiz-ru/ru-bundle/rule.mrs
- **Текущий статус:** Используется, но конфликтует с `refilter_domains` (оба маршрутизируют в "Комьюнити")
- **Ценность:** Удобство — один provider вместо разрозненных списков
- **Зависимости:** Нет

#### D-3: CDN/Cloud IP routing по провайдерам
- **Что:** IP-сети CDN (Cloudflare, Amazon, Google, etc.) маршрутизируются в выделенные группы
- **Источники:** Anton111111/rule-lists (13 IP-списков по провайдерам)
- **Текущий статус:** Реализовано
- **Ценность:** Гранулярный контроль — можно для разных CDN выбрать разные прокси или DIRECT
- **Зависимости:** Актуальность IP-списков (фиксированный тег релиза!)
- **Риск:** Фиксированные URL-ы Anton111111 (tag-based releases), устареют при обновлении

#### D-4: Сервис-специфичные proxy-groups
- **Что:** Отдельные select-группы для YouTube, Discord, Telegram, etc. с возможностью выбора конкретного прокси или DIRECT
- **Текущий статус:** Реализовано (30+ proxy-groups)
- **Ценность:** Гибкость — можно переключить конкретный сервис между прокси и DIRECT
- **Зависимости:** Dashboard (Zashboard) для удобного переключения

#### D-5: Торрент-маршрутизация (клиенты, трекеры, сайты)
- **Что:** Торрент-клиенты и трекеры → DIRECT, торрент-сайты → VPN
- **Источники:** legiz-ru (torrent-clients.yaml, torrent-trackers.mrs, torrent-websites.mrs)
- **Текущий статус:** Реализовано, есть дублирование (правила торрентов определены дважды: строки 1338 и 1611)
- **Ценность:** Торренты не тратят прокси-трафик, но сайты-трекеры разблокированы
- **Зависимости:** Нет

#### D-6: Gaming-правила (Steam, Tarkov, OSU, etc.)
- **Что:** Специфические правила для игровых серверов с возможностью DIRECT/VPN
- **Источники:** OMchik33/gaming-ips + gaming-domains, legiz-ru/games-direct
- **Текущий статус:** Реализовано, но с избыточными группами (OSU, Tarkov, Steam, Игровые Сервера)
- **Ценность:** Минимальная латентность для игр (DIRECT где возможно)
- **Зависимости:** Нет

#### D-7: NSFW-контент изоляция (adult content isolation)
- **Что:** Весь adult-контент в отдельных маркированных блоках для автоудаления в work-конфиге
- **Текущий статус:** ЧАСТИЧНО. Adult-контент разбросан по 4+ секциям:
  - Proxy-groups: Sin, ST, CB, BG, BGP (строки 461-505)
  - Rule-providers: Sin_in, ST_in, BG_in, BGP_in, CB_in (строки 611-660)
  - Inline rules: 18 правил (строки 1295-1321)
  - "Other" категория: OnlyFans, Fansly, PornHub, hanime1, e-hentai, rule34 (строки 1486-1521)
  - category-porn RULE-SET (строка 1532)
- **Целевое состояние:** Все adult-правила между маркерами `# >>> ADULT` и `# <<< ADULT`
- **Ценность:** Критично для work-конфига — ноль следов adult-контента
- **Зависимости:** Скрипт генерации конфигов (TS-скрипт)

#### D-8: QUIC-блокировка
- **Что:** Блокировка QUIC-протокола (UDP/443) для форсирования TCP, чтобы DPI-throttling YouTube не применялся к QUIC
- **Текущий статус:** Реализовано (proxy-group QUIC -> REJECT по умолчанию)
- **Ценность:** Обход замедления YouTube через QUIC
- **Зависимости:** Нет

#### D-9: Скрипт генерации personal/work конфигов
- **Что:** Автоматическая генерация двух конфигов из одного базового
- **Текущий статус:** Не реализовано (запланировано)
- **Ценность:** Безопасный work-конфиг без ручного редактирования
- **Зависимости:** D-7 (изоляция adult-контента маркерами)

#### D-10: Единообразное именование proxy-groups
- **Что:** Конвенция emoji + полное имя для всех групп
- **Текущий статус:** Не реализовано — текущие имена: смесь emoji (VPN), без emoji (Discord), кириллица (RU трафик), аббревиатуры (ST, CB, BG)
- **Ценность:** Читаемость dashboard, меньше путаницы
- **Зависимости:** Нет

#### D-11: Независимые СМИ и anticensorship
- **Что:** Доступ к заблокированным медиа (Novaya Gazeta, TVRain, The Village, etc.)
- **Источники:** MetaCubeX/category-anticensorship, inline ru-inline-banned
- **Текущий статус:** Реализовано
- **Ценность:** Информационный доступ
- **Зависимости:** Нет

#### D-12: Remote control сервисы (VPN, TeamViewer, AnyDesk)
- **Что:** Маршрутизация удалённого доступа в отдельную группу
- **Источники:** MetaCubeX/category-remote-control.mrs, PROCESS-NAME regex
- **Текущий статус:** Реализовано
- **Ценность:** Контроль over VPN/remote traffic
- **Зависимости:** Нет

---

### 4.3. ANTI-FEATURES (сознательно НЕ делать)

> Вещи, которые кажутся полезными, но создают больше проблем, чем решают.

#### AF-1: Полный tunnel (все через прокси)
- **Почему нет:** Огромный расход трафика, замедление всего, нагрузка на прокси-сервер, российские сайты будут работать хуже или не работать (гео-блокировка с российской стороны)
- **Вместо этого:** Rule-based routing — только заблокированный трафик через прокси

#### AF-2: Встроенный DNS-over-HTTPS в mihomo
- **Почему нет:** DNS обрабатывается роутером Keenetic. Двойная обработка DNS создаёт конфликты, увеличивает латентность
- **Вместо этого:** Sniffer с force-dns-mapping перехватывает и корректирует DNS

#### AF-3: Множество мелких proxy-groups для каждого сайта
- **Почему нет:** 30+ групп уже избыточно. Каждая новая группа — это UI-клаттер в Dashboard
- **Вместо этого:** Консолидация в логические категории (Streaming, Social, AI, Gaming, Adult)
- **Текущая проблема:** OSU, Tarkov, intel, NAS, Logitech — слишком мелкие группы

#### AF-4: OISD big + small одновременно
- **Почему нет:** OISD big является надмножеством small. Загрузка обоих — двойной расход памяти и сети без пользы
- **Вместо этого:** Только один — big (максимальное покрытие) или small (базовое покрытие)

#### AF-5: Дублирование правил в inline + RULE-SET + GEOSITE
- **Почему нет:** Первое совпавшее правило побеждает, остальные — мертвый код. Увеличивает размер конфига и время обработки
- **Вместо этого:** Один метод на сервис. Приоритет: RULE-SET (MRS) > GEOSITE > inline

#### AF-6: Фиксированные tag-based URL для rule providers
- **Почему нет:** URL типа `lists-20251102-014123-835e3fe` устареет без уведомления
- **Вместо этого:** Использовать `latest` releases или `main` branch URLs где возможно

#### AF-7: Inline правила для adult-контента (DOMAIN-REGEX + DOMAIN-SUFFIX + RULE-SET)
- **Почему нет:** Тройное определение одних и тех же сайтов. Усложняет изоляцию для work-конфига
- **Вместо этого:** Один RULE-SET на adult-категорию, маркированный для автоудаления

#### AF-8: Автоматическое обновление конфига на роутере
- **Почему нет:** Сломанный конфиг = нет интернета на роутере = нет удалённого доступа для починки
- **Вместо этого:** Ручное обновление с проверкой перед деплоем

#### AF-9: OISD NSFW big + small одновременно
- **Почему нет:** Та же проблема, что AF-4 — big содержит small
- **Вместо этого:** Один из двух

---

## 5. Зависимости между фичами

```
TS-6 (RU DIRECT) ──────────┐
TS-1 (YouTube) ─────────────┤
TS-2 (Discord) ─────────────┤
TS-3 (Instagram/FB/Twitter) ┼─── Базовое проксирование (прокси-сервер + subscription)
TS-4 (AI-сервисы) ──────────┤
TS-5 (Telegram) ────────────┘

D-1 (ECH-aware) ──────────── Зависит от TS-1..TS-5 + актуальность re:filter списков
D-2 (ru-bundle) ──────────── Может заменить часть TS-6 inline-правил
D-7 (Adult isolation) ────── Предпосылка для D-9 (скрипт генерации)
D-9 (Скрипт генерации) ──── Зависит от D-7 (маркеры) + D-10 (единообразие)
D-10 (Именование) ────────── Независимая, но улучшает D-4 (сервис-группы)
```

---

## 6. Рекомендации по приоритизации рефакторинга

### Фаза 1: Устранение дублей и ошибок (низкий риск, высокая отдача)
1. Удалить дублирующиеся правила YouTube (17 DOMAIN-SUFFIX), Discord (4x), Telegram (8x), Cloudflare (17x)
2. Убрать OISD small (оставить big), OISD nsfw_small (оставить nsfw_big)
3. Исправить `DST-PORT,53,53` -> `DST-PORT,53,DIRECT`
4. Удалить дублирование torrent-правил (строки 1338 и 1611)
5. Удалить дублирование `refilter_ipsum` (используется в двух секциях)

### Фаза 2: Консолидация adult-контента (средний риск, критично для work-конфига)
1. Создать единый блок `# >>> ADULT` / `# <<< ADULT`
2. Перенести все adult proxy-groups (Sin, ST, CB, BG, BGP) в один блок
3. Перенести все adult rule-providers (Sin_in, ST_in, BG_in, BGP_in, CB_in, category-porn) в один блок
4. Перенести inline adult-правила в один блок
5. Консолидировать OnlyFans/Fansly/PornHub/hanime1/e-hentai/rule34 из "Other" в adult-блок

### Фаза 3: Структурный рефакторинг (средний риск, долгосрочная поддержка)
1. Единообразное именование proxy-groups (emoji + полное имя)
2. Консолидация мелких групп (OSU, intel, NAS, Logitech -> можно объединить)
3. Стратегия "один RULE-SET на сервис" вместо inline + GEOSITE + RULE-SET
4. Логичный порядок правил (по приоритету: QUIC block -> adult -> services -> RU -> community -> private -> adblock -> MATCH)

### Фаза 4: Обновление источников (высокий риск, требует тестирования)
1. Замена фиксированных URL Anton111111 на latest-compatible
2. Аудит неиспользуемых providers (hagezi_pro, gaming-ips и др.)
3. Оценка необходимости всех 13 CDN IP-списков

---

## 7. Источники и URLs

| Источник | URL | Статус |
|----------|-----|--------|
| legiz-ru/mihomo-rule-sets | `https://github.com/legiz-ru/mihomo-rule-sets` | Активный, основной |
| MetaCubeX/meta-rules-dat | `https://github.com/MetaCubeX/meta-rules-dat` | Активный, основной |
| Anton111111/rule-lists | `https://github.com/Anton111111/rule-lists` | Активный, фиксированные теги |
| itdoginfo/allow-domains | `https://github.com/itdoginfo/allow-domains` | Активный |
| OMchik33/custom-rules | `https://github.com/OMchik33/custom-rules` | Активный |
| antifilter.download | `https://antifilter.download` | Активный, не MRS |
| zxc-rv/ad-filter | `https://github.com/zxc-rv/ad-filter` | Активный |
| v2fly/domain-list-community | `https://github.com/v2fly/domain-list-community` | Активный |
| Zephyruso/zashboard | `https://github.com/Zephyruso/zashboard` | Активный (UI) |

---

## 8. Резюме для downstream (requirements definition)

**Ключевые выводы:**

1. **Текущий конфиг функционален** — все table stakes реализованы, но с техническим долгом (массивное дублирование)
2. **Adult-изоляция — главный блокер** для work-конфига. Без неё скрипт генерации невозможен
3. **ECH-aware routing — главный differentiator** — экономит прокси-трафик, уникальная фича re:filter
4. **Дублирование правил — главная проблема** — 4x Discord, 17x YouTube DOMAIN-SUFFIX, 8x Telegram, 17x Cloudflare, 2x OISD, 2x torrent-rules
5. **Anton111111 URLs устареют** — фиксированные теги релизов, нужна стратегия обновления
6. **30+ proxy-groups избыточно** — многие можно консолидировать
7. **MRS — целевой формат** — все providers должны стремиться к MRS для производительности

---

*Исследование: 2026-02-25*
*Источники: анализ config.yaml (~1672 строк), CONCERNS.md, INTEGRATIONS.md, STACK.md*
*Веб-верификация URL: не выполнена (ограничение инструментов), URLs взяты из конфига*
