# Architecture Research: Mihomo Config Refactoring

**Research Date:** 2026-02-25
**Dimension:** Architecture -- optimal config structure, component boundaries, generation patterns
**Downstream Consumer:** Phase structure in roadmap; refactoring order; build script design

---

## 1. Optimal Section Ordering in config.yaml

### Target Structure (Canonical Order)

Mihomo (Clash Meta) evaluates the config top-down. The logical ordering should follow **dependency resolution**: each section depends only on sections defined above it.

```
config.yaml
  |
  +-- 1. SYSTEM SETTINGS (ports, mode, logging, ipv6, keep-alive)
  +-- 2. SNIFFER (traffic analysis configuration)
  +-- 3. GEO DATA (geox-url, auto-update, geodata-mode)
  +-- 4. PROFILE & UI (external-controller, secret, dashboard, store-selected)
  +-- 5. DNS (if used; currently router handles DNS)
  +-- 6. PROXY PROVIDERS (subscriptions, health-check)
  +-- 7. PROXIES (static nodes, empty if using providers only)
  +-- 8. PROXY GROUPS (base -> service -> utility -> catch-all)
  +-- 9. RULE PROVIDERS (external sources, then inline)
  +-- 10. RULES (matching order: system -> adult -> services -> regional -> local -> adblock -> cdn -> fallback)
```

### Rationale

- **Sections 1-5** are self-contained system settings with no forward references.
- **Section 6** (proxy-providers) must precede proxy-groups because groups reference providers via `use:`.
- **Section 7** (proxies) is a stub (`proxies: []`) but must exist before proxy-groups.
- **Section 8** (proxy-groups) must precede rules because rules reference group names.
- **Section 9** (rule-providers) must precede rules because rules reference `RULE-SET,<provider-name>`.
- **Section 10** (rules) is the final consumer of all prior definitions.

### Current State vs Target

| Section | Current Position | Target Position | Status |
|---------|-----------------|-----------------|--------|
| System settings | Lines 1-22 | 1 | OK |
| Sniffer | Lines 31-39 | 2 | OK |
| Geo data | Lines 63-67 (after proxy-providers) | 3 (before proxy-providers) | MOVE UP |
| Profile & UI | Lines 23-29 | 4 | OK (minor reorder) |
| Proxy providers | Lines 42-62 | 6 | OK |
| Proxies | Line 68 | 7 | OK |
| Proxy groups | Lines 71-596 | 8 | OK |
| Rule providers | Lines 599-1289 | 9 | OK |
| Rules | Lines 1291-1671 | 10 | OK |

**Action needed:** Move `geox-url` block (lines 63-67) above `proxy-providers` for cleaner dependency order. Minor change.

---

## 2. Proxy-Group Naming Conventions

### Current Problems

1. **Inconsistent emoji usage**: Base groups have emoji (`VPN`, `Fastest`, `Available`), but service groups do not (`Discord`, `YouTube`, `Spotify`).
2. **Language mixing**: `RU`, ``, ` `, `` (Russian) alongside `Discord`, `YouTube`, `Other` (English).
3. **Opaque abbreviations**: `ST`, `CB`, `BG`, `BGP` for adult sites -- unclear without context and problematic for work variant.
4. **Case inconsistency**: `AI` (uppercase), `intel` (lowercase), `GitHub` (PascalCase).

### Target Convention

**Pattern:** `<Emoji> <Name>`

**Rules:**
1. Every group MUST have an emoji prefix (for dashboard visual scanning).
2. Service names in English with proper capitalization (PascalCase for compound names).
3. Russian names allowed only for regional groups (`RU `, ` `).
4. Adult groups use full descriptive names (not abbreviations) -- these will be stripped by the generation script anyway.

**Proposed Hierarchy:**

