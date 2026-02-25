# Phase 2: Service Deduplication - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Удаление дублирующихся правил маршрутизации для сервисов (YouTube, Discord, Telegram, Cloudflare, торренты, refilter). Каждый сервис должен быть определён одним консолидированным способом. Добавление новых сервисов или изменение proxy-groups — вне скоупа.

</domain>

<decisions>
## Implementation Decisions

### Стратегия покрытия
- Перед удалением inline-правил — скачать RULE-SET/GEOSITE и проверить покрытие каждого inline-домена
- Непокрытые домены сохранить как дополнительные inline-правила рядом с соответствующим RULE-SET (с комментарием)
- Сомнительные/старые домены тоже сохранять — лучше лишнее правило, чем пропущенный трафик

### Метод маршрутизации сервисов
- Единый подход для всех сервисов: GEOSITE + RULE-SET где доступны оба
- Если для сервиса доступен только один метод — найти недостающий RULE-SET из публичных источников
- Приоритет порядка в rules: RULE-SET выше GEOSITE (более конкретные правила приоритетнее)
- Применяется к YouTube, Discord, Telegram, Cloudflare, торрентам

### Консолидация refilter
- refilter_ipsum: оставить одно вхождение RULE-SET в rules, удалить дубль
- Проверить все refilter-провайдеры на дублирование (не только ipsum)

### Чистота конфига
- Краткие комментарии о консолидации на русском языке (напр. `# YouTube: консолидировано из 17 inline-правил`)
- Осиротевшие комментарии (к удалённым правилам) — удалять
- Перегруппировать rules по сервису: все правила одного сервиса рядом

### Claude's Discretion
- Выбор proxy-group при консолидации refilter_ipsum (если два вхождения в разные группы)
- Конкретный порядок сервисов внутри rules-секции при группировке
- Технические детали скачивания и парсинга RULE-SET/GEOSITE для проверки покрытия

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

*Phase: 02-service-deduplication*
*Context gathered: 2026-02-25*
