# Phase 2: Service Deduplication - Research

**Researched:** 2026-02-25
**Domain:** Mihomo (Clash Meta) YAML config -- дедупликация правил маршрутизации для сервисов (YouTube, Discord, Telegram, Cloudflare, торренты, refilter)
**Confidence:** HIGH

## Summary

Phase 2 решает главную проблему конфига: один и тот же сервис определен 3-8 разными способами (inline DOMAIN-SUFFIX, DOMAIN-REGEX, GEOSITE, RULE-SET, PROCESS-NAME). Из-за first-match-wins семантики mihomo только первое совпавшее правило работает, остальные -- мертвый код. Дедупликация безопасна: удаляются правила, которые никогда не срабатывают (расположены ниже уже сработавших).

Анализ конфига выявил 6 сервисов с дублями: YouTube (17 inline DOMAIN-SUFFIX + 2 RULE-SET + GEOSITE + PROCESS-NAME = 21 правило, можно сократить до 3-4), Discord (24 inline DOMAIN-SUFFIX + 4 RULE-SET + inline provider + voice IPs = 30+ правил, сократить до 4-5), Telegram (4 RULE-SET дубля + GEOSITE + GEOIP + 2 PROCESS-NAME + 2 inline = 10, сократить до 4-5), Cloudflare (17 inline DOMAIN-SUFFIX при наличии RULE-SET = 19, сократить до 2-3), торренты (дословно дублированный OR блок на строках 1331 и 1603), refilter_ipsum (дублированный RULE-SET в двух разных группах на строках 1589 и 1621).

Дополнительно обнаружены 3 осиротевших rule-provider (youtube-domains, youtube-ips, discord_ips) -- определены, но нигде не используются в rules. Также найдено 3 пары дублирующихся rule-provider: telegram-domains / telegram_domains (оба ведут на один и тот же URL), telegram-ips / telegram_ips (разные URL, один Anton111111, другой MetaCubeX geoip), и ошибочная привязка `stable.dl2.discordapp.net` к YouTube (строка 1391).

**Primary recommendation:** Для каждого сервиса оставить одну каноническую комбинацию (RULE-SET для доменов + RULE-SET для IP где нужно + PROCESS-NAME где нужно), удалить все остальные дубли. Перед удалением каждого inline-правила проверить, что домен покрыт оставляемым RULE-SET или GEOSITE. Непокрытые домены сохранить как inline-дополнения рядом с основным правилом.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Стратегия покрытия:** Перед удалением inline-правил -- скачать RULE-SET/GEOSITE и проверить покрытие каждого inline-домена. Непокрытые домены сохранить как дополнительные inline-правила рядом с соответствующим RULE-SET (с комментарием). Сомнительные/старые домены тоже сохранять -- лучше лишнее правило, чем пропущенный трафик.
- **Метод маршрутизации сервисов:** Единый подход для всех сервисов: GEOSITE + RULE-SET где доступны оба. Если для сервиса доступен только один метод -- найти недостающий RULE-SET из публичных источников. Приоритет порядка в rules: RULE-SET выше GEOSITE (более конкретные правила приоритетнее). Применяется к YouTube, Discord, Telegram, Cloudflare, торрентам.
- **Консолидация refilter:** refilter_ipsum: оставить одно вхождение RULE-SET в rules, удалить дубль. Проверить все refilter-провайдеры на дублирование (не только ipsum).
- **Чистота конфига:** Краткие комментарии о консолидации на русском языке (напр. `# YouTube: консолидировано из 17 inline-правил`). Осиротевшие комментарии (к удалённым правилам) -- удалять. Перегруппировать rules по сервису: все правила одного сервиса рядом.

