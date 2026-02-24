# Codebase Structure

**Analysis Date:** 2026-02-25

## Directory Layout

```
d:\AI\antigravity\claude\config\mihomo\
├── config.yaml                    # Main Mihomo configuration (1672 lines)
├── .planning/
│   └── codebase/                  # Documentation directory (this project)
└── .git/                          # Git repository metadata
```

## Directory Purposes

**`.planning/codebase/`:**
- Purpose: Architecture and structure analysis documents for this Mihomo config
- Contains: ARCHITECTURE.md, STRUCTURE.md, and future analysis files
- Key files: Gitignored; not deployed to router

**Dynamic Directories (Created by Mihomo):**

The following directories are created by Mihomo at runtime (on the router). They are referenced in rule-providers but do not exist in this repository:

- `./proxy-providers/` - Downloaded proxy subscription cache
- `./rule-sets/` - Downloaded rule set cache files (.mrs, .yaml, .list)
- `./adblock/` - Ad-filter rule sets (OISD, HAGEZI)
- `./oisd/` - OISD domain blocklists (big.mrs, small.mrs, nsfw variants)
- `./re-filter/` - ECH re-filter rules (noech.mrs, ech.mrs, ip-rule.mrs)
- `./ru-bundle/` - Russian domain bundle rules

## Key File Locations

**Entry Points:**

- `config.yaml`: Primary configuration file loaded by Mihomo daemon on startup. Contains all proxy providers, proxy groups, rule providers, and routing rules.

**Configuration Structure:**

1. **System Settings** (lines 1-40):
   - Port bindings: HTTP (7890), SOCKS5 (7891), redirect (7892), TPROXY (7893), dashboard (9090)
   - Mode: `rule` (rule-based routing)
   - Sniffer: Enabled for TLS/QUIC/HTTP domain extraction
   - IPv6: Enabled

2. **Proxy Providers** (lines 42-67):
   - `subscription`: HTTP endpoint with proxy list (URL includes auth token)
   - Health-check: Cloudflare 204 endpoint, 5-minute interval

3. **Proxy Groups** (lines 71-596):
   - Base groups (lines 71-96): 🌍VPN (select), ⚡Fastest (url-test), 📶Available (fallback)
   - Service-specific groups (lines 97-350): Spotify, Discord, Netflix, YouTube, Telegram, Twitter, Instagram, Google, Microsoft, GitHub, AI, Steam, Twitch, TikTok, etc.
   - Management groups (lines 351-487): Ad-Filter, ECH-Refilter, QUIC, SAFE, Remote, NAS, Tarkov, Logitech
   - Catch-all groups (lines 488-596): RU трафик, Остальной трафик, GLOBAL (hidden meta-group)

4. **Rule Providers** (lines 599-1288):
   - **Inline rules** (600-875): Service-specific domain rules (Sin, ST, BG, BGP, CB, UG_NAS, ru-inline-banned, ru-inline, github-ai, discord variants, discord_vc)
   - **HTTP domain rules** (876-1257): geosite-ru, yandex, ai, mailru, category-porn, drweb, telegram-domains, youtube, google-deepmind, cloudflare-domains, discord_domains, ru-inside, ru-outside, steam-domain
   - **HTTP IP rules** (1005-1256): geoip-ru, geoip-by, geoip-private, cloudflare-ips, telegram_ips, CDN provider IPs (akamai, amazon, cdn77, cloudflare, digitalocean, fastly, google, hetzner, mega, meta, oracle, ovh, vultr)
   - **Advanced rules** (1287-1288): QUIC rejection (UDP 443), complex AND/OR logic

5. **Rules** (lines 1291-1671):
   - **Phases** (execution order):
     1. QUIC + UDP port blocking (lines 1293-1294)
     2. Adult/gaming domains (lines 1295-1335)
     3. Torrent handling (lines 1337-1339)
     4. Service routing (lines 1341-1457)
     5. Russian traffic (lines 1539-1596)
     6. Private networks (lines 1579-1603)
     7. Blocking + advanced routing (lines 1605-1629)
     8. CDN/cloud IP routing (lines 1631-1643)
     9. Gaming ports (line 1646)
     10. Fallback/catch-all (line 1671)