```
--- BASE GROUPS (infrastructure) ---
  VPN                    (top-level selector)
  Fastest                (auto-fastest proxy)
  Available              (auto-fallback proxy)

--- SERVICE GROUPS (by category) ---
  Streaming:
   YouTube
   Netflix
   Twitch
   Spotify
   Tidal
   TikTok

  Social:
   Discord
   Telegram
   Twitter
   Instagram
   Facebook
   LinkedIn
   WhatsApp

  Tech & Dev:
   Google
   Google Play
   Microsoft
   GitHub
   AI

  Cloud & CDN:
   Cloudflare
   Amazon
   Amazon Cloud
   Fastly
   Akamai
   CDN77

  Gaming:
   Steam
   Tarkov
   OSU
   Gaming Servers

  Utility:
   Speedtest
   Remote
   2IP
   Logitech
   NAS

--- ADULT GROUPS (marker-delimited, stripped in work variant) ---
   Stripchat
   Chaturbate
   Bongacams
   Bongamodels
   Sinparty
   NSFW

--- MANAGEMENT GROUPS ---
   Ad-Filter
   ECH-Refilter
   QUIC
   SAFE

--- CATCH-ALL GROUPS ---
   RU Traffic
   Other Traffic
   Community
   Other
```

### Naming Examples (Before -> After)

| Current | Target |
|---------|--------|
| `ST` | ` Stripchat` |
| `CB` | ` Chaturbate` |
| `BG` | ` Bongacams` |
| `BGP` | ` Bongamodels` |
| `Sin` | ` Sinparty` |
| `intel` | ` Intel` |
| `53` | ` DNS-Port` (or remove if unneeded) |
| ` ` | ` ` |
| `Other` | ` Other` |
| `TV` | ` TV` |

### Refactoring Implication

Renaming proxy groups requires updating **every reference** in:
- `proxy-groups[].proxies[]` (groups referencing other groups)
- `rules[]` (every rule target)
- `GLOBAL` group's proxy list

This is a high-impact change best done in one atomic commit.

---

## 3. Rule Ordering Strategy

### Principle: Specificity-First, Frequency-Aware

Mihomo evaluates rules top-to-bottom, first match wins. The optimal ordering balances:
- **Specificity**: More specific rules first (exact domain > suffix > keyword > geo > catch-all).
- **Frequency**: High-traffic matches early to reduce evaluation cycles on router.
- **Safety**: Blocking rules (REJECT) before allow rules to prevent leaks.

### Target Rule Order (10 Phases)