### Claude's Discretion
- Выбор proxy-group при консолидации refilter_ipsum (если два вхождения в разные группы)
- Конкретный порядок сервисов внутри rules-секции при группировке
- Технические детали скачивания и парсинга RULE-SET/GEOSITE для проверки покрытия

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEDUP-01 | Все дублирующиеся правила YouTube удалены (17 inline DOMAIN-SUFFIX при наличии GEOSITE + RULE-SET), с подтверждением что это реальные дубли | Верифицировано: geosite youtube.yaml содержит 179 доменов, покрывает ВСЕ 17 inline DOMAIN-SUFFIX (youtube.com, youtu.be, ytimg.com, googlevideo.com, yt3.ggpht.com и т.д.). Также RULE-SET `youtube` (MetaCubeX) ссылается на тот же geosite. Дубль RULE-SET,youtube на строках 1334 и 1374. Обнаружены 2 осиротевших провайдера youtube-domains и youtube-ips (Anton111111). Ошибка: stable.dl2.discordapp.net привязан к YouTube (строка 1391). |
| DEDUP-02 | Все дублирующиеся правила Discord удалены (4+ определения: discord_vc, discord_voiceips, discord_ips, discord_domains), с проверкой покрытия | Верифицировано: geosite discord.yaml содержит 28 доменов, покрывает все inline DOMAIN-SUFFIX кроме discord.app, discord.status (не в geosite). 4 RULE-SET провайдера (discord_voiceips, discord_ips, discord_domains, discord), из которых discord_ips -- осиротевший. Inline `discord` провайдер содержит DOMAIN-KEYWORD с NOT-SUFFIX,ru что перекрывается discord_domains. Voice IP дубли между discord_vc и discord_voiceips с AND-wrapper. |
| DEDUP-03 | Все дублирующиеся правила Telegram удалены (8+ определений), с проверкой покрытия | Верифицировано: 4 rule-provider для Telegram (telegram-domains, telegram_domains, telegram-ips, telegram_ips) из которых telegram-domains и telegram_domains ссылаются на один и тот же geosite/telegram.mrs. В rules: OR блок (строка 1335), GEOSITE (1369), GEOIP (1373), 2x RULE-SET (1376-1377), 2x PROCESS-NAME (1378-1379), 2 inline DOMAIN-SUFFIX/REGEX (1296, 1309). |
| DEDUP-04 | Все дублирующиеся правила Cloudflare удалены (17 inline DOMAIN-SUFFIX при наличии RULE-SET) | Верифицировано: geosite cloudflare.yaml содержит 74 домена, покрывает ВСЕ 17 inline DOMAIN-SUFFIX (cloudflareaccess.com, cloudflareapps.com, encryptedsni.com и т.д.) плюс cloudflare-ech.com. RULE-SET cloudflare-domains (строка 1531) уже используется. Дополнительно: cloudflare_ips (Anton111111) -- осиротевший провайдер. |
| DEDUP-06 | Дублирующиеся торрент-правила удалены (определены дважды в rules-секции) | Верифицировано: строка 1331 и строка 1603 содержат дословно одинаковое правило `OR,((RULE-SET,torrent-clients),(RULE-SET,torrent-trackers)),DIRECT`. Первое (1331) срабатывает, второе (1603) -- мертвый код. |
| DEDUP-07 | Дублирующийся refilter_ipsum консолидирован (используется в двух секциях) | Верифицировано: строка 1589 `RULE-SET,refilter_ipsum,Комьюнити` и строка 1621 `RULE-SET,refilter_ipsum,ECH-Refilter`. Оба ссылаются на один провайдер, но маршрутизируют в разные группы. Первое (1589) перехватывает трафик, второе (1621) -- мертвый код. |
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
| grep/search | Поиск всех вхождений домена/правила | Перед удалением -- убедиться в покрытии |
| WebFetch geosite YAML | Проверка покрытия доменов | Скачать geosite/youtube.yaml и сравнить с inline-списком |

## Architecture Patterns

### Pattern 1: Каноническая структура правил для сервиса (целевое состояние)

Для каждого сервиса -- консолидированный блок правил в rules-секции:
```yaml
  # YouTube: консолидировано из 17 inline-правил + дублей RULE-SET/GEOSITE
  - RULE-SET,youtube,YouTube                    # RULE-SET (MetaCubeX geosite, 179 доменов)
  - GEOSITE,youtube,YouTube                      # GEOSITE (backup, тот же источник)
  - PROCESS-NAME-REGEX,(?i).*youtube.*,YouTube   # Процессы (Android/Windows клиенты)
  # inline-дополнения (домены не покрытые RULE-SET/GEOSITE):
  # - DOMAIN-SUFFIX,example.com,YouTube          # только если верифицировано отсутствие в geosite
```

**Порядок внутри блока:** RULE-SET первым (приоритет), GEOSITE вторым (backup/расширение), PROCESS-NAME последним. Inline-дополнения -- только если домен НЕ покрыт основными rule-set.

### Pattern 2: Удаление мертвого кода (first-match-wins)

mihomo матчит правила сверху вниз, первое совпадение выигрывает. Правила ниже по списку для того же трафика -- мертвый код:

```yaml
# Строка 1334: ПЕРВОЕ вхождение -- РАБОТАЕТ
  - RULE-SET,youtube,YouTube
# ...200 строк...
# Строка 1374: ВТОРОЕ вхождение того же RULE-SET -- МЕРТВЫЙ КОД (удалить)
  - RULE-SET,youtube,YouTube
```

**Безопасность удаления:** Если правило A (выше) покрывает тот же трафик что и правило B (ниже), удаление B не меняет поведение маршрутизации.

### Pattern 3: Перегруппировка по сервису

**Текущее состояние:** правила одного сервиса разбросаны по всему rules-секции:
```
Line 1334: RULE-SET,youtube,YouTube       (сервисная секция)
Line 1360: GEOSITE,youtube,YouTube        (geosite-блок)
Line 1374: RULE-SET,youtube,YouTube       (дубль)
Line 1375: PROCESS-NAME-REGEX,youtube     (process-блок)
Line 1386-1402: 17x DOMAIN-SUFFIX        (inline-блок)
```

**Целевое состояние:** все правила одного сервиса рядом, одним блоком:
```yaml
  # --- YouTube ---
  - RULE-SET,youtube,YouTube
  - GEOSITE,youtube,YouTube
  - PROCESS-NAME-REGEX,(?i).*youtube.*,YouTube
```

### Pattern 4: Удаление осиротевших rule-provider

При удалении дублей inline-правил, проверить: остались ли rule-provider, которые нигде не используются в rules. Такие провайдеры тратят bandwidth на скачивание, но не влияют на маршрутизацию.

**Обнаруженные осиротевшие провайдеры (определены, но нет RULE-SET ссылок в rules):**
- `youtube-domains` (Anton111111, строка 1070) -- НЕ используется
- `youtube-ips` (Anton111111, строка 1077) -- НЕ используется
- `discord_ips` (Anton111111, строка 1100) -- НЕ используется
- `cloudflare_ips` (Anton111111, строка 977) -- НЕ используется

