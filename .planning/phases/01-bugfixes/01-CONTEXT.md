# Phase 1: Bugfixes - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Исправление 3 конкретных ошибок в конфиге mihomo: дубль OISD, баг синтаксиса DST-PORT, дубль bongacams.ru в категории Other. Никаких структурных изменений или новых возможностей. DEDUP-10 (Logitech) снят с этой фазы.

</domain>

<decisions>
## Implementation Decisions

### DST-PORT правило (DEDUP-08)
- Правило `DST-PORT,53,53` (строка 1603) исправить — синтаксис сломан, mihomo -t выдаёт ошибку
- Замысел правила: направлять DNS-трафик (порт 53) в прокси-группу '53'
- Группа '53' по умолчанию DIRECT — это правильно, не менять
- Имя группы '53' НЕ переименовывать — оставить как есть
- Позицию правила НЕ менять — оставить в конце секции rules (после локальных IP)

### OISD дубль (DEDUP-05)
- Удалить oisd_small из rule-providers и из rules
- Оставить только oisd_big (big является надмножеством small)
- Подтвердить что big покрывает small перед удалением

### bongacams.ru дубль (DEDUP-09)
- Удалить строку `DOMAIN-SUFFIX,bongacams.ru,Other` (строка 1491) — это дубль
- bongacams уже покрыт группой BG: inline-правила (строки 1297-1311) + провайдер BG_in
- Только удалить дубль из Other, остальные adult-сайты (onlyfans, pornhub и т.д.) — это Phase 3

### Logitech — СНЯТ с Phase 1
- DEDUP-10 удалён из Phase 1 и из requirements
- Оба способа определения (GEOSITE + KEYWORD) остаются как есть
- Причина: если оба существуют, значит каждый по отдельности не покрывает цель полностью

### Claude's Discretion
- Покрытие bongacams .ru доменов в BG_in провайдере (сейчас только .com) — проверить и починить если нужно
- Точный синтаксис исправления DST-PORT правила

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-bugfixes*
*Context gathered: 2026-02-25*