## Naming Conventions

**Files:**
- Extension: `.yaml` (Clash/Mihomo uses YAML config format; .yml also supported)
- Pattern: Single monolithic file (`config.yaml`)

**Proxy Groups:**
- Format: Emoji prefix + descriptive name or code
- Examples: `🌍VPN`, `📶Available`, `⚡Fastest`, `Discord`, `YouTube`, `RU трафик`, `Остальной трафик`
- Service groups: Service name or abbreviation (Spotify, Netflix, GitHub, AI, etc.)
- Purpose groups: Ad-Filter, ECH-Refilter, QUIC, SAFE

**Rule Providers:**
- Pattern: Snake_case with suffix indicating type/source
  - `ru-inline`: Russian inline rules
  - `geosite-ru`: Russian geosite domains
  - `geoip-ru`: Russian geoip
  - `akamai_ips`: Akamai CDN IPs
  - `github-ai`: GitHub + AI services inline
  - `discord_vc`: Discord voice chat (advanced logic)
  - `refilter_domains`: Re-filter domain rules
  - `telegram_ips`: Telegram IP rules
- HTTP rule sets: Named by service/category (youtube, telegram-domains, cloudflare-ips)
- Inline rules: Named by service or purpose

**Routing Rules:**
- Format: `RULE-TYPE,rule-value,GROUP-NAME`
- Types: DOMAIN-SUFFIX, DOMAIN-REGEX, DOMAIN-KEYWORD, IP-CIDR, GEOIP, GEOSITE, IP-ASN, PROCESS-NAME, PROCESS-NAME-REGEX, DST-PORT, OR, AND, RULE-SET
- Examples:
  - `DOMAIN-SUFFIX,youtube.com,YouTube`
  - `RULE-SET,telegram_ips,Telegram`
  - `GEOIP,RU,RU трафик,no-resolve`
  - `AND,((RULE-SET,cloudflare-ips),(NETWORK,udp),(DST-PORT,19200-19500)),Discord`

## Where to Add New Code

**New Service Routing (e.g., Adding ProtonVPN routing):**
1. Add proxy group in `proxy-groups` section (after line 596):
   ```yaml
   - name: 'ProtonVPN'
     type: select
     use:
       - subscription
     proxies:
       - 🌍VPN
       - DIRECT
     icon: 'https://...'
   ```
2. Add inline rule or rule set in `rule-providers` (after line 1288):
   ```yaml
   protonvpn:
     type: inline
     payload:
       - DOMAIN-SUFFIX,protonvpn.com
       - DOMAIN-SUFFIX,protomailbox.com
     behavior: classical
   ```
3. Add routing rule in `rules` section (line 1341-1450 service routing phase):
   ```yaml
   - RULE-SET,protonvpn,ProtonVPN
   - GEOSITE,protonvpn,ProtonVPN
   ```

**New Game Server Routing:**
1. Add proxy group in `proxy-groups` (around line 515-530 gaming section):
   ```yaml
   - name: 'Valorant'
     type: select
     use:
       - subscription
     proxies:
       - DIRECT
       - 🌍VPN
   ```
2. Add inline rules or reference rule set in `rule-providers`:
   ```yaml
   valorant:
     type: inline
     payload:
       - DOMAIN-SUFFIX,valorant.com
       - DOMAIN-SUFFIX,valorantcontent.com
     behavior: classical
   ```
3. Add rule in `rules` (line 1615 "ПРАВИЛА ДЛЯ РОССИЙСКОГО ТРАФФИКА" or line 1646 gaming ports):
   ```yaml
   - RULE-SET,valorant,Valorant
   ```

**New Ad-Blocker / Tracking List:**
1. Add rule provider in `rule-providers` (around line 1214 OISD section):
   ```yaml
   custom_blocklist:
     type: http
     behavior: domain
     format: mrs
     url: https://github.com/user/blocklist/releases/latest/download/list.mrs
     path: ./rule-sets/custom_blocklist.mrs
     interval: 86400
   ```