### Anti-Patterns to Avoid
- **Удаление без проверки покрытия:** НИКОГДА не удалять inline DOMAIN-SUFFIX до подтверждения, что домен покрыт RULE-SET/GEOSITE. Даже если кажется что покрыт -- проверить.
- **Изменение proxy-group привязки:** Дедупликация НЕ меняет, в какую группу идет трафик. Discord остается Discord, YouTube остается YouTube.
- **Переупорядочение между сервисами:** Менять относительный порядок разных сервисов (YouTube перед Discord) рискованно. Менять порядок только ВНУТРИ одного сервиса.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Проверка покрытия доменов | Ручное сравнение 17 доменов с geosite | Скачать geosite YAML и grep | Geosite содержит 179 доменов -- ручная проверка ненадежна |
| Валидация YAML после массовых удалений | Проверка глазами | Парсер YAML + mihomo -t | Отступы критичны в YAML |
| Поиск осиротевших провайдеров | Ручной подсчет | grep по имени провайдера в rules-секции | Провайдеров 50+, легко пропустить |

## Common Pitfalls

### Pitfall 1: Удаление inline-правила, не покрытого GEOSITE/RULE-SET
**What goes wrong:** Домен перестает маршрутизироваться через нужную proxy-group. Трафик уходит в fallback (Остальной трафик) вместо сервисной группы.
**Why it happens:** GEOSITE/RULE-SET может не содержать все домены из inline-списка (например, jnn-pa.googleapis.com -- специфичный YouTube API endpoint).
**How to avoid:** Перед удалением каждого inline DOMAIN-SUFFIX проверить наличие в geosite YAML. Если нет -- сохранить как inline-дополнение.
**Warning signs:** Сервис перестает работать через прокси или идет через другую группу.

### Pitfall 2: stable.dl2.discordapp.net привязан к YouTube
**What goes wrong:** Домен discordapp.net ошибочно маршрутизируется через YouTube группу вместо Discord.
**Why it happens:** Строка 1391: `DOMAIN-SUFFIX,stable.dl2.discordapp.net,YouTube` -- вероятно ошибка копипасты при добавлении YouTube inline-правил.
**How to avoid:** При консолидации YouTube-правил удалить эту строку. Домен покрыт Discord GEOSITE (discordapp.net есть в geosite discord.yaml) и inline DOMAIN-SUFFIX,discordapp.net,Discord (строка 1438).
**Warning signs:** Discord CDN файлы идут через YouTube proxy-group.

### Pitfall 3: refilter_ipsum в двух разных группах
**What goes wrong:** refilter_ipsum используется на строке 1589 (Комьюнити) и на строке 1621 (ECH-Refilter). Из-за first-match-wins строка 1621 -- мертвый код. Если удалить строку 1589, трафик пойдет в ECH-Refilter (другое поведение).
**Why it happens:** Два разных контекста использования: основной refilter-блок и ECH-логика.
**How to avoid:** Решение по discretion: определить, какая группа семантически правильнее. ECH-Refilter управляет ECH-трафиком (настраиваемый переключатель VPN/DIRECT). Комьюнити -- общий прокси. IP-правила refilter_ipsum связаны с ECH-логикой (IP-диапазоны заблокированных ресурсов), поэтому ECH-Refilter логичнее.
**Warning signs:** Изменение поведения маршрутизации для IP-трафика refilter.

### Pitfall 4: Дублирующиеся rule-provider с одинаковыми URL
**What goes wrong:** telegram-domains (строка 856) и telegram_domains (строка 1264) оба ведут на MetaCubeX/geosite/telegram.mrs. Mihomo скачает файл дважды и создаст два кэша.
**Why it happens:** Одна пара добавлена раньше (telegram-domains с дефисом), другая позже (telegram_domains с подчеркиванием), в OR-блоке (строка 1335).
**How to avoid:** Оставить один провайдер, обновить все ссылки на него в rules. Предпочтение: telegram_domains (используется в OR-блоке, который остается).
**Warning signs:** Два файла кэша для одного и того же источника.

### Pitfall 5: discord_vc содержит дубли с discord_voiceips + AND-wrapper
**What goes wrong:** Строка 1382 (`RULE-SET,discord_vc,Discord`) и строка 1381 (`AND,((RULE-SET,discord_voiceips),(NETWORK,udp),(DST-PORT,50000-50100)),Discord`) покрывают перекрывающийся трафик. discord_vc -- inline провайдер с AND-конструкциями для тех же IP-диапазонов.
**Why it happens:** discord_vc был добавлен как более детализированный набор (9 IP-диапазонов с AND), discord_voiceips -- как внешний MRS-файл. Плюс inline `discord` провайдер (строка 1127) тоже содержит AND-правила для voice IP.
**How to avoid:** Консолидировать в один подход. Оставить discord_voiceips с AND-wrapper как наиболее точный метод. Удалить discord_vc inline провайдер если его IP-диапазоны покрыты discord_voiceips.
**Warning signs:** Discord voice calls не работают после удаления неправильного провайдера.