```yaml
rules:
  # ============================================================
  # PHASE 0: SYSTEM & PROTOCOL CONTROL
  # Quick protocol-level decisions. Minimal rules, always evaluated.
  # ============================================================
  - RULE-SET,quic,QUIC                    # QUIC UDP 443 control
  - AND,((NETWORK,UDP),(DST-PORT,135-139)),SAFE   # NetBIOS block

  # ============================================================
  # PHASE 1: LOCAL NETWORK (DIRECT, no-resolve)
  # Private IPs must be caught early to prevent proxy leaks.
  # ============================================================
  - RULE-SET,geoip-private,DIRECT,no-resolve
  - RULE-SET,geosite-private,DIRECT
  - GEOIP,private,DIRECT,no-resolve
  - IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
  - IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
  - IP-CIDR,172.16.0.0/12,DIRECT,no-resolve
  - IP-CIDR,127.0.0.0/8,DIRECT,no-resolve

  # ============================================================
  # PHASE 2: AD-BLOCKING & SECURITY
  # Block unwanted traffic before it reaches service rules.
  # ============================================================
  - RULE-SET,oisd_big,Ad-Filter           # Use ONLY big (superset of small)
  - RULE-SET,hagezi_pro,Ad-Filter

  # >>> ADULT-RULES
  # ============================================================
  # PHASE 3: ADULT CONTENT (marker-delimited)
  # All adult-related rules consolidated here.
  # Stripped entirely in work config variant.
  # ============================================================
  - RULE-SET,adult-sites,NSFW             # Single consolidated rule-set
  - RULE-SET,category-porn,NSFW
  - RULE-SET,oisd_nsfw_big,Ad-Filter
  # <<< ADULT-RULES

  # ============================================================
  # PHASE 4: SERVICE-SPECIFIC ROUTING (high-traffic services first)
  # One RULE-SET per service. No inline DOMAIN-SUFFIX duplicates.
  # ============================================================
  # --- Communication ---
  - OR,((RULE-SET,discord_domains),(RULE-SET,discord_voiceips),(RULE-SET,discord_ips)),Discord
  - OR,((RULE-SET,telegram_domains),(RULE-SET,telegram_ips)),Telegram
  - RULE-SET,whatsapp,WhatsApp

  # --- Video & Streaming ---
  - RULE-SET,youtube,YouTube
  - RULE-SET,youtube-ips,YouTube
  - GEOSITE,netflix,Netflix
  - GEOSITE,twitch,Twitch
  - GEOSITE,tiktok,TikTok
  - GEOSITE,spotify,Spotify
  - GEOSITE,tidal,Tidal

  # --- Social ---
  - GEOSITE,twitter,Twitter
  - GEOSITE,instagram,Instagram
  - GEOSITE,facebook,Facebook
  - GEOSITE,linkedin,LinkedIn

  # --- Tech & Dev ---
  - RULE-SET,github-ai,AI
  - RULE-SET,ai,AI
  - RULE-SET,google-deepmind,AI
  - GEOSITE,google,Google
  - GEOSITE,google-play,Google Play
  - GEOSITE,microsoft,Microsoft
  - GEOSITE,github,GitHub

  # --- Gaming ---
  - GEOSITE,steam,Steam
  - RULE-SET,games-direct,Gaming Servers
  - RULE-SET,tarkov,Tarkov

  # --- Utility ---
  - RULE-SET,speedtest-net,Speedtest
  - RULE-SET,remote-control,Remote

  # ============================================================
  # PHASE 5: TORRENT TRAFFIC
  # ============================================================
  - OR,((RULE-SET,torrent-clients),(RULE-SET,torrent-trackers)),DIRECT
  - RULE-SET,torrent-websites,VPN

  # ============================================================
  # PHASE 6: RUSSIAN & REGIONAL TRAFFIC
  # ============================================================
  - RULE-SET,ru-inline,RU Traffic
  - RULE-SET,ru-inline-banned,TV
  - RULE-SET,ru-inside,Community
  - RULE-SET,ru-outside,RU Traffic
  - RULE-SET,yandex,RU Traffic
  - RULE-SET,mailru,RU Traffic
  - RULE-SET,geosite-ru,RU Traffic
  - RULE-SET,ru-bundle,Community
  - RULE-SET,ru-app-list,RU Traffic
  - RULE-SET,ru-ips,RU Traffic
  - RULE-SET,geoip-ru,RU Traffic
  - RULE-SET,geoip-by,RU Traffic
  - GEOSITE,category-ru,RU Traffic
  - GEOSITE,category-gov-ru,RU Traffic
  - DOMAIN-SUFFIX,ru,RU Traffic
  - DOMAIN-SUFFIX,by,RU Traffic
  - DOMAIN-SUFFIX,su,RU Traffic
  - DOMAIN-SUFFIX,xn--p1ai,RU Traffic
  - GEOIP,RU,RU Traffic,no-resolve

  # ============================================================
  # PHASE 7: ECH / REFILTER
  # ============================================================
  - RULE-SET,refilter_ech,DIRECT
  - RULE-SET,refilter_noech,ECH-Refilter
  - RULE-SET,refilter_ipsum,ECH-Refilter
  - RULE-SET,refilter_domains,Community

  # ============================================================
  # PHASE 8: CLOUDFLARE & CDN/CLOUD IP ROUTING
  # ============================================================
  - RULE-SET,cloudflare-ips,Cloudflare
  - RULE-SET,cloudflare-domains,Cloudflare
  - RULE-SET,meta_ips,Facebook
  - RULE-SET,amazon_ips,Amazon
  - RULE-SET,google_ips,Google
  - RULE-SET,fastly_ips,Fastly
  - RULE-SET,akamai_ips,Akamai
  - RULE-SET,cdn77_ips,CDN77
  - RULE-SET,other_domains,VPN
  - RULE-SET,politic_domains,VPN

  # ============================================================
  # PHASE 9: GAMING PORTS (broad port ranges last)
  # ============================================================
  - OR,((DST-PORT,3478-3480),(DST-PORT,5222-5228),(DST-PORT,50000-65535)),Gaming Servers

  # ============================================================
  # PHASE 10: CATCH-ALL
  # ============================================================
  - MATCH,Other Traffic
```

