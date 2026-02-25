---
phase: 02-service-deduplication
verified: 2026-02-25T05:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 2: Service Deduplication Verification Report

**Phase Goal:** Каждый сервис определен одним способом маршрутизации, дубли правил полностью устранены
**Verified:** 2026-02-25T05:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | YouTube-правила не содержат inline DOMAIN-SUFFIX (кроме jnn-pa.googleapis.com), дубль RULE-SET удален | VERIFIED | grep `DOMAIN-SUFFIX.*YouTube` -- только jnn-pa (строка 1266). `RULE-SET,youtube,YouTube` -- ровно 1 вхождение (строка 1262). YouTube итого: 4 правила (строки 1262-1266) |
| 2  | Cloudflare-правила не содержат inline DOMAIN-SUFFIX, все 17 удалены | VERIFIED | grep `DOMAIN-SUFFIX.*Cloudflare` -- 0 результатов. Cloudflare: 2 правила (строки 1402-1403: cloudflare-ips + cloudflare-domains) |
| 3  | Осиротевшие провайдеры youtube-domains, youtube-ips, cloudflare_ips удалены из rule-providers | VERIFIED | grep по всем трем именам -- 0 результатов в config.yaml |
| 4  | stable.dl2.discordapp.net удален из YouTube-правил (ошибочная привязка) | VERIFIED | grep `stable.dl2.discordapp.net` -- 0 результатов |
| 5  | Discord определен через консолидированный набор правил без дублирующих inline DOMAIN-SUFFIX (кроме 3 непокрытых geosite) | VERIFIED | Discord: 7 правил (строки 1309-1316). Inline: только discord.app, discord.status, discordsez.com. Осиротевший discord_ips -- 0 результатов. Inline провайдер discord -- 0 результатов |
| 6  | Telegram определен через консолидированный набор правил без дублирующего провайдера telegram-domains | VERIFIED | Telegram: 7 правил (строки 1301-1307). `telegram-domains` провайдер -- 0 результатов. `telegram_domains` (подчеркивание) -- 1 провайдер + 1 ссылка в OR-блоке. DOMAIN-REGEX antarcticwallet -- 0 (лишний удален) |
| 7  | Осиротевший провайдер discord_ips удален | VERIFIED | grep `discord_ips` -- 0 результатов |
| 8  | Inline провайдер discord удален (покрыт discord_vc + discord_domains + OR-блок) | VERIFIED | grep `^  discord:` в rule-providers -- 0 результатов |
| 9  | Торрент-правило OR-блок присутствует ровно 1 раз (дубль удален) | VERIFIED | grep `OR.*torrent-clients.*torrent-trackers.*DIRECT` -- ровно 1 вхождение (строка 1257) |
| 10 | refilter_ipsum привязан к ECH-Refilter (не к Комьюнити), ровно 1 вхождение | VERIFIED | `RULE-SET,refilter_ipsum,ECH-Refilter` -- строка 1489 (единственное вхождение). `refilter_ipsum.*Комьюнити` -- 0 результатов |
| 11 | Все правила каждого сервиса сгруппированы рядом в rules-секции | VERIFIED | YouTube: строки 1262-1266 (span 4). Discord: строки 1309-1316 (span 7). Telegram: строки 1301-1307 (span 6). Cloudflare: строки 1402-1403 (span 1). Торренты: строки 1257-1259 (span 2). Refilter ECH: строки 1487-1489 (span 2) |
| 12 | mihomo config.yaml остается валидным YAML после всех изменений | VERIFIED | `python -c "import yaml; yaml.safe_load(open('config.yaml'))"` -- exit code 0 |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `config.yaml` | Дедуплицированные правила всех 6 сервисов | VERIFIED | 1532 строки, 258 правил, 62 провайдера. YAML валиден. Все 6 сервисов (YouTube, Discord, Telegram, Cloudflare, торренты, refilter) консолидированы |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| rules: RULE-SET,youtube | rule-providers: youtube | RULE-SET reference | VERIFIED | Провайдер youtube (строка 828), правило (строка 1262) |
| rules: RULE-SET,cloudflare-ips / cloudflare-domains | rule-providers: cloudflare-ips / cloudflare-domains | RULE-SET reference | VERIFIED | Провайдеры (строки 1171, 1178), правила (строки 1402-1403) |
| rules: OR-block discord_domains / discord_voiceips | rule-providers: discord_domains / discord_voiceips | RULE-SET references in OR | VERIFIED | Провайдеры (строки 1058, 1051), OR-блок (строка 1309) |
| rules: OR-block telegram_ips / telegram_domains | rule-providers: telegram_ips / telegram_domains | RULE-SET references in OR | VERIFIED | Провайдеры (строки 1185, 1192), OR-блок (строка 1302) |
| rules: OR-block torrent-clients / torrent-trackers | rule-providers: torrent-clients / torrent-trackers | RULE-SET references in OR | VERIFIED | Провайдеры (строки 1119, 1126), OR-блок (строка 1257) |
| rules: RULE-SET,refilter_ipsum | rule-providers: refilter_ipsum | RULE-SET reference | VERIFIED | Провайдер (строка 1110), правило (строка 1489) |
| Все 62 RULE-SET ссылки | Все 62 провайдера | Cross-reference | VERIFIED | Python-скрипт: 62 провайдеров = 62 RULE-SET ссылок. 0 осиротевших, 0 висящих |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEDUP-01 | 02-01-PLAN | Все дублирующиеся правила YouTube удалены (17 inline DOMAIN-SUFFIX при наличии GEOSITE + RULE-SET) | SATISFIED | 17 inline удалены, jnn-pa сохранен (не покрыт geosite). YouTube: 4 правила вместо 21 |
| DEDUP-02 | 02-02-PLAN | Все дублирующиеся правила Discord удалены (4+ определения консолидированы) | SATISFIED | Discord: 7 правил вместо 30+. discord_ips, discord inline провайдер удалены. OR-блок консолидирует domains + voiceips + PROCESS-NAME |
| DEDUP-03 | 02-02-PLAN | Все дублирующиеся правила Telegram удалены (8+ определений) | SATISFIED | Telegram: 7 правил вместо 10. telegram-domains дубль провайдера удален. DOMAIN-REGEX antarcticwallet удален (покрыт DOMAIN-SUFFIX) |
| DEDUP-04 | 02-01-PLAN | Все дублирующиеся правила Cloudflare удалены (17 inline DOMAIN-SUFFIX) | SATISFIED | Все 17 inline DOMAIN-SUFFIX удалены. Cloudflare: 2 правила (RULE-SET для IP + RULE-SET для доменов). cloudflare_ips осиротевший провайдер удален |
| DEDUP-06 | 02-03-PLAN | Дублирующиеся торрент-правила удалены (определены дважды) | SATISFIED | OR-блок торрентов: ровно 1 вхождение (строка 1257). Дубль удален |
| DEDUP-07 | 02-03-PLAN | Дублирующийся refilter_ipsum консолидирован (используется в двух секциях) | SATISFIED | refilter_ipsum: 1 вхождение в ECH-Refilter (строка 1489). Дубль в Комьюнити удален. Маршрутизация осознанно изменена (задокументировано в CONTEXT.md) |