2. Add routing rule in `rules` (line 1607-1610 blocking phase):
   ```yaml
   - RULE-SET,custom_blocklist,Ad-Filter
   ```

**New Regional Traffic Rule:**
1. Define rule provider in `rule-providers` (e.g., around line 746 geosite-ru):
   ```yaml
   geosite-jp:
     type: http
     behavior: domain
     format: mrs
     url: https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-jp.mrs
     path: ./rule-sets/geosite-jp.mrs
     interval: 86400
   ```
2. Add proxy group in `proxy-groups` (around line 259-267 RU трафик section):
   ```yaml
   - name: 'JP Traffic'
     type: select
     proxies:
       - DIRECT
       - 🌍VPN
   ```
3. Add routing rule in `rules` (line 1539-1596 Russian traffic section, or add new section):
   ```yaml
   - RULE-SET,geosite-jp,JP Traffic
   - GEOIP,JP,JP Traffic,no-resolve
   ```

**Custom Inline Domain Rules (For Testing/Quick Add):**
1. Find inline rule provider in `rule-providers` (e.g., line 697 ru-inline)
2. Add payload item:
   ```yaml
   - DOMAIN-SUFFIX,mysite.com
   - DOMAIN-REGEX,^([A-Za-z0-9-]+\.)*mysite\.com$
   ```
3. Reference in rules section:
   ```yaml
   - RULE-SET,ru-inline,RU трафик
   ```

**Port-Based Routing (For Game Servers/Custom Apps):**
1. Add gaming rule provider with complex logic (around line 1114-1126 discord_vc example):
   ```yaml
   custom_ports:
     type: inline
     behavior: classical
     payload:
       - AND,((IP-CIDR,1.2.3.4/32),(NETWORK,udp),(DST-PORT,5000-6000))
   ```
2. Reference in rules:
   ```yaml
   - RULE-SET,custom_ports,Игровые Сервера
   ```

## Special Directories

**External Rule Set Sources (Not in Repository):**

These directories are created at runtime by Mihomo and are gitignored:

- `./proxy-providers/subscription.yaml`: Downloaded proxy list (binary format or YAML)
- `./rule-sets/`: Cache for all HTTP rule sets (*.mrs, *.yaml, *.list files)
- `./adblock/adlist.mrs`: HAGEZI ad-filter blocklist
- `./oisd/`: OISD domain blocklists (small/big/nsfw variants)
- `./re-filter/`: ECH re-filter logic (noech.mrs, ech.mrs, ip-rule.mrs)
- `./ru-bundle/rule.mrs`: Russian domain bundle

**Generated at Startup:**
- `ui/`: Web dashboard files (downloaded from GitHub releases if missing)
- Cache files for health-check results
- Temp files for rule parsing

## Configuration Update Workflow

**Manual Update:**
1. Edit `config.yaml` on router (via SSH or mounted filesystem)
2. Reload Mihomo config: `curl http://127.0.0.1:9090/configs/reload -X PUT -H "Authorization: Bearer admin"`
3. Verify rules/groups loaded: Dashboard shows new groups/rules

**Automatic Update (Rule Sets):**
1. Mihomo checks interval timers: 86400 seconds (daily), 3600 seconds (proxy check every hour)
2. On interval expiry:
   - HTTP rule sets: Re-fetch, parse, cache locally
   - Proxy subscription: Re-fetch, validate, health-check
   - GeoIP/GeoSite: Re-download if `geo-auto-update: true` (weekly)
3. New rules/proxies active immediately; no reload needed

**Deployment to Router:**
1. Version `config.yaml` in this repository
2. Copy to router's Mihomo config directory (typically `/root/.config/Mihomo/config.yaml` or `/etc/mihomo/config.yaml`)
3. Reload via API call or restart Mihomo service
4. Verify traffic routing via dashboard

---

*Structure analysis: 2026-02-25*