### Key Changes from Current

1. **Local network rules moved to Phase 1** (currently at lines 1579-1602, too late).
2. **Ad-blocking moved to Phase 2** (currently at lines 1607-1610, after service rules).
3. **Adult content consolidated into Phase 3** with markers.
4. **No more inline DOMAIN-SUFFIX duplicates** for YouTube (17 rules), Discord (24 rules), Cloudflare (17 rules) -- these are covered by RULE-SET and GEOSITE.
5. **DST-PORT,53,53 removed** (broken rule, DNS is handled by router).
6. **OISD small removed** (big is superset).
7. **Single torrent section** (currently duplicated at lines 1337-1339 and 1611-1612).

---

## 4. Rule-Provider Organization: Inline vs HTTP

### Decision Framework

| Use Inline When | Use HTTP When |
|----------------|---------------|
| < 10 rules for a niche service | > 10 rules or community-maintained list |
| Rules change only when you edit config | Rules are updated by external maintainers |
| Complex AND/OR logic (port + IP + protocol) | Simple domain/IP lists |
| Quick testing of new domains | Stable production service matching |
| Custom personal overrides | Standard category matching (geosite, geoip) |

### Target Rule-Provider Structure

```yaml
rule-providers:
  # ===========================================
  # GROUP A: INLINE PROVIDERS (custom, small)
  # ===========================================
  # A.1: System / Protocol
  quic:           # inline, classical, AND logic
  safe-ports:     # inline, classical, AND logic

  # A.2: Custom overrides
  ru-inline:      # inline, classical, domain-suffix list (RU sites not in geosite)
  ru-inline-banned: # inline, classical, banned RU sites needing proxy

  # >>> ADULT-PROVIDERS
  # A.3: Adult sites (marker-delimited)
  adult-sites:    # inline, classical, all adult domains consolidated
  # <<< ADULT-PROVIDERS

  # A.4: Gaming / special
  tarkov:         # inline, classical, domain + process
  discord_vc:     # inline, classical, AND(IP + UDP + port)

  # A.5: Dev/AI custom
  github-ai:      # inline, classical, comprehensive AI/dev list

  # ===========================================
  # GROUP B: HTTP PROVIDERS - GEO DATA (MetaCubeX)
  # ===========================================
  # B.1: Domain-based
  geosite-ru:     # http, domain, mrs
  youtube:        # http, domain, mrs
  telegram_domains: # http, domain, mrs (SINGLE source, not two)
  discord_domains:  # http, domain, mrs
  cloudflare-domains: # http, domain, mrs
  # ... (other geosite providers)

  # B.2: IP-based
  geoip-ru:       # http, ipcidr, mrs
  geoip-by:       # http, ipcidr, mrs
  geoip-private:  # http, ipcidr, mrs
  telegram_ips:   # http, ipcidr, mrs (SINGLE source)
  cloudflare-ips: # http, ipcidr, mrs
  discord_voiceips: # http, ipcidr, mrs

  # ===========================================
  # GROUP C: HTTP PROVIDERS - COMMUNITY LISTS
  # ===========================================
  # C.1: Russian content (itdoginfo, legiz-ru)
  ru-inside:      # http, classical, text
  ru-outside:     # http, classical, text
  ru-bundle:      # http, domain, mrs
  ru-app-list:    # http, classical, yaml

  # C.2: CDN/Cloud IPs (Anton111111)
  akamai_ips:     # http, classical, text
  amazon_ips:     # http, classical, text
  cloudflare_ips: # http, classical, text  -- REMOVE (duplicate of cloudflare-ips)
  # ... (other CDN providers)

  # C.3: Gaming
  games-direct:   # http, classical, yaml
  steam-domain:   # http, domain, yaml

  # C.4: Torrents
  torrent-clients:  # http, classical, yaml
  torrent-trackers: # http, domain, mrs
  torrent-websites: # http, domain, mrs

  # C.5: ECH / Refilter
  refilter_ech:     # http, domain, mrs
  refilter_noech:   # http, domain, mrs
  refilter_ipsum:   # http, ipcidr, mrs

  # ===========================================
  # GROUP D: HTTP PROVIDERS - AD-BLOCKING
  # ===========================================
  oisd_big:       # http, domain, mrs (KEEP only big, remove small)
  oisd_nsfw_big:  # http, domain, mrs (KEEP only big nsfw, remove small)
  hagezi_pro:     # http, domain, mrs
```

