# Codebase Concerns

**Analysis Date:** 2026-02-25

## Security Concerns

**Weak Web UI Password:**
- Issue: Default credentials (`secret: 'admin'`) hardcoded in config
- Files: `config.yaml` (line 25)
- Impact: Anyone with network access to port 9090 can control proxy settings without authentication
- Recommendation: Replace with a strong password; consider using environment variables or external secret management

**Hardcoded Proxy Subscription URL:**
- Issue: Proxy subscription URL is plaintext in config, may contain tokens
- Files: `config.yaml` (line 48)
- Impact: If URL contains auth tokens, they are exposed in plain text; risk of credential leakage if config is shared
- Recommendation: Use environment variables for sensitive URLs; validate the URL doesn't contain inline credentials

**Log Level Set to Silent:**
- Issue: `log-level: silent` (line 17) disables all logging
- Files: `config.yaml` (line 17)
- Impact: Makes debugging difficult; no visibility into proxy behavior or errors; can't detect issues until user reports problems
- Recommendation: Use `info` level for better operational visibility; silent mode hides potential security events

## Tech Debt & Redundancies

**Duplicate Adult Content Site Rules:**
- Issue: Multiple rule formats (DOMAIN-SUFFIX, DOMAIN-REGEX, RULE-SET) for same sites
- Files: `config.yaml` (lines 470-505 proxy groups; lines 621-660 rule-providers; lines 1295-1321 inline rules)
- Examples:
  - Stripchat: defined as `ST` proxy group, `ST_in` rule-provider, and multiple inline DOMAIN-SUFFIX + DOMAIN-REGEX rules (lines 624-632, 1296, 1305)
  - Bongacams: defined as `BG` proxy group, `BG_in` rule-provider, and multiple inline rules (lines 634-645, 1297-1299, 1306-1311)
  - Chaturbate: defined as `CB` proxy group, `CB_in` rule-provider, and inline rules (lines 654-659, 1300, 1312)
- Impact: Redundant rules cause performance overhead; harder to maintain; adult content group rules scattered across config making them difficult to disable for work configs
- Fix approach: Consolidate to single definition per service; use RULE-SET only approach; create separate "adult" category for easy bulk removal

**Duplicate Telegram Rule References:**
- Issue: Telegram appears 8+ times with same destinations
- Files: `config.yaml` (lines 1342, 1376, 1380, 1382-1386, 1303)
- Examples: GEOSITE rule, RULE-SET rules, PROCESS-NAME rules, DOMAIN-REGEX rule
- Impact: Redundant matching; first hit will satisfy rule making others dead code
- Fix approach: Consolidate into single RULE-SET reference

**Duplicate YouTube Domain Definitions:**
- Issue: YouTube domains defined in multiple ways with significant duplication
- Files: `config.yaml` (lines 1341, 1367, 1381-1382, 1393-1409)
- Examples: GEOSITE + RULE-SET + PROCESS-NAME + 17 explicit DOMAIN-SUFFIX rules (yt3.ggpht.com, youtube-ui.l.google.com, etc.)
- Impact: Explicit domain list (lines 1393-1409) makes GEOSITE and youtube RULE-SET redundant; wastes lines and maintenance burden
- Fix approach: Remove explicit DOMAIN-SUFFIX list; rely on GEOSITE and RULE-SET only

**Duplicate Discord Voice IP Rules:**
- Issue: Discord voice traffic defined 4+ separate ways
- Files: `config.yaml` (lines 1127-1135, 1114-1126, 1343, 1357, 1387-1390)
- Examples: discord_vc inline rule, discord_voiceips RULE-SET, discord rule, RULE-SET references
- Impact: Multiple ways to match same traffic; first rule wins making others dormant
- Fix approach: Keep only one comprehensive Discord rule approach

**Duplicate Cloudflare Domain Rules:**
- Issue: Cloudflare domains listed twice in slightly different formats
- Files: `config.yaml` (lines 1411-1427 explicit domains; uses cloudflare-domains RULE-SET)
- Impact: ~17 redundant explicit DOMAIN-SUFFIX rules when RULE-SET should suffice
- Fix approach: Remove explicit list; rely on RULE-SET

**Duplicate Logitech Rules:**
- Issue: Logitech appears as KEYWORD rules and GEOSITE rule
- Files: `config.yaml` (lines 1356, 1517-1520)
- Impact: Redundant matching of same traffic twice
- Fix approach: Keep only one method