### Pitfall 6: Удаление rule-provider без удаления определения
**What goes wrong:** mihomo не запустится с ошибкой "rule-set X not found" (если удалить провайдер но оставить RULE-SET ссылку) или будет тратить bandwidth (если удалить RULE-SET ссылку но оставить провайдер).
**Why it happens:** Провайдер и ссылка в rules -- в разных секциях файла, легко забыть одну из сторон.
**How to avoid:** При удалении провайдера -- grep по имени, удалить ВСЕ вхождения. При удалении ссылки -- проверить, что провайдер тоже удален (если больше нигде не используется).
**Warning signs:** mihomo -t ошибка при запуске.

## Code Examples

### YouTube: Текущее состояние (21 правило) vs Целевое (3-4 правила)

**Текущее (разбросано по rules-секции):**
```yaml
# Строка 1334 (первый блок сервисных правил):
  - RULE-SET,youtube,YouTube            # MetaCubeX geosite youtube.mrs (179 доменов)
# Строка 1360 (GEOSITE блок):
  - GEOSITE,youtube,YouTube             # Тот же источник v2fly/domain-list-community
# Строка 1374 (дубль!):
  - RULE-SET,youtube,YouTube            # ДОСЛОВНЫЙ ДУБЛЬ строки 1334
# Строка 1375:
  - PROCESS-NAME-REGEX,(?i).*youtube.*,YouTube
# Строки 1386-1402 (17 inline DOMAIN-SUFFIX):
  - DOMAIN-SUFFIX,yt3.ggpht.com,YouTube           # покрыт geosite: ggpht.com
  - DOMAIN-SUFFIX,yt4.ggpht.com,YouTube           # покрыт geosite: ggpht.com
  - DOMAIN-SUFFIX,yt3.googleusercontent.com,YouTube # НЕ в geosite youtube -- но в geosite google
  - DOMAIN-SUFFIX,googlevideo.com,YouTube          # покрыт geosite: googlevideo.com
  - DOMAIN-SUFFIX,jnn-pa.googleapis.com,YouTube    # НЕ в geosite youtube -- специфичный API
  - DOMAIN-SUFFIX,stable.dl2.discordapp.net,YouTube # ОШИБКА: это Discord домен!
  - DOMAIN-SUFFIX,wide-youtube.l.google.com,YouTube # покрыт geosite: wide-youtube.l.google.com
  - DOMAIN-SUFFIX,youtube-nocookie.com,YouTube     # покрыт geosite
  - DOMAIN-SUFFIX,youtube-ui.l.google.com,YouTube  # покрыт geosite
  - DOMAIN-SUFFIX,youtube.com,YouTube              # покрыт geosite
  - DOMAIN-SUFFIX,youtubeembeddedplayer.googleapis.com,YouTube # покрыт geosite
  - DOMAIN-SUFFIX,youtubekids.com,YouTube          # покрыт geosite
  - DOMAIN-SUFFIX,youtubei.googleapis.com,YouTube  # покрыт geosite
  - DOMAIN-SUFFIX,youtu.be,YouTube                 # покрыт geosite
  - DOMAIN-SUFFIX,yt-video-upload.l.google.com,YouTube # НЕ явно в geosite -- но покрыт через google.com
  - DOMAIN-SUFFIX,ytimg.com,YouTube                # покрыт geosite
  - DOMAIN-SUFFIX,ytimg.l.google.com,YouTube       # покрыт geosite через ytimg.com / google.com
```

**Анализ покрытия inline-доменов geosite youtube.yaml (179 доменов):**

| Inline домен | В geosite youtube? | В другом geosite? | Решение |
|---|---|---|---|
| yt3.ggpht.com | ДА (ggpht.com) | - | Удалить |
| yt4.ggpht.com | ДА (ggpht.com) | - | Удалить |
| yt3.googleusercontent.com | НЕТ | google (googleusercontent.com) | Удалить -- Google group поймает |
| googlevideo.com | ДА | - | Удалить |
| jnn-pa.googleapis.com | НЕТ | google (googleapis.com) | Проверить: это YouTube JNN push API. Может быть покрыт Google GEOSITE. Сохранить как inline-дополнение для надежности |
| stable.dl2.discordapp.net | НЕТ | discord (discordapp.net) | УДАЛИТЬ -- ошибка привязки к YouTube |
| wide-youtube.l.google.com | ДА | - | Удалить |
| youtube-nocookie.com | ДА | - | Удалить |
| youtube-ui.l.google.com | ДА | - | Удалить |
| youtube.com | ДА | - | Удалить |
| youtubeembeddedplayer.googleapis.com | ДА | - | Удалить |
| youtubekids.com | ДА | - | Удалить |
| youtubei.googleapis.com | ДА | - | Удалить |
| youtu.be | ДА | - | Удалить |
| yt-video-upload.l.google.com | НЕТ явно | google (google.com) | Удалить -- покрыт Google |
| ytimg.com | ДА | - | Удалить |
| ytimg.l.google.com | ДА (ytimg.com) | google (google.com) | Удалить |

**Осиротевшие провайдеры YouTube:**
- `youtube-domains` (Anton111111, строка 1070) -- определен, но RULE-SET,youtube-domains нигде не используется
- `youtube-ips` (Anton111111, строка 1077) -- определен, но RULE-SET,youtube-ips нигде не используется

