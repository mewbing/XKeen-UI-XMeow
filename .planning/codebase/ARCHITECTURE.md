# Architecture

**Analysis Date:** 2026-02-25

## Pattern Overview

**Overall:** Mihomo (Clash Meta) Rule-Based Traffic Routing with Provider-Based Proxy Selection

**Key Characteristics:**
- Rules-based routing engine that classifies traffic by domain/IP/process and directs to proxy groups
- Hierarchical proxy group structure: base groups (VPN, Available, Fastest) → service-specific groups → catch-all
- Multi-source rule providers combining inline rules, HTTP-fetched rule sets, and GEOSITE/GEOIP databases
- Health-check aware fallback and URL-test groups for proxy reliability
- DNS-centric routing with support for domain sniffing and ECH (Encrypted Client Hello) handling

## Layers

**Proxy Provider Layer:**
- Purpose: Fetch and manage external proxy subscriptions, perform health checks
- Location: `proxy-providers` section in `config.yaml`
- Contains: HTTP subscription endpoints with health-check configuration
- Depends on: External proxy subscription URLs
- Used by: Proxy groups for proxy candidate selection

**Proxy Group Layer:**
- Purpose: Select which proxy/DIRECT path traffic should use; supports manual selection, automatic testing, and fallback logic
- Location: `proxy-groups` section in `config.yaml` (lines 71-596)
- Contains: Select groups (manual), url-test groups (active health check), fallback groups (passive failure detection)
- Examples:
  - Base groups: `🌍VPN` (select), `⚡Fastest` (url-test), `📶Available` (fallback)
  - Service groups: `Discord`, `Telegram`, `YouTube`, `Spotify`, `Netflix`, etc.
  - Filter groups: `Ad-Filter` (OISD adblock selection), `ECH-Refilter` (re-filter management)
  - Catch-all: `Other`, `RU трафик`, `Остальной трафик` (remaining traffic)
- Depends on: Proxy providers for live proxy candidates
- Used by: Rules engine to route traffic

**Rule Provider Layer:**
- Purpose: Define traffic classification rules (domain, IP, process, port matching)
- Location: `rule-providers` section in `config.yaml` (lines 599-1288)
- Contains: Inline rules (direct definitions) and HTTP-based rule sets (remote sources)
- Types:
  - Inline domain rules: `ru-inline`, `github-ai`, custom domain definitions
  - HTTP domain rules: `geosite-ru`, `ai`, `youtube`, `telegram-domains`
  - HTTP IP rules: `geoip-ru`, `geoip-by`, CDN IP lists (Akamai, CloudFlare, AWS, etc.)
  - IP-CIDR rules: `geoip-private`, cloud provider networks
  - Complex rules: `discord_vc`, `discord`, `refilter_ipsum` (AND/OR logic with port matching)
- Depends on: External rule list sources (GitHub, MetaCubeX, community projects)
- Used by: Rules engine for traffic matching

**Rules Engine (Matching & Routing):**
- Purpose: Evaluate traffic against rules in priority order, select matching proxy group
- Location: `rules` section in `config.yaml` (lines 1291-1671)
- Rule priority: Top-to-bottom evaluation; first match wins
- Contains: RULE-SET references, DOMAIN/IP patterns, PROCESS matching, AND/OR logic
- Key phases:
  1. System traffic: QUIC rejection, UDP port blocking (137-139)
  2. Service-specific: Adult sites, game servers, VPN apps
  3. Tarkov: Process name + domain matching
  4. Torrents: Client + tracker + website exclusion
  5. Service routing: YouTube → YouTube group, Telegram → Telegram group, etc.
  6. Cloudflare: IP-based routing to Cloudflare group
  7. Russian traffic: Domain suffixes (.ru, .by, .su), GEOIP-RU
  8. Private networks: Local IPs (192.168.x, 10.x, 172.16.x, 127.x)
  9. Port-based gaming: DST-PORT ranges for game servers (UDP 50000-50100 for Discord voice, etc.)
  10. Fallback: MATCH to `Остальной трафик` group
- Depends on: Rule providers for rule set definitions
- Used by: Mihomo core routing engine

## Data Flow

**Inbound Traffic Classification:**

1. Network packet arrives at Mihomo (via transparent proxy on router)
2. Sniffer extracts metadata: domain name, TLS SNI, QUIC, HTTP Host
3. Mihomo matches packet against rules in sequence:
   - Rule engine tests DOMAIN-SUFFIX, DOMAIN-REGEX, IP-CIDR, GEOIP, GEOSITE, PROCESS-NAME, DST-PORT, AND/OR combinations
   - First rule match determines proxy group assignment
4. Proxy group executes its strategy:
   - `select` group: Returns user-selected proxy or group (stored in profile)
   - `url-test` group: Returns fastest working proxy (based on health-check results)
   - `fallback` group: Returns first working proxy or next in list
5. Traffic is relayed through selected proxy or sent DIRECT
6. Response flows back through proxy (or directly)