**Inconsistent Rule Ordering for Same Services:**
- Issue: Same services (Discord, YouTube, Telegram) have rules appearing multiple times throughout rules section
- Files: `config.yaml` (throughout rules section lines 1291-1671)
- Impact: Violates principle of single ordering; makes config harder to understand
- Fix approach: Group all rules for same service together

## Naming & Categorization Issues

**Inconsistent Proxy Group Names:**
- Issue: Mix of emoji prefixes, plain text, mixed case creates visual clutter
- Files: `config.yaml` (lines 72-595)
- Examples:
  - Emoji only: `🌍VPN`, `⚡Fastest`, `📶Available`
  - Emoji + text: `'Spotify'`, `'Discord'` (no emoji)
  - Mixed: `'RU трафик'`, `'Остальной трафик'`, `'ECH-Refilter'`
  - Uppercase/lowercase inconsistency: `'AI'` vs `'intel'`, `'GitHub'` vs `'github-deepmind'`
- Impact: Hard to scan; inconsistency suggests poor maintenance
- Recommendation: Establish naming convention (e.g., all have emoji + name)

**Unclear Short Names for Adult Services:**
- Issue: Abbreviations `ST`, `CB`, `BG`, `BGP` are opaque
- Files: `config.yaml` (lines 470-505 proxy group definitions)
- Examples:
  - `ST` = Stripchat (but favicon URL at line 477 makes it clear)
  - `CB` = Chaturbate (not intuitive)
  - `BG` = Bongacams (not intuitive)
  - `BGP` = Bongamodels (not intuitive)
- Impact: On work configs shared with colleagues, these are confusing; not immediately obvious these are adult sites
- Recommendation: Use full names or at least establish clear convention; add comments

**Mixed Service Categories:**
- Issue: Same service in multiple categories or unclear categorization
- Files: `config.yaml` (throughout proxy-groups and rules)
- Examples:
  - Bongacams also appears as "Other" (line 1491: `DOMAIN-SUFFIX,bongacams.ru,Other`)
  - Pornhub in "Other" but category-porn in separate RULE-SET (line 1532)
  - Elgato listed twice in Other (lines 1492, 1497)
  - Creatify in both "Other" (1494) and "AI" (1496) - inappropriate for AI group
- Impact: Rule conflicts; unclear intent; adult content not isolated for work configs
- Fix approach: Establish clear adult content category; use separate easy-to-disable rules

## Missing & Outdated Rules

**Icon URL Reliability Issues:**
- Issue: External CDN icons may fail/change without notice
- Files: `config.yaml` (multiple icon lines)
- Examples:
  - GitHub CDN for Qure icons (lines 73, 82, 90, etc.)
  - SVG Repo external link (line 158)
  - 2fasvg GitHub link (line 495)
  - Homarr labs icons (lines 339, 513, 526)
- Impact: UI breaks if CDN is down or changes format; no fallback
- Recommendation: Host icons locally or include fallback

**Incomplete Rule Behavior Definition:**
- Issue: RULE-SET `ru-inside` uses "classical" format but might contain domain rules
- Files: `config.yaml` (line 863-868)
- Format: text, but classical behavior suggests mixed types
- Impact: Possible parsing errors if format doesn't match behavior
- Recommendation: Verify behavior matches actual format

**Port Rule Without Complete Specification:**
- Issue: DST-PORT,53,53 rule appears incomplete
- Files: `config.yaml` (line 1603)
- Current: `- DST-PORT,53,53` (DNS port, action is "53"?)
- Impact: Likely typo; should probably be a named proxy group or DIRECT
- Fix approach: Clarify if this is DNS passthrough; should be `DST-PORT,53,DIRECT` or similar

## Fragile Areas

**Proxy Health Check Dependencies:**
- Issue: Health checks rely on external URLs that may change or be blocked
- Files: `config.yaml` (lines 51-57)
- Health check: `http://www.gstatic.com/generate_204` and `https://cp.cloudflare.com/generate_204`
- Impact: If these endpoints become unavailable, proxy health detection breaks; proxies marked unhealthy incorrectly
- Recommendation: Add multiple fallback health check URLs; document why these specific ones chosen