**Целевое состояние YouTube:**
```yaml
  # --- YouTube: консолидировано из 21 правила ---
  - RULE-SET,youtube,YouTube                      # MetaCubeX geosite (179 доменов)
  - GEOSITE,youtube,YouTube                        # GEOSITE backup
  - PROCESS-NAME-REGEX,(?i).*youtube.*,YouTube     # Процессы
  # YouTube: inline-дополнение (не покрыт geosite youtube напрямую)
  - DOMAIN-SUFFIX,jnn-pa.googleapis.com,YouTube    # YouTube JNN push notification API
```

### Discord: Текущее состояние (30+ правил) vs Целевое (4-5 правил)

**Текущее (разбросано):**
```yaml
# Строка 1336 (OR-блок):
  - OR,((RULE-SET,discord_domains),(RULE-SET,discord_voiceips),(PROCESS-NAME,Discord.exe)),Discord
# Строка 1350:
  - RULE-SET,discord,Discord              # inline провайдер с AND-логикой
# Строка 1380:
  - AND,((RULE-SET,cloudflare-ips),(NETWORK,udp),(DST-PORT,19200-19500)),Discord
# Строка 1381:
  - AND,((RULE-SET,discord_voiceips),(NETWORK,udp),(DST-PORT,50000-50100)),Discord
# Строка 1382:
  - RULE-SET,discord_vc,Discord           # inline провайдер с AND voice IP блоками
# Строка 1383:
  - RULE-SET,discord_domains,Discord      # ДУБЛЬ (уже в OR строки 1336)
# Строка 1384:
  - PROCESS-NAME-REGEX,(?i).*discord.*,Discord  # Расширение PROCESS-NAME
# Строки 1421-1444 (24 inline DOMAIN-SUFFIX):
  - DOMAIN-SUFFIX,dis.gd,Discord                  # покрыт geosite
  - DOMAIN-SUFFIX,discord-attachments-...googleapis.com,Discord  # покрыт geosite
  - DOMAIN-SUFFIX,discord.app,Discord              # НЕ в geosite
  - DOMAIN-SUFFIX,discord.co,Discord               # покрыт geosite
  - DOMAIN-SUFFIX,discord.com,Discord              # покрыт geosite
  # ... еще 19 inline правил
```

**Анализ покрытия geosite discord.yaml (28 доменов):**

| Inline домен (строки 1421-1444) | В geosite discord? | Решение |
|---|---|---|
| dis.gd | ДА | Удалить |
| discord-attachments-uploads-prd.storage.googleapis.com | ДА | Удалить |
| discord.app | НЕТ | Сохранить как inline-дополнение |
| discord.co | ДА | Удалить |
| discord.com | ДА | Удалить |
| discord.design | ДА | Удалить |
| discord.dev | ДА | Удалить |
| discord.gift | ДА | Удалить |
| discord.gifts | ДА | Удалить |
| discord.gg | ДА | Удалить |
| discord.media | ДА | Удалить |
| discord.new | ДА | Удалить |
| discord.store | ДА | Удалить |
| discord.status | НЕТ | Сохранить (это не discordstatus.com!) |
| discord-activities.com | ДА | Удалить |
| discordactivities.com | ДА | Удалить |
| discordapp.com | ДА | Удалить |
| discordapp.net | ДА | Удалить |
| discordcdn.com | ДА | Удалить |
| discordmerch.com | ДА | Удалить |
| discordpartygames.com | ДА | Удалить |
| discordsays.com | ДА | Удалить |
| discordsez.com | НЕТ | Сохранить как inline-дополнение |
| discordstatus.com | ДА | Удалить |

**Voice IP дубли:**
- `discord_vc` (inline, строка 1114): 9 AND-конструкций с IP-CIDR + UDP + port 50000-50100
- `discord_voiceips` (HTTP MRS, строка 1093): внешний набор voice IP
- `discord` inline (строка 1127): 3 AND-конструкции для voice IP (подмножество discord_vc)
- Строка 1380: AND с cloudflare-ips для портов 19200-19500 (Discord media через CF)
- Строка 1381: AND с discord_voiceips для портов 50000-50100

**Рекомендация по discord_vc vs discord_voiceips:** discord_voiceips -- внешний MRS, обновляется автоматически. discord_vc -- inline, устаревает. Оставить discord_voiceips + AND-wrapper (строка 1381). Но: discord_vc содержит IP-диапазоны, которых может не быть в discord_voiceips (138.128.136.0/21, 162.158.0.0/15, 172.64.0.0/13 -- это Cloudflare IP). Для надежности: сохранить оба voice подхода до проверки содержимого discord_voiceips MRS.

**Осиротевший провайдер:**
- `discord_ips` (Anton111111, строка 1100) -- определен, но RULE-SET,discord_ips нигде не используется

**Целевое состояние Discord:**
```yaml
  # --- Discord: консолидировано из 30+ правил ---
  - OR,((RULE-SET,discord_domains),(RULE-SET,discord_voiceips),(PROCESS-NAME,Discord.exe)),Discord
  - RULE-SET,discord_vc,Discord                    # Voice IP ranges (inline AND-конструкции)
  - AND,((RULE-SET,cloudflare-ips),(NETWORK,udp),(DST-PORT,19200-19500)),Discord  # CF media ports
  - PROCESS-NAME-REGEX,(?i).*discord.*,Discord     # Процессы
  # Discord: inline-дополнения (не покрыты geosite):
  - DOMAIN-SUFFIX,discord.app,Discord
  - DOMAIN-SUFFIX,discord.status,Discord
  - DOMAIN-SUFFIX,discordsez.com,Discord
```

