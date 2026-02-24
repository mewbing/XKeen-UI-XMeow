# Mihomo Config Refactoring

## What This Is

Конфигурация mihomo (Clash Meta) для маршрутизации трафика через прокси на роутере Keenetic. Используется для обхода блокировок РФ (YouTube, Discord, торренты, AI-сервисы) с сохранением прямого доступа к российским сайтам. Один базовый конфиг порождает два варианта: личный (полный, с adult-контентом) и рабочий (без adult).

## Core Value

Весь заблокированный в РФ трафик надёжно проходит через прокси, российские сайты идут напрямую, а рабочая версия конфига не содержит следов adult-контента.

## Requirements

### Validated

- ✓ Базовая прокси-маршрутизация (rule-based routing) — existing
- ✓ Proxy-provider с подпиской и health-check — existing
- ✓ Proxy-groups: VPN, Fastest, Available (select/url-test/fallback) — existing
- ✓ Сервис-специфичные группы: Discord, YouTube, Telegram, Spotify, Netflix, Twitch — existing
- ✓ Правила для российского трафика (geosite-ru, geoip-ru, domain-suffix .ru/.by/.su) — existing
- ✓ Правила для торрент-клиентов и трекеров — existing
- ✓ Правила для adult-контента (Stripchat, Chaturbate, Bongacams) — existing
- ✓ DNS sniffer с force-dns-mapping — existing
- ✓ Transparent proxy (TPROXY/redirect) на роутере — existing
- ✓ OISD adblock (big + small) — existing
- ✓ GeoIP/GeoSite автообновление — existing
- ✓ Web-dashboard (Zashboard) — existing

### Active

- [ ] Полный рефакторинг структуры конфига: единообразие секций, удаление дубликатов, логичный порядок правил
- [ ] Единообразное именование proxy-groups (конвенция emoji + имя)
- [ ] Консолидация adult-контента в выделенные блоки с маркерами для автоудаления
- [ ] Актуальные списки блокировок РФ: antifilter, MRS community lists, refilter и другие свежие источники
- [ ] Обход DPI и блокировок VPN-протоколов (ECH, фрагментация, маскировка)
- [ ] Скрипт генерации двух конфигов: personal (полный) и work (без adult-блоков)
- [ ] Удаление дубликатов правил (Discord x4, YouTube x17 DOMAIN-SUFFIX, Telegram x8, Cloudflare x17)
- [ ] Аудит неиспользуемых proxy-groups и rule-providers (intel, OSU, BGP, gaming-ips и др.)
- [ ] Исправление ошибок: DST-PORT,53,53, bongacams.ru в двух категориях, OISD big+small дубль

### Out of Scope

- Настройка прокси-серверов — серверы работают, не трогаем
- Миграция на другой прокси-клиент (sing-box и т.д.) — mihomo устраивает
- GUI/автоматизация обновлений конфига — ручное управление
- Мониторинг и алерты — не нужно для домашнего использования

## Context

- Роутер: Keenetic с Entware, mihomo работает как transparent proxy
- Прокси: подписка через HTTP provider, протоколы SS/VMess/Trojan/VLESS
- Текущий конфиг: ~1700 строк config.yaml с существенным техническим долгом
- Основные проблемы из маппинга кодовой базы:
  - Дубликаты правил (одни и те же сервисы определены 3-8 раз разными способами)
  - Adult-контент разбросан по 4+ секциям конфига
  - Непоследовательное именование (emoji/нет emoji, RU/EN, аббревиатуры ST/CB/BG)
  - Слабый пароль dashboard (`admin`)
  - DST-PORT,53,53 — некорректное правило
  - OISD big + small одновременно (дублирование)
  - 20+ внешних источников правил без документации
- Блокировки РФ 2024-2026: Discord, YouTube замедление, торренты, VPN-протоколы, AI-сервисы
- Два сценария использования: личный ПК (всё разрешено) и рабочие устройства (без adult)

## Constraints

- **Формат**: YAML конфиг mihomo (Clash Meta) — один файл config.yaml + rule-set кэши
- **Платформа**: Keenetic роутер с Entware, ограниченные ресурсы (RAM/CPU)
- **Прокси**: Существующие серверы не менять — только правила и группы
- **Совместимость**: Конфиг должен работать с текущей версией mihomo на роутере
- **Скрипт генерации**: Должен работать на Windows (основная ОС) и опционально на роутере

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Один базовый конфиг + скрипт генерации | Проще поддерживать один источник правды, чем два отдельных файла | — Pending |
| Adult-контент маркируется комментариями-границами | Скрипт вырезает блоки между маркерами `# >>> ADULT` и `# <<< ADULT` | — Pending |
| Консолидация правил в RULE-SET подход | Вместо дублирования inline + GEOSITE + DOMAIN-SUFFIX — один RULE-SET на сервис | — Pending |
| Использование antifilter/refilter для свежих списков РФ | Самые актуальные community-maintained списки блокировок | — Pending |

---
*Last updated: 2026-02-25 after initialization*