**Hardcoded Tarkov IP:**
- Issue: Single IP hardcoded for Warframe chat
- Files: `config.yaml` (line 833)
- Rule: `- IP-CIDR,172.232.25.131/32`
- Impact: If IP changes, rule becomes ineffective; single /32 is brittle
- Recommendation: Document why this specific IP; consider if DOMAIN rule possible instead

**GEOIP/GEOSITE Data Currency:**
- Issue: Auto-update interval 86400s (24h) but no check on data age
- Files: `config.yaml` (lines 13-15, various rule-providers with interval: 86400)
- Impact: Old GEO data could cause misrouting; no way to know if update failed
- Recommendation: Add monitoring; log update failures

**Regex Rule Complexity:**
- Issue: Multiple complex DOMAIN-REGEX patterns that may not match all variants
- Files: `config.yaml` (various lines with DOMAIN-REGEX)
- Examples:
  - Line 624: `DOMAIN-REGEX,^([\\w\\-\\.]+\\.)?stripchat\\.com$` won't match non-standard TLDs (stripchat.ru not caught unless explicitly listed)
  - Line 1305: Similar issue with TLD restrictions
- Impact: Some domain variants slip through; especially problematic for adult content if trying to block comprehensively
- Recommendation: Use more permissive patterns or separate rules for common TLD variants

## Scaling & Performance Concerns

**Large GEOSITE Dataset Updates:**
- Issue: Multiple large GEOSITE rule-sets downloading daily (86400s interval)
- Files: `config.yaml` (lines 746-873 multiple mrs/yaml rule providers)
- Impact: Bandwidth usage; potential network strain on router; no apparent rate limiting
- Recommendation: Increase interval to 604800 (7 days) for stable data; or implement delta updates

**OISD Duplicate Size:**
- Issue: Both `oisd_big` and `oisd_small` loaded simultaneously
- Files: `config.yaml` (lines 1214-1241)
- Both used in rules (lines 1607-1610)
- Impact: Overlapping rules in big + small (big likely contains all small); wasted resources
- Recommendation: Use only one; probably keep small

**DNS Port Ambiguity:**
- Issue: Line 1603 `- DST-PORT,53,53` undefined behavior
- Files: `config.yaml` (line 1603)
- Impact: May route all DNS to port "53" (invalid proxy name) causing failures
- Recommendation: Clarify intent; probably should be `DIRECT,no-resolve`

## Potential Rule Conflicts

**RF Filter vs Direct Russian Traffic:**
- Issue: `refilter_domains` (line 1595) and `ru-bundle` (line 1594) may overlap
- Files: `config.yaml` (lines 1594-1595)
- Both routing to "Комьюнити" (Community group)
- Impact: If rules overlap, the first match wins; other is never evaluated
- Recommendation: Clarify if these should be separate or merged

**Adult Content in Multiple Categories:**
- Issue: Bongacams.ru appears as both "Other" (line 1491) and "BG" group (lines 1297-1299)
- Files: `config.yaml` (lines 1297-1299, 1491)
- Impact: First matching rule wins; one will be bypassed
- Fix approach: Remove from "Other" category; keep only in dedicated adult content rules

**Overlapping IP-Based Rules:**
- Issue: Multiple IP rules may match same traffic
- Files: `config.yaml` (various lines with IP-CIDR, IP-ASN rules)
- Examples:
  - Whatsapp ASN rules (lines 1479-1481) may overlap with geosite rule (line 1478)
  - Discord voice IPs appear multiple times (lines 1117-1135, 1387-1389)
- Impact: First match wins; subsequent rules dormant
- Recommendation: Consolidate overlapping IP ranges

## Content Categorization Needs for Work Configs

**Adult Content Not Easily Removable:**
- Issue: Adult sites scattered across config making removal for work configs difficult
- Files: `config.yaml` (multiple locations)
- Locations:
  - Proxy groups: `Sin`, `ST`, `CB`, `BG`, `BGP` (lines 461-505)
  - Rule-providers: `Sin_in`, `ST_in`, `BG_in`, `BGP_in`, `CB_in` (lines 611-660)
  - Inline rules: 18 inline DOMAIN-SUFFIX and DOMAIN-REGEX rules (lines 1295-1321)
  - Cached references: lines 588-592 in GLOBAL group
- Impact: To create work config, must remove from 4+ different sections; error-prone
- Recommendation:
  1. Create dedicated `# ADULT CONTENT SITES` section comment
  2. Consolidate all adult site rules into single rule-provider block
  3. Create single proxy group for adult content
  4. Reference only once in rules
  5. Add comment "REMOVE THIS SECTION FOR WORK CONFIGS"
  6. Provide separate `config-work.yaml` template