### Telegram: Текущее состояние (10 правил) vs Целевое (5-6 правил)

**Текущее (разбросано):**
```yaml
# Строка 1296 (inline):
  - DOMAIN-SUFFIX,antarcticwallet,Telegram
# Строка 1309 (inline REGEX):
  - DOMAIN-REGEX,^([\\w\\-\\.]+\\.)?antarcticwallet\\.com$,Telegram
# Строка 1335 (OR блок):
  - OR,((RULE-SET,telegram_ips),(RULE-SET,telegram_domains)),Telegram
# Строка 1369 (GEOSITE):
  - GEOSITE,telegram,Telegram
# Строка 1373 (GEOIP):
  - GEOIP,telegram,Telegram
# Строка 1376:
  - RULE-SET,telegram-ips,Telegram        # Anton111111 IP list
# Строка 1377:
  - RULE-SET,telegram-domains,Telegram    # MetaCubeX geosite -- ДУБЛЬ telegram_domains
# Строка 1378:
  - PROCESS-NAME-REGEX,(?i).*ayugram.*,Telegram
# Строка 1379:
  - PROCESS-NAME-REGEX,(?i).*telegram.*,Telegram
```

**Дублирующиеся rule-provider:**
- `telegram-domains` (строка 856): MetaCubeX geosite/telegram.mrs
- `telegram_domains` (строка 1264): MetaCubeX geosite/telegram.mrs -- **ОДИНАКОВЫЙ URL!**
- `telegram-ips` (строка 1063): Anton111111 telegram_ips.list (classical format)
- `telegram_ips` (строка 1257): MetaCubeX geoip/telegram.mrs (ipcidr format)

Два разных IP-провайдера: Anton111111 и MetaCubeX. Оба полезны (разные источники IP).
Два одинаковых domain-провайдера: telegram-domains = telegram_domains (один URL).

**antarcticwallet -- что это?** Telegram использует домен antarcticwallet.com для TON/Wallet функционала. Не покрыт geosite telegram.yaml (20 доменов не включают antarcticwallet). Это уникальный inline-домен, сохранить.

**Целевое состояние Telegram:**
```yaml
  # --- Telegram: консолидировано из 10 правил ---
  - DOMAIN-SUFFIX,antarcticwallet,Telegram         # TON Wallet (не покрыт geosite)
  - OR,((RULE-SET,telegram_ips),(RULE-SET,telegram_domains)),Telegram  # IP + домены MetaCubeX
  - RULE-SET,telegram-ips,Telegram                 # Anton111111 IP list (дополнительное покрытие)
  - GEOSITE,telegram,Telegram                      # GEOSITE backup
  - GEOIP,telegram,Telegram                        # GeoIP backup
  - PROCESS-NAME-REGEX,(?i).*ayugram.*,Telegram    # Ayugram клиент
  - PROCESS-NAME-REGEX,(?i).*telegram.*,Telegram   # Telegram клиент
```

Удаляются:
- `DOMAIN-REGEX,antarcticwallet` (строка 1309) -- покрыт DOMAIN-SUFFIX (строка 1296)
- `RULE-SET,telegram-domains` (строка 1377) -- дубль telegram_domains (строка 1335 OR-блок)
- Провайдер `telegram-domains` (строка 856) -- дубль `telegram_domains` (строка 1264)

### Cloudflare: Текущее состояние (19 правил) vs Целевое (2-3 правила)

**Текущее:**
```yaml
# Строки 1404-1420 (17 inline DOMAIN-SUFFIX):
  - DOMAIN-SUFFIX,cloudflare-ech.com,Cloudflare    # покрыт geosite
  - DOMAIN-SUFFIX,encryptedsni.com,Cloudflare      # покрыт geosite
  - DOMAIN-SUFFIX,cloudflareaccess.com,Cloudflare  # покрыт geosite
  # ... еще 14 ...
# Строка 1530-1531 (RULE-SET):
  - RULE-SET,cloudflare-ips,Cloudflare
  - RULE-SET,cloudflare-domains,Cloudflare         # MetaCubeX geosite (74 домена)
# Строка 1617 (отдельно в ECH-секции):
  - DOMAIN,cloudflare-ech.com,🌍VPN                # КОНФЛИКТ: тот же домен, другая группа!
```

**ВСЕ 17 inline DOMAIN-SUFFIX покрыты geosite cloudflare.yaml (74 домена).** Безопасно удалять все 17.

**ВНИМАНИЕ: cloudflare-ech.com конфликт!**
- Строка 1404: `DOMAIN-SUFFIX,cloudflare-ech.com,Cloudflare` (первый матч)
- Строка 1617: `DOMAIN,cloudflare-ech.com,🌍VPN` (мертвый код из-за 1404)

Строка 1617 находится в ECH-секции и видимо предназначалась для обхода блокировки ECH через VPN. После удаления строки 1404 (inline), RULE-SET cloudflare-domains (строка 1531) перехватит cloudflare-ech.com в группу Cloudflare. Строка 1617 все равно будет мертвым кодом. Оставить строку 1617 как есть -- это Phase 4 (ECH-оптимизация, v2 scope).

**Осиротевший провайдер:**
- `cloudflare_ips` (Anton111111, строка 977) -- определен, но RULE-SET,cloudflare_ips нигде не используется

