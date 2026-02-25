---
phase: 02-service-deduplication
plan: 02
subsystem: routing-rules
tags: [mihomo, deduplication, discord, telegram, geosite, rule-set, voice-ip]

# Dependency graph
requires:
  - phase: 02-service-deduplication/01
    provides: "Консолидированные YouTube/Cloudflare правила, паттерн сервисных блоков"
provides:
  - "Консолидированные Discord правила (7 вместо 30+)"
  - "Консолидированные Telegram правила (7 вместо 10)"
  - "Удалены 2 осиротевших/дублирующих провайдера (discord_ips, telegram-domains)"
  - "Удалён inline провайдер discord (покрыт OR-блоком)"
affects: [02-service-deduplication, 04-url-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Консолидация сервисных правил: OR-блок + RULE-SET + GEOSITE + PROCESS-NAME + inline-дополнения"
    - "Комментарий-заголовок для консолидированных блоков: # --- Service: консолидировано из N правил ---"

key-files:
  created: []
  modified:
    - config.yaml

key-decisions:
  - "discord_vc (inline AND-конструкции) сохранён консервативно -- содержит IP-диапазоны, которые могут не быть в discord_voiceips MRS"
  - "AND,discord_voiceips отдельный удалён -- трафик покрыт OR-блоком (discord_voiceips в OR) + discord_vc inline"
  - "telegram-domains провайдер (дефис) удалён, оставлен telegram_domains (подчёркивание) -- используется в OR-блоке"
  - "3 inline Discord-домена сохранены как непокрытые geosite: discord.app, discord.status, discordsez.com"

patterns-established:
  - "Сервисный блок Discord: OR-блок первым (domains+voiceips+PROCESS-NAME), затем discord_vc, CF-media AND, PROCESS-NAME-REGEX, inline-дополнения"
  - "Сервисный блок Telegram: DOMAIN-SUFFIX первым (antarcticwallet), OR-блок, RULE-SET ips, GEOSITE, GEOIP, PROCESS-NAME-REGEX"

requirements-completed: [DEDUP-02, DEDUP-03]

# Metrics
duration: 4min
completed: 2026-02-25
---

# Phase 2 Plan 02: Discord + Telegram Deduplication Summary

**Discord консолидирован из 30+ правил в 7 (OR-блок + voice + CF-media + процессы + 3 inline), Telegram из 10 в 7; удалены 3 провайдера (discord_ips, discord inline, telegram-domains)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T04:25:16Z
- **Completed:** 2026-02-25T04:28:59Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Discord: 30+ правил сокращено до 7 (OR-блок + discord_vc + AND/CF-media + PROCESS-NAME-REGEX + 3 inline-дополнения)
- Telegram: 10 правил сокращено до 7 (antarcticwallet + OR-блок + telegram-ips + GEOSITE + GEOIP + 2 PROCESS-NAME)
- Удалён осиротевший провайдер discord_ips (Anton111111, нигде не используется)
- Удалён inline провайдер discord (содержимое покрыто discord_vc + discord_domains + OR-блок)
- Удалён дублирующий провайдер telegram-domains (тот же URL что telegram_domains)
- Удалён лишний DOMAIN-REGEX antarcticwallet (покрыт DOMAIN-SUFFIX)
- YAML конфиг валиден после всех изменений
- Все PROCESS-NAME и PROCESS-NAME-REGEX правила сохранены

## Task Commits

Each task was committed atomically:

1. **Task 1: Discord deduplication** - `3c99fb3` (feat)
2. **Task 2: Telegram deduplication** - `1276965` (feat)

## Files Created/Modified
- `config.yaml` - Удалены 24 inline DOMAIN-SUFFIX Discord, дубли RULE-SET, 3 провайдера; Telegram дубли провайдеров и правил; добавлены комментарии консолидации

## Decisions Made
- discord_vc (inline AND-конструкции с 9 IP-диапазонами) сохранён консервативно -- MRS discord_voiceips не проверен на полное покрытие
- AND,discord_voiceips (строка 1362 в оригинале) удалён -- тройное покрытие voice IP избыточно (OR-блок + discord_vc достаточно)
- telegram-domains провайдер (с дефисом) удалён в пользу telegram_domains (с подчёркиванием) -- последний используется в OR-блоке
- 3 Discord-домена сохранены как inline-дополнения: discord.app, discord.status, discordsez.com -- не покрыты geosite discord (28 доменов)

## Deviations from Plan

None - план выполнен точно как написан.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Discord и Telegram полностью консолидированы
- Готово для Plan 03 (торренты + refilter_ipsum дедупликация)
- Все PROCESS-NAME правила сохранены для мобильных платформ

## Self-Check: PASSED

- FOUND: config.yaml
- FOUND: .planning/phases/02-service-deduplication/02-02-SUMMARY.md
- FOUND: 3c99fb3 (Task 1 commit)
- FOUND: 1276965 (Task 2 commit)

---
*Phase: 02-service-deduplication*
*Completed: 2026-02-25*