### Deduplication Targets

| Current Duplicates | Keep | Remove |
|-------------------|------|--------|
| `telegram-domains` + `telegram_domains` | `telegram_domains` (MetaCubeX mrs) | `telegram-domains` (duplicate source) |
| `telegram-ips` + `telegram_ips` | `telegram_ips` (MetaCubeX mrs) | `telegram-ips` (Anton111111 text, less canonical) |
| `youtube` + `youtube-domains` | `youtube` (MetaCubeX mrs) | `youtube-domains` (Anton111111 text, covered by mrs) |
| `oisd_big` + `oisd_small` | `oisd_big` (superset) | `oisd_small` (subset of big) |
| `oisd_nsfw_big` + `oisd_nsfw_small` | `oisd_nsfw_big` (superset) | `oisd_nsfw_small` (subset) |
| `cloudflare_ips` + `cloudflare-ips` | `cloudflare-ips` (MetaCubeX mrs) | `cloudflare_ips` (Anton111111 text, covered by mrs) |
| `discord_ips` (Anton111111) + `discord_voiceips` + `discord_vc` + `discord` | `discord_domains` + `discord_voiceips` + `discord_ips` | `discord_vc` (inline, covered by voiceips), `discord` (inline, redundant AND logic) |

---

## 5. Adult Content Block Structure

### Design Principle

All adult-related content must be:
1. **Consolidated** in clearly delimited blocks.
2. **Marked** with start/end comment markers for automated stripping.
3. **Self-contained** -- removing the markers and content between them produces a valid config.

### Marker Convention

```yaml
# >>> ADULT                    # Start marker
<content to strip>
# <<< ADULT                    # End marker
```

### Three Locations Requiring Markers

**Location 1: Proxy Groups**
```yaml
proxy-groups:
  # ... base groups, service groups ...

  # >>> ADULT
  - name: 'Stripchat'
    type: select
    use: [subscription]
    proxies: ['VPN', DIRECT]
    icon: '...'
  - name: 'Chaturbate'
    # ...
  - name: 'Bongacams'
    # ...
  - name: 'Bongamodels'
    # ...
  - name: 'Sinparty'
    # ...
  - name: 'NSFW'
    type: select
    use: [subscription]
    proxies: ['VPN', DIRECT]
    icon: '...'
  # <<< ADULT

  # ... management groups, catch-all groups ...
```

**Location 2: Rule Providers**
```yaml
rule-providers:
  # ... non-adult providers ...

  # >>> ADULT
  adult-sites:
    type: inline
    behavior: classical
    payload:
      - DOMAIN-SUFFIX,stripchat.com
      - DOMAIN-SUFFIX,strpst.com
      - DOMAIN-SUFFIX,chaturbate.com
      - DOMAIN-SUFFIX,bongacams.com
      - DOMAIN-SUFFIX,bongacams16.com
      - DOMAIN-SUFFIX,bongamodels.com
      - DOMAIN-SUFFIX,sinparty.com
      - DOMAIN-SUFFIX,onlyfans.com
      - DOMAIN-SUFFIX,fansly.com
      - DOMAIN-SUFFIX,pornhub.com
      - DOMAIN-SUFFIX,pornhub.org
      - DOMAIN-SUFFIX,e-hentai.org
      - DOMAIN-SUFFIX,hanime1.me
      - DOMAIN-KEYWORD,rule34
      - DOMAIN-KEYWORD,pornhub
  # <<< ADULT
```

**Location 3: Rules**
```yaml
rules:
  # ... Phase 0-2 ...

  # >>> ADULT
  - RULE-SET,adult-sites,NSFW
  - RULE-SET,category-porn,NSFW
  - RULE-SET,oisd_nsfw_big,Ad-Filter
  # <<< ADULT

  # ... Phase 4+ ...
```