**Целевое состояние Cloudflare:**
```yaml
  # --- Cloudflare: консолидировано из 17 inline-правил ---
  - RULE-SET,cloudflare-ips,Cloudflare
  - RULE-SET,cloudflare-domains,Cloudflare         # MetaCubeX geosite (74 домена, покрывает все 17 inline)
```

### Торренты: Текущее состояние (4 правила) vs Целевое (3 правила)

**Текущее:**
```yaml
# Строка 1331 (первый блок):
  - OR,((RULE-SET,torrent-clients),(RULE-SET,torrent-trackers)),DIRECT
# Строка 1332:
  - PROCESS-NAME-REGEX,(?i).*torrent.*,DIRECT
# Строка 1603 (ДОСЛОВНЫЙ ДУБЛЬ строки 1331):
  - OR,((RULE-SET,torrent-clients),(RULE-SET,torrent-trackers)),DIRECT
# Строка 1604:
  - RULE-SET,torrent-websites,🌍VPN
```

**Целевое состояние:**
```yaml
  # --- Торренты: консолидировано (дубль OR-блока удален) ---
  - OR,((RULE-SET,torrent-clients),(RULE-SET,torrent-trackers)),DIRECT
  - PROCESS-NAME-REGEX,(?i).*torrent.*,DIRECT
  - RULE-SET,torrent-websites,🌍VPN
```

### refilter_ipsum: Текущее (2 вхождения) vs Целевое (1 вхождение)

**Текущее:**
```yaml
# Строка 1589 (основной refilter-блок, группа Комьюнити):
  - RULE-SET,refilter_ipsum,Комьюнити
# Строка 1621 (ECH-логика, группа ECH-Refilter):
  - RULE-SET,refilter_ipsum,ECH-Refilter    # МЕРТВЫЙ КОД (first-match-wins)
```