**Orphaned requirements check:** grep `Phase 2` в REQUIREMENTS.md показывает DEDUP-01 через DEDUP-04, DEDUP-06, DEDUP-07 -- все 6 покрыты планами и выполнены. DEDUP-05 -- Phase 1 (не Phase 2). Ни одного орфанного требования.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| - | - | - | - | Ни одного TODO, FIXME, PLACEHOLDER или HACK не найдено |

Сканирование config.yaml: 0 TODO/FIXME/PLACEHOLDER/HACK найдено.

### Human Verification Required

### 1. Целостность маршрутизации после дедупликации

**Test:** Проверить что трафик YouTube, Discord, Telegram, Cloudflare корректно маршрутизируется через соответствующие proxy-groups после удаления дублей
**Expected:** Каждый сервис маршрутизируется через свою группу: YouTube через YouTube, Discord через Discord, и т.д. Потери покрытия нет.
**Why human:** Автоматическая верификация проверяет наличие правил, но не может подтвердить что geosite/RULE-SET MRS файлы действительно покрывают все удаленные inline домены в runtime

### 2. Изменение маршрутизации refilter_ipsum

**Test:** Убедиться что refilter_ipsum в группе ECH-Refilter (а не Комьюнити) работает корректно для пользователя
**Expected:** Заблокированные IP-адреса из refilter_ipsum маршрутизируются через ECH-Refilter (переключаемая группа VPN/DIRECT), а не через Комьюнити (только VPN)
**Why human:** Осознанное изменение поведения маршрутизации -- требует подтверждения пользователем что новое поведение устраивает

### 3. Discord voice работает

**Test:** Проверить голосовые звонки Discord после удаления 24 inline DOMAIN-SUFFIX и AND,discord_voiceips отдельного правила
**Expected:** Голосовые звонки Discord работают. Трафик покрыт discord_voiceips в OR-блоке + discord_vc inline AND-конструкции
**Why human:** Voice IP покрытие нельзя верифицировать без реального звонка

### Gaps Summary

Пробелов не обнаружено. Все 12 must-have истин верифицированы, все 6 требований фазы выполнены, все артефакты существуют и функциональны, все ключевые связи подтверждены.

Дополнительно подтверждено:
- 62 провайдера = 62 RULE-SET ссылки (0 осиротевших, 0 висящих)
- 258 правил в rules (было 320, -62)
- 62 провайдера в rule-providers (было 72, -10)
- 1532 строки в config.yaml (было 1663, -132)
- YAML валиден
- Все 6 коммитов подтверждены в git history

**Примечание к ROADMAP Success Criteria #1:** ROADMAP указывает "общее число YouTube-правил сокращено с 17+ до 1-2", фактически сокращено до 4 (RULE-SET + GEOSITE + PROCESS-NAME-REGEX + 1 inline jnn-pa). Это отклонение обосновано: PROCESS-NAME-REGEX и jnn-pa inline -- не дубли, а дополнительное покрытие (backup GEOSITE + процессы + непокрытый домен). Суть критерия (удаление 17 inline DOMAIN-SUFFIX дублей) полностью выполнена.

---

_Verified: 2026-02-25T05:00:00Z_
_Verifier: Claude (gsd-verifier)_