**Location 4: GLOBAL Group References**
```yaml
  - name: GLOBAL
    type: select
    hidden: true
    proxies:
      # ... non-adult groups ...
      # >>> ADULT
      - 'Stripchat'
      - 'Chaturbate'
      - 'Bongacams'
      - 'Bongamodels'
      - 'Sinparty'
      - 'NSFW'
      # <<< ADULT
```

### Stripping Logic

The generation script removes all lines between `# >>> ADULT` and `# <<< ADULT` (inclusive) to produce the work variant. This is a simple line-based text operation -- no YAML parsing required.

---

## 6. Config Generation Patterns

### Architecture: Single Source -> Multiple Outputs

```
config.yaml (base/personal)
    |
    v
generate.py (or generate.ps1)
    |
    +-- config-personal.yaml  (copy of base, possibly with password change)
    +-- config-work.yaml      (base minus ADULT markers)
```

### Script Design

**Input:** `config.yaml` (single source of truth)
**Output:** Two files in `./output/` directory

**Algorithm:**
```
1. Read config.yaml line by line
2. Track state: inside_adult_block = false
3. For each line:
   a. If line matches "# >>> ADULT": set inside_adult_block = true; skip line
   b. If line matches "# <<< ADULT": set inside_adult_block = false; skip line
   c. If inside_adult_block: skip line
   d. Otherwise: write line to work output
4. Write full file as personal output (optionally with password replacement)
5. Validate both outputs: run basic YAML parse check
```

**Implementation options:**
- **Python** (`generate.py`): Cross-platform, no dependencies, good YAML validation via `pyyaml`.
- **PowerShell** (`generate.ps1`): Windows-native, no install needed, string processing.
- **Bash** (`generate.sh`): Router-native, useful if generating on Keenetic directly.

**Recommended:** Python script with both Windows and router compatibility.

### Script Features

1. **Strip ADULT blocks** -- primary function.
2. **Validate YAML** -- ensure output is valid YAML after stripping.
3. **Replace dashboard password** -- work variant gets a different secret.
4. **Optionally strip comments** -- reduce file size for router deployment.
5. **Report** -- show what was stripped (count of removed lines, groups, rules).

### File Structure After Script

```
d:\AI\antigravity\claude\config\mihomo\
  config.yaml              # Source of truth (personal, full)
  generate.py              # Generation script
  output/
    config-personal.yaml   # Generated: full config (deployed to home router)
    config-work.yaml       # Generated: stripped config (deployed to work router)
  .planning/
    ...
```

---

## 7. Work vs Personal Config Variant Strategy

### Differences Between Variants

| Aspect | Personal | Work |
|--------|----------|------|
| Adult proxy groups | Present (Stripchat, Chaturbate, etc.) | Removed |
| Adult rule-providers | Present (adult-sites, category-porn, oisd_nsfw) | Removed |
| Adult rules | Present | Removed |
| GLOBAL group adult refs | Present | Removed |
| Dashboard password | Weak OK (home network) | Strong required |
| Log level | silent (production) | info (debugging) |
| NSFW OISD | Included | Excluded |

### What Stays the Same

- All non-adult proxy groups and their configuration.
- All non-adult rule-providers and rules.
- System settings, ports, sniffer.
- Proxy provider subscriptions (same servers).
- Russian traffic, gaming, CDN, torrent rules.

### Validation for Work Variant

After generation, the work config must be validated for:
1. **No adult domain references** -- grep for known adult domains (stripchat, chaturbate, bongacams, pornhub, sinparty, fansly, onlyfans, e-hentai, hanime, rule34, category-porn, nsfw).
2. **No orphan group references** -- rules must not reference removed groups.
3. **Valid YAML** -- parse check.
4. **GLOBAL group integrity** -- no references to stripped groups.

---

## 8. Component Boundaries

### Component Map