**Content Categories Not Explicit:**
- Issue: No clear demarcation of content categories (adult, gambling, streaming, etc.)
- Files: `config.yaml` (rules section)
- Impact: Hard to know which rules to modify for different use cases
- Recommendation: Add section comments:
  - `# === ADULT CONTENT SITES (REMOVE FOR WORK) ===`
  - `# === GAMBLING SITES ===`
  - `# === STREAMING SERVICES ===`
  - `# === RUSSIAN/CIS CONTENT ===`

**Missing Gambling/NSFW Category:**
- Issue: Pornhub, OnlyFans, Fansly rules mixed with general "Other"
- Files: `config.yaml` (lines 1486-1500)
- Impact: Not obviously grouped as adult content; easy to overlook
- Recommendation: Create explicit "🔞NSFW" or "Adult" category

## Data & Config Issues

**Unused Proxy Groups:**
- Issue: Some groups defined but may not be used
- Files: `config.yaml` (proxy-groups section)
- Potentially unused: `'intel'` (line 305), `'OSU'` (line 332), `'BGP'` (line 497 - if separate from BG)
- Impact: Clutters interface; increases cognitive load
- Recommendation: Verify these are used; document if intentional

**Unused Rule-Providers:**
- Issue: Some rule-providers may not be referenced in rules
- Files: `config.yaml` (rule-providers section)
- Examples to verify:
  - `gaming-ips` (line 1138) - used? (gaming-direct and games-direct similar)
  - `ru-app-list` (line 1152)
  - `ru-inside` (line 863)
- Impact: Wasted bandwidth downloading unused rules
- Recommendation: Audit rule-providers against rules section; remove unused

**Icon URL Hardcoding:**
- Issue: All icon URLs are absolute CDN links, not relative
- Files: `config.yaml` (icon lines throughout)
- Impact: Config not portable; if URL structure changes, all icons break
- Recommendation: Use placeholder or document icon URL scheme

## Testing & Validation Gaps

**No Rule Validation:**
- Issue: Config syntax and rule logic not validated on load
- Files: `config.yaml` (entire file)
- Impact: Malformed rules may fail silently or cause unexpected behavior
- Recommendation: Add pre-flight validation script; test rule order and conflicts

**No Documented Rule Testing:**
- Issue: How to verify adult content rules are working/disabled?
- Files: `config.yaml` (no testing docs)
- Impact: Work config may accidentally allow adult content
- Recommendation: Provide test URLs and process for verifying rule functionality

**Health Check Timeout May Be Too Low:**
- Issue: Health check timeout 10000ms (10 seconds) may be too strict for slow networks
- Files: `config.yaml` (line 54)
- Impact: Proxies marked unhealthy on latency; proxies flip between healthy/unhealthy
- Recommendation: Increase to 15000-20000ms for stability

## Maintenance Concerns

**Rule Source Fragmentation:**
- Issue: Rules come from 20+ external sources making maintenance complex
- Files: `config.yaml` (rule-providers section)
- Sources:
  - MetaCubeX (@lines 750, 764, 785, 827, 854, etc.)
  - legiz-ru (@lines 839, 1097, 1149, 1172, 1195, etc.)
  - Anton111111 (@lines 956-1090)
  - itdoginfo (@lines 867, 1247)
  - OMchik33 (@lines 1142, 1163)
  - GitHub releases (various)
- Impact: If source goes down, entire category fails; hard to track which URL serves what
- Recommendation: Create mapping document; consider self-hosting critical rules; add fallback sources

**Inline vs External Rules Split:**
- Issue: Rules defined both inline and externally
- Files: `config.yaml` (various rule-providers)
- Examples: Sin site rules inline (611-620) AND as inline in rules (1295-1304)
- Impact: Confusion about which is authoritative; duplication
- Recommendation: Consolidate to rule-provider approach for all; only inline for simple cases

**No Version Control of GEO Data:**
- Issue: GEOSITE and GEOIP data auto-updates without version tracking
- Files: `config.yaml` (geox-url section)
- Impact: Can't roll back if update breaks routing; no audit trail
- Recommendation: Add versioning; keep local copies; test before deploying

---

*Concerns audit: 2026-02-25*
