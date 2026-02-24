# Coding Conventions

**Analysis Date:** 2026-02-25

## YAML Formatting

**Indentation:**
- Use 2 spaces for indentation (standard YAML)
- Consistent spacing throughout entire configuration

**Example from `config.yaml`:**
```yaml
proxy-groups:
  - name: '🌍VPN'
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Hijacking.png'
    type: select
    use: [subscription]
    proxies:
      - 📶Available
      - ⚡Fastest
```

**Line Structure:**
- Key-value pairs use `key: value` format with space after colon
- Arrays use `-` prefix with space for list items
- Inline arrays use `[item1, item2]` format (no spaces inside brackets)

## Naming Conventions

**Proxy Group Names:**
- Use emoji prefixes for visual categorization: `🌍VPN`, `⚡Fastest`, `📶Available`, `🎮Gaming`
- Service names use proper capitalization: `Netflix`, `Discord`, `Spotify`, `YouTube`
- Russian service names are capitalized: `RU трафик`, `Остальной трафик`, `Игровые Сервера`, `Комьюнити`
- Mixed-case for descriptive groups: `ECH-Refilter`, `Ad-Filter`, `SAFE`, `QUIC`

**Rule Provider Names:**
- Use snake_case for internal provider identifiers: `ru_inline_banned`, `geosite_ru`, `geoip_private`
- Use descriptive names: `telegram_domains`, `discord_voiceips`, `cloudflare_ips`
- Prefix with category when applicable: `oisd_big`, `oisd_small`, `oisd_nsfw_big`
- Use full domain names for external services: `github_ai`, `google_deepmind`

**Rule Set Names:**
- Match provider naming: lowercase with underscores
- Descriptive identifiers reflecting content: `torrent_clients`, `remote_control`, `ru_inside`

## Comment Patterns

**Section Headers:**
- Use bordered comment blocks for major sections with dashes:
```yaml
# ────────────────────────────────────────────────────────────────
# --- SECTION NAME IN CAPS (ENGLISH & RUSSIAN) ---
# ────────────────────────────────────────────────────────────────
```

**Inline Comments:**
- Single `#` with space before comment text
- Explanatory comments appear on same line as configuration:
```yaml
port: 7890 # HTTP прокси-порт для локальных устройств (ПК, телефоны)
allow-lan: true # Разрешить подключение с других устройств в локальной сети
```

**Block Comments:**
- Bilingual comments: English key functionality, Russian explanation
- Example prefix: `# [CATEGORY] - [DESCRIPTION]`
```yaml
# Whatsapp // открывам порты xkeen -ap 443,3478,46420
# ВПН и всякие Anydesk, Rustdesk, Teamviewer в директ (опционально, можно убрать)
```

**Status Indicators in Comments:**
- `✅` for enabled/active features
- `❌` for disabled/skipped features
- `🚫` for blocked/restricted categories
```yaml
- DIRECT # ❌ ПРОПУСК (Для отключения блокировки OISD)
- REJECT # ✅ БЛОКИРОВКА (По умолчанию: блокирует рекламу/трекеры)
```

**Preservation Comments:**
- Explicit markers to prevent modification:
```yaml
# LEAVE THIS LINE!
```

## Organization Patterns

**Global Configuration:**
- Located at top of file in section: "ОБЩИЕ НАСТРОЙКИ СИСТЕМЫ И ИНТЕРФЕЙСА"
- Includes ports, modes, logging, and UI settings
- Bilingual headers in comment blocks

**Proxy Providers Section:**
- Labeled `proxy-providers:`
- Each provider has: name, type, URL, path, interval, health-check config
- Consistent structure across HTTP providers

**Proxy Groups Organization:**
- Groups organized by feature/service rather than routing priority
- Start with system groups: `🌍VPN`, `⚡Fastest`, `📶Available`
- Service-specific groups follow: `Spotify`, `Discord`, `Netflix`, etc.
- Hidden utility group at end: `GLOBAL` (contains full proxy list)
- Each group specifies type (select/url-test/fallback), icon, and proxy list