```
+-----------------------------------------------------------------------+
|                        config.yaml                                      |
|                                                                         |
|  +-------------------+     +-------------------+     +--------------+   |
|  | SYSTEM SETTINGS   |     | PROXY PROVIDERS   |---->| PROXY GROUPS |   |
|  | (ports, mode,     |     | (subscriptions,   |     | (base,       |   |
|  |  sniffer, geo)    |     |  health-check)    |     |  service,    |   |
|  +-------------------+     +-------------------+     |  ADULT*,     |   |
|                                                       |  mgmt,       |   |
|                                                       |  catch-all)  |   |
|                                                       +--------------+   |
|                                                             |            |
|                                                             v            |
|  +-------------------+     +-------------------+     +--------------+   |
|  | RULE PROVIDERS    |---->| RULES             |---->| (references  |   |
|  | (inline, http,    |     | (ordered phases)  |     |  groups by   |   |
|  |  ADULT*)          |     |  ADULT* phase     |     |  name)       |   |
|  +-------------------+     +-------------------+     +--------------+   |
|                                                                         |
|  * = marker-delimited, strippable                                       |
+-----------------------------------------------------------------------+
```

### Dependency Relationships

```
System Settings  -->  (independent, no references)
Proxy Providers  -->  (independent, external URL deps only)
Proxy Groups     -->  depends on: Proxy Providers (via use:), other Groups (via proxies:)
Rule Providers   -->  (independent of groups, external URL deps)
Rules            -->  depends on: Rule Providers (via RULE-SET), Proxy Groups (via group names)
GLOBAL group     -->  depends on: all other Proxy Groups (explicit list)
```

### Coupling Points (Change Propagation)

| If You Change... | Must Also Update... |
|-----------------|---------------------|
| Proxy group name | rules[], GLOBAL.proxies[], any group.proxies[] referencing it |
| Rule-provider name | rules[] RULE-SET references |
| Add new proxy group | GLOBAL.proxies[] list, add at least one rule referencing it |
| Remove proxy group | rules[] (remove references), GLOBAL.proxies[] |
| Add new rule-provider | rules[] (add RULE-SET reference) |
| Rename subscription | proxy-groups[].use[] references |

---

## 9. Suggested Refactoring Order

### Phase 1: Foundation Cleanup (Low Risk, High Value)

**Goal:** Fix bugs and remove dead code without changing behavior.

1. **Fix DST-PORT,53,53** -- broken rule (line 1603). Either remove or correct to `DST-PORT,53,DIRECT`.
2. **Remove duplicate OISD** -- keep only `oisd_big`, remove `oisd_small`. Keep only `oisd_nsfw_big`, remove `oisd_nsfw_small`.
3. **Remove duplicate telegram providers** -- keep `telegram_domains` + `telegram_ips` (MetaCubeX), remove `telegram-domains` + `telegram-ips` (Anton111111).
4. **Remove duplicate youtube providers** -- keep `youtube` (MetaCubeX), remove `youtube-domains` + `youtube-ips` if covered.
5. **Remove duplicate cloudflare IP provider** -- keep `cloudflare-ips` (MetaCubeX mrs), remove `cloudflare_ips` (Anton111111 text).
6. **Remove inline DOMAIN-SUFFIX duplicates** -- remove 17 YouTube domains (lines 1393-1409), 17 Cloudflare domains (lines 1411-1427), 24 Discord domains (lines 1428-1451) that are already covered by RULE-SET/GEOSITE.
7. **Remove duplicate torrent rules** -- single torrent section instead of two (lines 1337-1339 and 1611-1612).
8. **Move geox-url** above proxy-providers.

**Estimated impact:** ~150 lines removed. Zero behavioral change.

### Phase 2: Adult Content Consolidation (Medium Risk)

**Goal:** Isolate all adult content into marker-delimited blocks.

1. **Create consolidated `adult-sites` inline rule-provider** combining Sin_in, ST_in, BG_in, BGP_in, CB_in, and scattered adult DOMAIN-SUFFIX/DOMAIN-REGEX rules.
2. **Add `# >>> ADULT` / `# <<< ADULT` markers** around:
   - Adult proxy groups
   - Adult rule-providers
   - Adult rules in rules section
   - Adult references in GLOBAL group
3. **Remove inline adult rules** from rules section (lines 1295-1321) -- these are now in the consolidated rule-provider.
4. **Move adult content from "Other" group** -- bongacams.ru, pornhub, onlyfans, fansly, hanime, e-hentai, rule34 into adult-sites provider.

**Estimated impact:** ~60 lines moved/consolidated. Adult content in 4 clearly marked blocks.