**State Management:**
- **Proxy health state:** Maintained per proxy-provider; health-check results cached, interval-based refresh
- **Group selection state:** Stored in profile when `store-selected: true` for manual select groups
- **Rule cache:** Rule sets downloaded and cached locally; updated on interval (usually 86400 = 24 hours)
- **DNS resolution:** Can be sniffer-forced (`force-dns-mapping: true`) or router-handled

**Routing Decision Examples:**

1. YouTube traffic:
   - Domain: `youtube.com` → matches `RULE-SET,youtube,YouTube` (line 1341)
   - YouTube group (select type) → user chooses 🌍VPN or DIRECT → traffic routed

2. Russian domain:
   - Domain: `yandex.ru` → matches `DOMAIN-SUFFIX,yandex.ru,RU трафик` (line 1565)
   - RU трафик group (select type) → user chooses DIRECT or 🌍VPN

3. Discord voice (UDP):
   - IP: 162.158.x.x + UDP + port 50000-50100 → matches `AND,((IP-CIDR,162.158.0.0/15),(NETWORK,udp),(DST-PORT,50000-50100)),Discord` (line 1118)
   - Discord group (select) → routes to selected proxy

## Key Abstractions

**Proxy Group Abstraction:**
- Purpose: Decouples rule engine from specific proxy selection logic
- Examples: `🌍VPN`, `📶Available`, `⚡Fastest`, `Discord`, `YouTube`
- Pattern: Groups can reference other groups (e.g., YouTube group references VPN and DIRECT)
- Types: `select` (manual), `url-test` (auto-fastest), `fallback` (auto-failover)

**Rule Set Abstraction:**
- Purpose: Reusable collections of routing rules with unified behavior
- Examples: `ru-inline` (Russian domains), `github-ai` (AI services), `torrent-clients` (torrent apps)
- Pattern: Rule sets have `type` (inline/http), `behavior` (classical/domain/ipcidr), `format` (mrs/yaml/text)
- Benefit: Centralized management; external rule sets auto-update

**Proxy Provider Abstraction:**
- Purpose: Encapsulates proxy subscription management and health-checking
- Example: `subscription` provider fetches proxies from URL, performs health checks
- Pattern: Multiple proxies grouped; url-test/fallback groups select among them
- Lifecycle: Subscription downloaded on interval, health-checked, stale proxies removed

## Entry Points

**Main Configuration:**
- Location: `d:\AI\antigravity\claude\config\mihomo\config.yaml`
- Triggers: Mihomo daemon startup, configuration reload command
- Responsibilities: Defines all layers (providers, groups, rules), sets system parameters

**System Interface Ports:**
- HTTP proxy: `:7890` (local devices)
- SOCKS5 proxy: `:7891` (local devices)
- Transparent redirect: `:7892` (router TCP/HTTP)
- TPROXY UDP: `:7893` (router UDP)
- Web dashboard: `:9090` (admin UI)

**Traffic Ingress:**
- Transparent proxy on Keenetic router redirects all traffic through ports 7892 (TCP) and 7893 (UDP)
- Mihomo core processes packets through rule engine

## Error Handling

**Strategy:** Fallback-based resilience with health-check feedback loops

**Patterns:**

1. **Proxy Unavailability:**
   - Health-check URL fails (generate_204 not reachable) → Proxy marked unhealthy
   - url-test group removes unhealthy proxy from rotation
   - fallback group tries next proxy in list

2. **Rule Set Update Failure:**
   - HTTP fetch fails for remote rule set → Local cached version retained
   - Interval-based retry on next update cycle (86400 seconds)
   - No rule set = rules not matched (safe-fail; traffic falls through to MATCH)

3. **DNS Failures:**
   - Sniffer cannot extract domain (no SNI/Host header) → Falls back to IP matching
   - GEOIP rules match IP-based traffic when domain unknown
   - Private IP ranges always match GEOIP,private,DIRECT for local traffic

4. **Configuration Errors:**
   - Invalid proxy format in subscription → Parsed proxy skipped
   - Invalid rule syntax → Rule skipped, logged
   - Missing group reference → Rule match fails (safe-fail)

## Cross-Cutting Concerns

**Logging:**
- Level: `log-level: silent` (minimal logs; set to `info` for debugging)
- Output: Mihomo logs to stdout/systemd journal on router

**Validation:**
- Domain/IP format validation in rule sets (inline rules auto-validated on config load)
- Proxy connectivity validation via health-check (interval: 300 seconds)
- YAML syntax validation on config load (Mihomo refuses to start if invalid)

**Authentication:**
- Web dashboard protected by `secret: 'admin'` (weak; should use strong password)
- Proxy subscription URL contains auth token in URL (not standard HTTPS auth)
- No per-rule authentication; all rules applied uniformly

**GeoIP/GeoSite Data:**
- Downloaded from MetaCubeX: `geoip.dat`, `geosite.dat` (or `.mrs` format)
- Updated on interval (geo-update-interval: 168 = weekly)
- Cached locally; used for GEOIP/GEOSITE rule matching

---

*Architecture analysis: 2026-02-25*