**Rule Providers Organization:**
- Grouped by function with comment headers:
  - AI & Dev Domains (inline)
  - Cloud/CDN IP Networks (Anton111111 source)
  - Service Domain/IP Lists (Anton111111 source)
  - Discord Networks (voice IPs, domains, IPs)
  - Gaming & Russian Apps
  - Re-filter (ECH logic)
  - Torrents
  - OISD (ad-blocking)
  - Russian/Community rules

**Rules Organization:**
- Numbered sections with comment headers:
  1. QUIC rejection
  2. Service-specific domain rules
  3. Optional shortcuts (Twitch ads)
  4. Torrent rules
  5. Service routing (YouTube, Telegram, Discord)
  6. YouTube domain list
  7. Cloudflare/Discord domains
  8. OSU game domains
  9. WhatsApp ASN rules
  10. IP check services
  11. Adult content services
  12. Cloud/CDN provider IPs
  13. Russian traffic handling
  14. Local network exceptions
  15. Ad-blocking (OISD)
  16. Russian traffic rules
  17. ECH re-filter rules
  18. Cloud provider IP routing
  19. Voice/gaming port routing
  20. User custom rules section (template with examples)

**URL Formatting:**
- Always use complete HTTPS URLs for remote resources
- Patterns: `https://github.com/`, `https://raw.githubusercontent.com/`, `https://cdn.jsdelivr.net/`
- Endpoints documented with descriptions in comments

## Group Type Conventions

**select:**
- Manual selection required by user
- Used for all service-specific groups
- Contains reference to main VPN group or DIRECT option
- Example: Spotify, Discord, Netflix groups

**url-test:**
- Automatic selection based on latency
- Includes tolerance (typically 150ms) and test interval (typically 300s)
- Test URL: `https://cp.cloudflare.com/generate_204`
- Used for `⚡Fastest` group

**fallback:**
- Automatic failover when primary fails
- Uses same health check as url-test
- Used for `📶Available` group

## Path Conventions

**Local Paths:**
- Relative paths from root: `./proxy-providers/subscription.yaml`
- Subdirectories for rule types: `./adblock/`, `./rule-sets/`, `./oisd/`, `./re-filter/`

**Remote URLs:**
- GitHub releases: `https://github.com/{user}/{repo}/releases/latest/download/{file}`
- Raw GitHub content: `https://raw.githubusercontent.com/{user}/{repo}/{branch}/{path}`
- CDN URLs for assets: `https://cdn.jsdelivr.net/gh/{user}/{repo}/{path}`

## Default Values

**Health Check Defaults:**
- Interval: 300 seconds (5 minutes)
- Timeout: 10000 milliseconds
- Expected status: 204 (for Cloudflare)
- Lazy: true (minimal checking when not in use)

**Configuration Defaults:**
- Log level: `silent` (production setting)
- Mode: `rule` (rule-based routing)
- Unified delay: `true`
- IPv6: `true`
- Geo-auto-update: `true`
- Geo-update interval: 168 hours (1 week)
- Keep-alive interval: 30 seconds

## Template Patterns for Custom Rules

**Personal Rules Section:**
Located at end of rules section with comment:
```yaml
# --- ШАБЛОНЫ ДЛЯ ПРЯМОГО СОЕДИНЕНИЯ (DIRECT) ---
# Трафик, который НЕ ДОЛЖЕН идти через прокси.
# ПОРТЫ:
#- DST-PORT,12345,DIRECT # Пример: порт 12345 напрямую
# IP-АДРЕСА/СЕТИ (CIDR):
#- IP-CIDR,1.2.3.4/32,DIRECT,no-resolve # Пример: один IP-адрес напрямую
# ДОМЕНЫ:
#- DOMAIN-SUFFIX,mydirectsite.ru,DIRECT # Пример: все поддомены mydirectsite.ru напрямую
```

Each template includes:
- Category label
- Explanation (Cyrillic)
- Example syntax
- `/32` CIDR notation for single IPs
- Commented-out examples as guide

---

*Convention analysis: 2026-02-25*