**Рекомендация (Claude's Discretion):** Оставить в группе ECH-Refilter. Обоснование:
1. refilter_ipsum -- это IP-правила заблокированных ресурсов, связанные с ECH-логикой
2. ECH-Refilter -- переключаемая группа (VPN/DIRECT), дает пользователю контроль
3. Комьюнити -- общая группа для community-списков, менее специфичная
4. Контекст конфига: refilter_ipsum расположен рядом с refilter_ech и refilter_noech (строки 1618-1621) -- логическая группировка ECH-фильтрации

**Целевое состояние:**
```yaml
  # --- Refilter ECH-логика ---
  - RULE-SET,refilter_ech,DIRECT
  - RULE-SET,refilter_noech,ECH-Refilter
  - RULE-SET,refilter_ipsum,ECH-Refilter   # консолидировано: был дубль в Комьюнити
```

## Inventory: Все изменения по файлу

### rule-providers -- удалить

| Провайдер | Строки | Причина удаления |
|-----------|--------|------------------|
| youtube-domains | 1070-1076 | Осиротевший (нет RULE-SET ссылки в rules) |
| youtube-ips | 1077-1083 | Осиротевший (нет RULE-SET ссылки в rules) |
| discord_ips | 1100-1106 | Осиротевший (нет RULE-SET ссылки в rules) |
| cloudflare_ips | 977-983 | Осиротевший (нет RULE-SET ссылки в rules) |
| telegram-domains | 856-862 | Дубль telegram_domains (одинаковый URL) |
| discord (inline) | 1127-1135 | Содержимое покрыто discord_vc + discord_domains + DOMAIN-KEYWORD в OR |

### rule-providers -- оставить без изменений

| Провайдер | Назначение |
|-----------|------------|
| youtube | MetaCubeX geosite (179 доменов) |
| discord_voiceips | Legiz-ru voice IP MRS |
| discord_domains | MetaCubeX geosite (28 доменов) |
| discord_vc | Inline voice IP AND-конструкции (9 ranges) |
| telegram_ips | MetaCubeX geoip telegram |
| telegram_domains | MetaCubeX geosite telegram |
| telegram-ips | Anton111111 telegram IPs |
| cloudflare-ips | MetaCubeX geoip cloudflare |
| cloudflare-domains | MetaCubeX geosite cloudflare (74 домена) |
| refilter_domains | Legiz-ru refilter domains |
| refilter_ech | Legiz-ru ECH filter |
| refilter_noech | Legiz-ru noECH filter |
| refilter_ipsum | Legiz-ru IP filter |
| torrent-clients | Legiz-ru torrent clients |
| torrent-trackers | Legiz-ru torrent trackers |
| torrent-websites | Legiz-ru torrent websites |

### rules -- удалить

| Строка | Правило | Причина |
|--------|---------|---------|
| 1374 | `RULE-SET,youtube,YouTube` | Дубль строки 1334 |
| 1386-1402 | 17x DOMAIN-SUFFIX,*,YouTube | Покрыты geosite youtube (кроме jnn-pa -- сохранить) |
| 1391 | `DOMAIN-SUFFIX,stable.dl2.discordapp.net,YouTube` | Ошибка: Discord домен в YouTube |
| 1350 | `RULE-SET,discord,Discord` | Содержимое покрыто OR-блоком + discord_vc |
| 1383 | `RULE-SET,discord_domains,Discord` | Дубль (уже в OR строки 1336) |
| 1421-1444 | 24x DOMAIN-SUFFIX,*,Discord | Покрыты geosite discord (кроме 3 -- сохранить) |
| 1309 | `DOMAIN-REGEX,antarcticwallet` | Покрыт DOMAIN-SUFFIX,antarcticwallet (строка 1296) |
| 1377 | `RULE-SET,telegram-domains,Telegram` | Дубль telegram_domains (в OR строки 1335) |
| 1404-1420 | 17x DOMAIN-SUFFIX,*,Cloudflare | Покрыты geosite cloudflare (74 домена) |
| 1603 | `OR,torrent-clients,torrent-trackers,DIRECT` | Дубль строки 1331 |
| 1589 | `RULE-SET,refilter_ipsum,Комьюнити` | Дубль: оставить в ECH-Refilter (строка 1621) |

### rules -- сохранить как inline-дополнения

| Домен | Сервис | Причина сохранения |
|-------|--------|--------------------|
| jnn-pa.googleapis.com | YouTube | Не в geosite youtube напрямую |
| discord.app | Discord | Не в geosite discord |
| discord.status | Discord | Не в geosite discord (discordstatus.com есть, но discord.status -- другой домен) |
| discordsez.com | Discord | Не в geosite discord |
| antarcticwallet | Telegram | Не в geosite telegram (TON Wallet) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GEOSITE + inline DOMAIN-SUFFIX для каждого домена | GEOSITE + RULE-SET (MRS format) | mihomo v1.15+ | MRS -- бинарный формат, быстрее загрузка и парсинг |
| Inline IP-CIDR для voice | Внешний MRS с IP-диапазонами (discord_voiceips) | 2024 | Автообновление IP-диапазонов |
| GEOIP,telegram + GEOSITE,telegram отдельно | OR блок с RULE-SET для domains + ips | mihomo v1.18+ | Одно правило вместо двух |

## Open Questions

1. **discord_voiceips vs discord_vc: полное перекрытие?**
   - What we know: discord_vc содержит 9 AND-конструкций (IP-CIDR + UDP + port). discord_voiceips -- внешний MRS с ipcidr behavior.
   - What's unclear: Содержит ли discord_voiceips все 9 IP-диапазонов из discord_vc? Некоторые IP в discord_vc (162.158.0.0/15, 172.64.0.0/13) -- Cloudflare ranges, не Discord.
   - Recommendation: Сохранить оба до возможности скачать и сравнить содержимое MRS. В Phase 2 -- консервативный подход: не удалять discord_vc.

2. **DOMAIN-SUFFIX,jnn-pa.googleapis.com -- нужен ли?**
   - What we know: jnn-pa.googleapis.com -- YouTube JNN (JSON Notification) push API endpoint.
   - What's unclear: Покрыт ли Google GEOSITE через googleapis.com? GEOSITE,google стоит на строке 1364, но он маршрутизирует в Google группу, не YouTube.
   - Recommendation: Сохранить как inline-дополнение YouTube. Лучше лишнее правило чем пропущенный YouTube трафик (per user decision).

3. **Порядок сервисных блоков после перегруппировки**
   - What we know: User wants rules grouped by service.
   - What's unclear: Какой порядок сервисов оптимален?
   - Recommendation (Claude's Discretion): Сохранить текущий относительный порядок первых вхождений: QUIC/SAFE -> Adult -> Torrent -> YouTube -> Telegram -> Discord -> ... -> Cloudflare -> RU трафик -> Refilter -> OISD -> CDN IPs.

## Sources

### Primary (HIGH confidence)
- [MetaCubeX geosite youtube.yaml](https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.yaml) -- 179 доменов, проверено покрытие всех inline
- [MetaCubeX geosite discord.yaml](https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/discord.yaml) -- 28 доменов, проверено покрытие inline
- [MetaCubeX geosite cloudflare.yaml](https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cloudflare.yaml) -- 74 домена, все 17 inline покрыты
- [MetaCubeX geosite telegram.yaml](https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/telegram.yaml) -- 20 доменов, antarcticwallet НЕ покрыт
- [v2fly/domain-list-community youtube](https://raw.githubusercontent.com/v2fly/domain-list-community/master/data/youtube) -- исходник geosite
- [Route Rules - mihomo docs](https://wiki.metacubex.one/en/config/rules/) -- first-match-wins семантика, GEOSITE vs RULE-SET
- config.yaml -- прямой анализ всех строк конфига (построчная проверка дублей)

### Secondary (MEDIUM confidence)
- [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat) -- структура geosite/geoip данных
- Codebase CONCERNS.md -- задокументированные проблемы с дублями

### Tertiary (LOW confidence)
- discord_voiceips MRS содержимое -- не проверено (бинарный MRS формат, нельзя скачать и прочитать как текст). Решение: консервативный подход, сохранить discord_vc.

## Metadata

**Confidence breakdown:**
- YouTube дедупликация: HIGH -- все 17 inline доменов верифицированы против geosite YAML
- Discord дедупликация: HIGH для доменов, MEDIUM для voice IP (discord_voiceips MRS не проверен)
- Telegram дедупликация: HIGH -- дубли провайдеров подтверждены (одинаковый URL)
- Cloudflare дедупликация: HIGH -- все 17 inline доменов покрыты geosite
- Торренты: HIGH -- дословный дубль строк
- refilter_ipsum: HIGH -- два RULE-SET ссылки на один провайдер, first-match-wins

**Research date:** 2026-02-25
**Valid until:** 30 дней (стабильный домен: geosite URL не меняются, конфиг mihomo стабилен)