### Phase 3: Naming Convention & Group Reorder (Medium Risk)

**Goal:** Apply consistent naming across all proxy groups.

1. **Rename all proxy groups** to follow `Emoji Name` convention.
2. **Update all references** (rules, GLOBAL, group cross-references).
3. **Reorder proxy groups** by category (base -> service -> adult -> management -> catch-all).
4. **Remove or audit unused groups** (`intel`, `OSU`, `BGP`, `53`).

**Estimated impact:** Every line with group names changes. Must be atomic.

### Phase 4: Rule Reordering (High Risk)

**Goal:** Implement optimal rule ordering per Phase architecture above.

1. **Move local network rules** to Phase 1 (currently too late).
2. **Move ad-blocking** to Phase 2.
3. **Consolidate service rules** -- one section per service, no duplicates.
4. **Implement 10-phase rule structure**.
5. **Remove dead rules** (rules that never match due to earlier matches).

**Estimated impact:** Complete rewrite of rules section ordering. High risk -- requires testing.

### Phase 5: Generation Script (New Feature)

**Goal:** Automated work/personal variant generation.

1. **Write `generate.py`** with marker stripping logic.
2. **Add YAML validation**.
3. **Add adult content grep check** for work variant.
4. **Create output directory structure**.
5. **Document usage**.

### Phase 6: Advanced Improvements (Optional)

1. **Replace weak dashboard password**.
2. **Add antifilter/refilter fresh sources** for RU blocking lists.
3. **Audit CDN IP providers** -- determine if all Anton111111 lists are needed.
4. **Add DPI bypass configuration** if mihomo supports it.

---

## 10. Build Order for Generation Script

### Script Structure

```python
# generate.py

# 1. Configuration
ADULT_START_MARKER = "# >>> ADULT"
ADULT_END_MARKER = "# <<< ADULT"
INPUT_FILE = "config.yaml"
OUTPUT_DIR = "output"
PERSONAL_OUTPUT = "config-personal.yaml"
WORK_OUTPUT = "config-work.yaml"

# 2. Core Functions
def read_config(path) -> list[str]
def strip_adult_blocks(lines) -> list[str]
def replace_secret(lines, new_secret) -> list[str]
def validate_yaml(lines) -> bool
def check_no_adult_references(lines) -> list[str]  # returns violations
def check_no_orphan_groups(lines) -> list[str]      # returns violations
def write_output(lines, path)

# 3. Main Flow
def main():
    lines = read_config(INPUT_FILE)

    # Personal variant
    personal = lines.copy()
    validate_yaml(personal)
    write_output(personal, PERSONAL_OUTPUT)

    # Work variant
    work = strip_adult_blocks(lines)
    work = replace_secret(work, generate_strong_secret())
    validate_yaml(work)
    violations = check_no_adult_references(work)
    if violations:
        error("Adult content leaked into work config!")
    orphans = check_no_orphan_groups(work)
    if orphans:
        error("Orphan group references found!")
    write_output(work, WORK_OUTPUT)

    print_report(lines, personal, work)
```

### Build Steps

1. **Step 1:** Implement `read_config` + `strip_adult_blocks` + `write_output` -- minimal viable script.
2. **Step 2:** Add `validate_yaml` (requires `pyyaml` or basic bracket/indent check).
3. **Step 3:** Add `check_no_adult_references` with domain keyword list.
4. **Step 4:** Add `check_no_orphan_groups` by parsing group names and rule targets.
5. **Step 5:** Add `replace_secret` and reporting.
6. **Step 6:** Add CLI arguments (`--input`, `--output-dir`, `--work-secret`).

---

## Quality Gate Checklist

- [x] **Patterns clearly defined with examples** -- section ordering, naming conventions, rule ordering phases, inline vs HTTP decision framework, adult content markers, generation script architecture.
- [x] **Refactoring order implications noted** -- 6-phase refactoring order with dependency-aware sequencing (cleanup first, then consolidation, naming, rule reorder, script, advanced).
- [x] **Work/personal variant generation strategy described** -- marker-based stripping, validation pipeline, script structure and build order.

---

*Architecture research completed: 2026-02-25*
