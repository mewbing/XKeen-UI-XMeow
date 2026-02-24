# Pitfalls Research: Mihomo Config Refactoring

**Research Date:** 2026-02-25
**Dimension:** Pitfalls & Common Mistakes
**Scope:** Refactoring mihomo (Clash Meta) config for Keenetic router with Russian blocklist support and work/personal variants

---

## Pitfall 1: Breaking Rule Priority Order During Restructuring

**Risk Level:** CRITICAL
**Phase:** Rules restructuring

### Description

Mihomo uses first-match-wins semantics. When restructuring the rules section, moving rules between numbered sections or reordering blocks changes which rule catches traffic first. The current config has ~380 rules across 7 numbered sections, and the order is load-bearing. For example, adult content rules (lines 1295-1321) are placed before service rules (lines 1341+) intentionally -- moving them after the GEOSITE rules would cause `bongacams.ru` to match `DOMAIN-SUFFIX,ru,RU трафик` (line 1587) instead of the `BG` group.

### Warning Signs

- After refactoring, traffic that previously went through proxy now goes DIRECT (or vice versa).
- Adult content domains resolve to `RU трафик` group instead of their dedicated groups.
- `habr.com` (in `ru-inline-banned`, routed to `TV` group at line 1530) starts matching `DOMAIN-SUFFIX,habr.com` in `ru-inline` (line 672) if rule-provider order changes.
- Refilter/community rules (lines 1594-1596) catch traffic before service-specific rules if moved up.

### Prevention Strategy

1. **Document the current rule evaluation order** as a numbered chain before any changes. Map every rule to what it catches and why its position matters.
2. **Create a test matrix** of 20-30 critical domains with expected proxy group assignments. Test before and after refactoring:
   - `youtube.com` -> YouTube
   - `bongacams.com` -> BG
   - `bongacams.ru` -> BG (NOT `RU трафик`)
   - `habr.com` -> TV (via `ru-inline-banned`)
   - `discord.com` -> Discord
   - `yandex.ru` -> RU трафик
   - `stripchat.com` -> ST
   - `pornhub.com` -> Other
   - `2ip.io` -> 2IP.IO
   - `claude.ai` -> AI
3. **Principle: specific rules before general rules.** Maintain this ordering invariant:
   - QUIC/port blocking (system)
   - Adult content domains (specific, must precede .ru catch-all)
   - Service-specific (Discord, YouTube, Telegram, etc.)
   - Cloudflare/CDN (broad IP ranges)
   - Russian traffic (broad domain suffixes .ru/.by/.su)
   - Private networks
   - Ad-blocking (OISD)
   - Catch-all MATCH
4. **Never move the `DOMAIN-SUFFIX,ru,RU трафик` (line 1587) and `GEOIP,RU` (line 1592) rules higher** -- these are intentionally broad catch-alls that must be evaluated late.

### Applicable Phase

Rules restructuring phase. Must be the first concern addressed before any other rule changes.

---

## Pitfall 2: Renaming Proxy Groups Without Updating All References

**Risk Level:** CRITICAL
**Phase:** Proxy group naming standardization

### Description

Proxy group names are referenced in three places: the `proxy-groups` definition, the `rules` section, and the `GLOBAL` hidden group's proxy list. The current config uses inconsistent naming (`ST`, `BG`, `CB`, `BGP`, `RU трафик`, `Остальной трафик`, `Комьюнити`, `Игровые Сервера`). When renaming groups to follow a consistent emoji+name convention, every reference must be updated simultaneously. Mihomo will refuse to start if a rule references a non-existent proxy group.

### Warning Signs

- Mihomo fails to start after config reload with error like "proxy group 'ST' not found".
- Rules silently fail when group name has subtle Unicode or whitespace differences (e.g., `'RU трафик'` vs `'RU Трафик'`).
- GLOBAL group still lists old names, causing dashboard display issues.
- Rule-set targets still reference old abbreviated names.

### Prevention Strategy

1. **Create a rename mapping table** before starting:
   ```
   ST -> 🔞 Stripchat
   CB -> 🔞 Chaturbate
   BG -> 🔞 Bongacams
   BGP -> 🔞 Bongamodels
   53 -> 🔌 DNS-Port
   ```
2. **Use find-and-replace with exact match** across the entire config. For each rename, search for all three reference locations:
   - `proxy-groups` section: the `name:` field
   - `rules` section: the target group after the last comma
   - `GLOBAL` group: the `proxies:` list
3. **Validate reference count matches.** For example, `BG` appears in:
   - proxy-groups definition (line 488)
   - GLOBAL proxies list (line 591)
   - 6 inline rules (lines 1297-1299, 1306-1311)
   - RULE-SET reference (line 1319)
   Total: 9 references. After rename, exactly 9 must be updated.
4. **Beware YAML quoting rules.** Group names with spaces, colons, or special characters need quotes. `'🔞 Stripchat'` requires quotes; `Discord` does not.
5. **Test config validity with `mihomo -t`** (dry-run) after each batch of renames.

### Applicable Phase

Naming standardization phase. Must be done atomically -- all references for one group renamed in a single commit.

---

## Pitfall 3: Losing Catch-All Coverage (MATCH Rule)

**Risk Level:** HIGH
**Phase:** Rules restructuring

### Description

The current config ends with `MATCH,Остальной трафик` (line 1671). This is the ultimate fallback that catches all unmatched traffic. During refactoring, if new sections are added after MATCH, or if MATCH is accidentally deleted or moved up, traffic will either leak unrouted or get caught by wrong rules. Additionally, if `Остальной трафик` group is renamed but MATCH line is not updated, mihomo will fail.

### Warning Signs

- Random websites stop working (no routing decision made).
- Dashboard shows "connection refused" or timeout errors for previously working sites.
- Mihomo logs show "no matching rule" errors.
- `Остальной трафик` group shows zero connections when it should show many.

### Prevention Strategy

1. **MATCH must always be the absolute last rule.** Add a comment block above it:
   ```yaml
   # !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
   # !!! MATCH MUST BE THE LAST RULE - DO NOT ADD BELOW !!!
   # !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
   - MATCH,Остальной трафик
   ```
2. **Include MATCH validation in any pre-deployment check script.** Verify last non-comment, non-empty line in rules section is `MATCH`.
3. **If renaming `Остальной трафик`**, update the MATCH line in the same atomic operation.

### Applicable Phase

Rules restructuring phase and naming standardization phase. Validate after every refactoring step.

---

## Pitfall 4: Stale Rule-Set Caches After URL Updates

**Risk Level:** HIGH
**Phase:** Rule-set URL update / migration to RULE-SET approach

### Description

Mihomo caches rule-sets locally at the `path:` location. When changing a `url:` in a rule-provider, the local cache at the old path may persist. If the `path:` is not also changed (or cache not cleared), mihomo will continue using the stale cached file until the next successful interval fetch. Worse: if the new URL returns a different format (e.g., switching from `yaml` to `mrs`), the cached file in the old format causes a parsing error. The current config has 50+ rule-providers with paths in `./rule-sets/`, `./oisd/`, `./re-filter/`, `./adblock/`, and `./ru-bundle/`.

### Warning Signs

- After changing a URL, the rule-set still contains old data (verify with dashboard rule-set viewer).
- Format mismatch errors in logs: "failed to parse rule-set" or "unexpected format".
- Anton111111 rule-sets (lines 956-1090) use pinned release tags (`lists-20251102-014123-835e3fe`). Updating to a new release tag but keeping the same `path:` may cause cache confusion.
- `interval: 86400` means worst case you wait 24 hours for the new URL to be fetched.

### Prevention Strategy

1. **When changing a URL, always also change the `path:` to a new filename** (or delete the old cached file on the router before deploying).
2. **When changing `format:` (e.g., from `yaml` to `mrs`), the old cached file MUST be deleted.** The file extension in `path:` should match the new format.
3. **After deploying a config with URL changes, manually trigger a rule-set refresh** via the Web API:
   ```
   PUT http://router:9090/providers/rules/{provider-name}
   ```
4. **For pinned release URLs (Anton111111)**, track the release tag in a comment:
   ```yaml
   # Release: lists-20251102-014123-835e3fe (last checked: 2026-02-25)
   url: https://github.com/Anton111111/rule-lists/releases/download/lists-20251102-014123-835e3fe/akamai_ips.list
   ```
5. **Test format compatibility before deploying.** Download the URL manually, verify it parses as expected format (text/yaml/mrs).

### Applicable Phase

Rule-set migration phase and URL update phase. Critical when switching from inline rules to external RULE-SET providers.

---

## Pitfall 5: Format Mismatches When Migrating Inline Rules to RULE-SET

**Risk Level:** HIGH
**Phase:** Inline-to-RULE-SET migration

### Description

The current config mixes inline rules (type: inline) with HTTP rule-sets. When consolidating inline rules into external RULE-SET files, the `behavior` and `format` must match the content. A `behavior: domain` provider expects plain domain lists; a `behavior: classical` provider expects full rule syntax (e.g., `DOMAIN-SUFFIX,example.com`). The current config already has a mismatch concern: `ru-inside` (line 863) uses `behavior: classical` with `format: text`, which works only because the source file uses classical format. Migrating inline payloads that contain AND/OR/DOMAIN-REGEX rules into a `behavior: domain` rule-set will silently fail.

### Warning Signs

- Rule-set loads but matches no traffic (domains not being caught).
- Logs show parsing warnings about unexpected rule format.
- Complex rules (AND, OR, NOT combinators) stop working after migration.
- IP-CIDR rules placed in `behavior: domain` provider are silently ignored.

### Prevention Strategy

1. **Map each inline rule to the correct behavior type:**
   - `DOMAIN-SUFFIX`, `DOMAIN-KEYWORD`, `DOMAIN` entries -> `behavior: domain` works
   - `DOMAIN-REGEX`, `AND(...)`, `OR(...)`, `IP-CIDR`, `PROCESS-NAME` entries -> MUST use `behavior: classical`
   - Mixed content (like `discord_vc` at line 1114 with AND+IP-CIDR+NETWORK+DST-PORT) -> MUST remain `behavior: classical`
2. **Do not mix behavior types in a single rule-set.** If consolidating Discord rules, keep domain-based rules in one provider (behavior: domain) and IP/port/compound rules in another (behavior: classical).
3. **Inline rules with `format: text` in the payload use Clash format** (one rule per line). When converting to external files, ensure the file matches this format exactly.
4. **Test each migrated rule-set independently** by temporarily adding a test domain to the set and verifying it matches.

### Applicable Phase

RULE-SET consolidation phase. Every inline-to-external migration must validate behavior/format compatibility.

---

## Pitfall 6: Russian Blocklist Conflicts with Direct RU Traffic Rules

**Risk Level:** CRITICAL
**Phase:** Adding Russian blocklists (antifilter, refilter, community lists)

### Description

The config routes Russian traffic DIRECT via multiple broad rules: `DOMAIN-SUFFIX,ru` (line 1587), `GEOIP,RU` (line 1592), `GEOSITE,category-ru` (line 1586), and `ru-inline` domain list. Russian blocklist domains (from antifilter/refilter/community lists) are domains that ARE blocked in Russia and therefore NEED proxy -- but many of these domains are on `.ru` TLD or resolve to Russian IPs. If blocklist rules are placed AFTER the broad Russian DIRECT rules, blocked sites like `habr.com`, `novayagazeta.ru`, `theins.ru`, `tvrain.ru` will match `DOMAIN-SUFFIX,ru,RU трафик` first and go DIRECT (where they are blocked).

This is ALREADY happening in the current config: `habr.com` appears in both `ru-inline-banned` (line 672, routed to `TV` via line 1530) AND in `ru-inline` (line 672, the banned list) vs broad `.ru` catch-all (line 1587). The `ru-inline-banned` RULE-SET at line 1530 is placed before the `.ru` catch-all, which is correct. But `habr.com` is also listed in the `RU трафик` DOMAIN-SUFFIX section at line 1556 (`DOMAIN-SUFFIX,habr.com,RU трафик`), creating a conflict with whichever rule appears first.

### Warning Signs

- Blocked-in-Russia sites (tvrain.ru, novayagazeta.ru) are unreachable despite being in blocklists.
- `habr.com` alternates between proxy and DIRECT depending on which rule matches first.
- Adding new community blocklists (antifilter, re-filter) has no effect on .ru domains.
- DNS leak: blocked domain resolves to a Russian censorship page IP rather than the real IP.

### Prevention Strategy

1. **Blocklist rules MUST be placed BEFORE all broad Russian traffic rules.** The correct order is:
   ```
   1. Service-specific rules (YouTube, Discord, etc.)
   2. Russian BLOCKLIST rules (antifilter, refilter, community) -> proxy
   3. Russian DIRECT rules (geosite-ru, geoip-ru, .ru suffix) -> direct
   4. Catch-all MATCH
   ```
2. **Audit for domain conflicts.** The following domains appear in BOTH Russian direct AND blocked categories in the current config:
   - `habr.com` -- in `ru-inline-banned` (blocked, line 672) AND explicit `DOMAIN-SUFFIX,habr.com,RU трафик` (direct, line 1556). **Must remove from RU direct.**
   - `bongacams.ru` -- in `BG` group (adult, line 1309) AND `DOMAIN-SUFFIX,bongacams.ru,Other` (line 1491). **Must remove from Other.**
   - `yandex.com` / `yandex.kz` -- in `ru-inline` (line 703-704) AND explicit in RU трафик (lines 1547, 1551). **Redundant but not conflicting since same target.**
3. **Use DNS over proxy for blocklist domains.** Blocked domains in Russia may have DNS poisoning. Ensure `sniffer` with `force-dns-mapping: true` is active (currently enabled, line 35) so domain resolution happens correctly.
4. **When adding antifilter/refilter lists, cross-reference with `ru-inline` and explicit RU domain lists.** Remove any domain from the DIRECT lists that appears in a blocklist.
5. **Test with known blocked-in-Russia domains:** `tvrain.ru`, `theins.ru`, `novayagazeta.ru`, `echo.msk.ru` -- all must route through proxy, not DIRECT.

### Applicable Phase

Russian blocklist integration phase. Must be done BEFORE or simultaneously with rules restructuring.

---

## Pitfall 7: DNS Leaks with Russian Blocked Domains

**Risk Level:** HIGH
**Phase:** Adding Russian blocklists and DPI circumvention

### Description

Even if routing rules correctly send blocked traffic through proxy, DNS resolution may still happen locally (through the Keenetic router's DNS). Russian ISPs intercept DNS queries and return censorship page IPs for blocked domains. If mihomo resolves a domain via the router's DNS before applying rules, it gets the censored IP. The sniffer (`force-dns-mapping: true`) helps by extracting the original domain from TLS SNI, but it doesn't work for all protocols (plain HTTP, some UDP traffic).

Additionally, the current config has `DST-PORT,53,53` (line 1603) which is malformed -- the action `53` is not a valid proxy group. This rule likely does nothing or causes an error, leaving DNS traffic uncontrolled.

### Warning Signs

- Blocked websites return the ISP's censorship page despite being routed through proxy.
- `2ip.io` or similar IP-check tools show the proxy IP, but blocked sites still don't work.
- Chrome/browser shows "this site is blocked" page from ISP.
- DNS queries for blocked domains resolve to 95.x.x.x or 100.x.x.x (common Russian censorship IPs).

### Prevention Strategy

1. **Fix the DST-PORT,53 rule immediately.** Change `DST-PORT,53,53` (line 1603) to either:
   - `DST-PORT,53,DIRECT` (if DNS should bypass proxy)
   - Or remove it entirely (DNS handled by router)
2. **For blocked domains, use `no-resolve` flag** on IP-based rules to prevent premature DNS resolution:
   ```yaml
   - GEOIP,RU,RU трафик,no-resolve
   ```
   This is already partially done (line 1592) but should be audited for all IP-matching rules.
3. **Consider adding `fake-ip` mode or DNS-over-HTTPS** for blocked domain resolution. Current config relies on router DNS, which is vulnerable to ISP interception.
4. **Ensure the sniffer catches all relevant protocols.** Currently HTTP, TLS, and QUIC are sniffed (lines 37-39). This is correct for most traffic.
5. **Add `no-resolve` to rule-sets containing IP rules** to prevent DNS resolution before rule matching. Check: `refilter_ipsum`, `geoip-ru`, `cloudflare-ips`, etc.

### Applicable Phase

DPI circumvention phase and rules restructuring phase. The DST-PORT,53 fix should happen in the first phase.

---

## Pitfall 8: Adult Content Leaking into Work Config

**Risk Level:** CRITICAL
**Phase:** Work/personal variant generation

### Description

The plan is to use `# >>> ADULT` / `# <<< ADULT` markers and a script to strip adult content for the work config. The current config has adult content scattered across 4+ sections (proxy-groups, rule-providers, inline rules, GLOBAL group). If ANY of these locations is missed by the markers, adult content rules will remain in the work config. Worse: some adult domains are in non-obvious locations:

- `bongacams.ru` in `Other` group rules (line 1491) -- not in the adult section
- `pornhub.com` and `pornhub.org` in `Other` rules (lines 1489-1490, 1495) -- labeled "necessary services"
- `category-porn` RULE-SET (line 1532) in the "blocked sites" section -- routes to `Other`, not to an adult group
- `onlyfans.com`, `fansly.com` in `Other` rules (lines 1486-1487)
- `hanime1.me`, `e-hentai.org` in `Other` rules (lines 1498-1499, 1510-1511)
- `rule34` DOMAIN-KEYWORD in `Other` rules (line 1521)
- `oisd_nsfw_small` and `oisd_nsfw_big` ad-filter lists (lines 1228-1241, used at lines 1609-1610)

### Warning Signs

- Work config still contains domains like `pornhub.com`, `onlyfans.com`, `rule34`, `e-hentai`.
- Proxy group names `ST`, `CB`, `BG`, `BGP`, `Sin` still visible in work config dashboard.
- Work config references `category-porn` RULE-SET.
- OISD NSFW lists still loaded in work config (wastes bandwidth even if not matching).
- A colleague looks at the dashboard and sees `bongacams` or `stripchat` icons.

### Prevention Strategy

1. **Consolidate ALL adult content into clearly marked sections BEFORE creating the generation script.** Every adult-related item must be within markers:
   - Proxy groups: `Sin`, `ST`, `CB`, `BG`, `BGP` and ALL their references
   - Rule providers: `Sin_in`, `ST_in`, `BG_in`, `BGP_in`, `CB_in`, `category-porn`
   - OISD NSFW lists: `oisd_nsfw_small`, `oisd_nsfw_big`
   - Inline rules: ALL lines routing to adult groups
   - `Other` group rules containing adult domains: `pornhub`, `onlyfans`, `fansly`, `hanime1`, `e-hentai`, `rule34`, `bongacams.ru`
   - GLOBAL group entries for adult proxy groups (lines 588-592)
2. **Create an explicit adult domain audit checklist.** Search config for these keywords after script runs:
   ```
   pornhub, onlyfans, fansly, stripchat, chaturbate, bongacams,
   bongamodels, sinparty, hanime, e-hentai, rule34, nsfw, porn,
   category-porn, adult, xxx, hentai
   ```
3. **The generation script must validate output.** After stripping adult blocks, grep the output for any of the above keywords. If found, script should fail with error.
4. **Adult proxy group icons contain revealing URLs** (e.g., `sinparty.com/favicon.ico`, `ru.stripchat.com/favicon.ico`). These must also be removed.
5. **Rename adult groups from abbreviations to explicit names** (`ST` -> `Stripchat`) so they are easier to identify and ensure complete removal.

### Applicable Phase

Adult content consolidation phase (must happen BEFORE generation script creation). Script validation testing must happen in the testing phase.

---

## Pitfall 9: Duplicate Rules Causing Silent Performance Degradation

**Risk Level:** MEDIUM
**Phase:** Rules deduplication and RULE-SET consolidation

### Description

The current config has massive duplication (documented in CONCERNS.md): YouTube defined 17+ ways, Discord 4+ ways, Telegram 8+ ways, Cloudflare 17+ explicit domains alongside RULE-SET. When consolidating to RULE-SET approach, the danger is removing the WRONG instance. If the effective (first-matched) rule is removed but a later duplicate remains, routing still works but through a different rule path -- potentially with wrong group assignment or performance implications.

Example: `RULE-SET,youtube,YouTube` appears at BOTH line 1341 AND line 1381. Removing line 1341 means YouTube traffic now matches at line 1367 (`GEOSITE,youtube,YouTube`) first -- which may have slightly different domain coverage than the `youtube` rule-set.

### Warning Signs

- After deduplication, some edge-case domains for a service stop routing correctly.
- `stable.dl2.discordapp.net` (line 1398, currently routed to YouTube -- likely a mistake!) loses routing after YouTube domain list cleanup.
- PROCESS-NAME rules for Discord/Telegram removed but desktop apps need them for non-domain traffic.
- Performance unchanged despite removing "duplicate" rules (the removed rules were already dead code, not the effective ones).

### Prevention Strategy

1. **Before removing any rule, verify it is truly redundant** by checking if an earlier rule already catches the same traffic. Use the dashboard connection log to verify which rule is actually matching.
2. **Keep PROCESS-NAME rules even when RULE-SET covers domains.** Process-name matching catches traffic that doesn't have a domain (direct IP connections from desktop apps like Discord.exe, Telegram.exe).
3. **Investigate `stable.dl2.discordapp.net` routed to YouTube** (line 1398). This is likely a copy-paste error -- a Discord CDN domain accidentally in the YouTube section. Fix this during deduplication.
4. **When choosing between GEOSITE and RULE-SET for the same service**, prefer RULE-SET from MetaCubeX/community sources as they tend to be more comprehensive and regularly updated.
5. **Deduplicate one service at a time** and test after each service cleanup. Do not batch-remove all duplicates at once.

### Applicable Phase

Rules deduplication phase. One service per iteration with testing between each.

---

## Pitfall 10: DPI Circumvention Breaking Existing Routing

**Risk Level:** HIGH
**Phase:** DPI circumvention (ECH, fragmentation, protocol masking)

### Description

Russian DPI (TSPU) actively blocks VPN protocols, and adding circumvention measures (ECH support, TLS fragmentation, protocol disguising) can interfere with existing routing logic. The current config already handles ECH partially via `refilter_ech` / `refilter_noech` rule-sets and the `ECH-Refilter` proxy group. Problems arise when:

1. ECH-capable domains (from `refilter_ech`) should go DIRECT (using browser ECH), but are caught by earlier proxy rules.
2. Enabling TLS fragmentation on mihomo may break connections to some legitimate services.
3. Protocol masking (e.g., using reality/xtls on VLESS) changes proxy behavior that health-checks don't test for.
4. The `QUIC` group (line 1293) REJECTs all UDP:443 traffic -- this blocks ECH-over-QUIC.

### Warning Signs

- ECH-capable sites (those on Cloudflare with ECH) that should work DIRECT now fail.
- Some sites intermittently work/fail due to DPI detection triggering mid-session.
- Health checks pass but actual browsing through proxy fails (DPI blocks data flow but not health check pattern).
- QUIC rejection causes video streaming quality degradation on sites that support QUIC (YouTube, Google).

### Prevention Strategy

1. **Understand the ECH rule flow.** Currently:
   - `refilter_ech` -> DIRECT (line 1626): ECH-capable domains bypass proxy
   - `refilter_noech` -> ECH-Refilter group (line 1628): Non-ECH domains go through configurable group
   - But these rules are at lines 1626-1629, AFTER service-specific rules. YouTube traffic will never reach the refilter rules because it matches `RULE-SET,youtube,YouTube` at line 1341 first.
2. **The QUIC REJECT rule (line 1293) conflicts with ECH-over-QUIC.** If enabling ECH for Cloudflare-fronted domains, QUIC must be allowed for those domains. Consider changing QUIC from blanket REJECT to selective (only reject for specific services where QUIC causes issues).
3. **Do not enable TLS fragmentation globally.** It should be a per-proxy setting, not a global config change. Test fragmentation on one proxy server first.
4. **When adding DPI circumvention proxies**, test health-checks specifically through those proxies. Standard health-check URLs (cloudflare generate_204) may pass while real traffic fails.
5. **Document which proxy servers support which circumvention methods.** The subscription provider delivers proxies with various protocols (SS/VMess/Trojan/VLESS). Not all support ECH/fragmentation.

### Applicable Phase

DPI circumvention phase. Must coordinate with QUIC rule changes and ECH rule positioning.

---

## Pitfall 11: Rule-Set URL Sources Going Offline or Changing Format

**Risk Level:** MEDIUM
**Phase:** Rule-set URL updates and ongoing maintenance

### Description

The config depends on 20+ external GitHub sources. The Anton111111 rule-lists use a PINNED release tag (`lists-20251102-014123-835e3fe`) from November 2025 -- this will not auto-update. Other sources use `raw.githubusercontent.com/.../{branch}/...` which can break if the repo restructures. GitHub raw URLs have rate limits and can return 403 errors. The `legiz-ru/mihomo-rule-sets` repo is a single maintainer project -- if abandoned, all rule-sets from that source become stale.

### Warning Signs

- Rule-set update logs show 404 or 403 errors (check with log-level: info).
- Dashboard shows rule-set last updated date is weeks/months old.
- New blocked domains not caught (stale blocklists).
- Cached files on router growing old but no errors visible (because `log-level: silent`).

### Prevention Strategy

1. **Change `log-level` from `silent` to at least `warning`** during and after refactoring to catch update failures.
2. **For Anton111111 pinned releases, create a periodic check** (monthly) to see if new releases are available. Add a comment with the pin date:
   ```yaml
   # PINNED: 2025-11-02. Check for updates: https://github.com/Anton111111/rule-lists/releases
   ```
3. **Identify single-maintainer repos and document alternatives:**
   - `legiz-ru/mihomo-rule-sets` -> backup: MetaCubeX equivalents where available
   - `OMchik33/custom-rules` -> backup: document what IPs/domains are needed
   - `itdoginfo/allow-domains` -> backup: antifilter.download alternatives
4. **Consider self-hosting critical rule-sets** on a personal GitHub repo or local server. Fork the most critical ones (refilter, ru-bundle, torrent lists).
5. **Set `interval` appropriately:**
   - Stable geo-data: 604800 (7 days)
   - Community blocklists: 86400 (24 hours) -- current setting is fine
   - Pinned releases: 604800 (7 days) or even longer -- they won't change

### Applicable Phase

Rule-set URL update phase. The monitoring improvements should persist into ongoing maintenance.

---

## Pitfall 12: OISD Big + Small Overlap Causing Rule Bloat on Router

**Risk Level:** MEDIUM
**Phase:** Ad-blocking optimization

### Description

The current config loads OISD big AND small simultaneously (lines 1214-1241, used at lines 1607-1610), plus OISD NSFW big AND small. OISD big is a superset of OISD small. Loading both wastes RAM on the Keenetic router (constrained resources) and doubles the rule evaluation time for ad-blocking with zero additional coverage. Additionally, the `hagezi_pro` ad filter (line 662) is defined but may not be referenced in the rules section (needs verification).

### Warning Signs

- Router memory usage higher than expected.
- Rule evaluation latency increases (noticeable on high-traffic periods).
- Ad-blocking works the same after removing one of the overlapping lists.
- Router becomes unresponsive during rule-set updates (four large downloads simultaneously).

### Prevention Strategy

1. **Keep only OISD big, remove OISD small.** (Or keep only small if memory is tight.)
2. **Keep only OISD NSFW big OR small** for the personal config. Remove NSFW entirely for work config.
3. **Verify `hagezi_pro` is referenced** in the rules section. If not, remove the provider definition.
4. **Stagger update intervals** for large rule-sets to avoid simultaneous downloads:
   ```yaml
   oisd_big: interval: 86400
   refilter_domains: interval: 90000
   geosite-ru: interval: 93600
   ```
5. **Monitor router resource usage** before and after removing duplicate ad-block lists.

### Applicable Phase

Ad-blocking optimization sub-phase within rules restructuring. Low-risk change, good early win.

---

## Pitfall 13: Generation Script Marker Boundary Errors

**Risk Level:** HIGH
**Phase:** Work/personal config generation script

### Description

The planned `# >>> ADULT` / `# <<< ADULT` marker approach for stripping adult content requires precise placement. YAML is whitespace-sensitive. If a marker is placed inside an array (between list items) rather than at a section boundary, removing lines between markers can break YAML structure. Example: if the marker is inside the `GLOBAL` group's proxy list:

```yaml
proxies:
  - 'ECH-Refilter'
  # >>> ADULT
  - 'Sin'
  - 'ST'
  # <<< ADULT
  - 'QUIC'
```

Stripping lines between markers leaves:
```yaml
proxies:
  - 'ECH-Refilter'
  - 'QUIC'
```

This works. But if the marker is placed incorrectly:
```yaml
proxies:
  - 'ECH-Refilter'
# >>> ADULT
  - 'Sin'
  - 'ST'
# <<< ADULT
  - 'QUIC'
```

Stripping leaves:
```yaml
proxies:
  - 'ECH-Refilter'
  - 'QUIC'
```

This also works, but if the indentation of the remaining lines is wrong after the strip, YAML parsing fails.

### Warning Signs

- Work config fails YAML validation after generation.
- Missing closing marker causes everything below it to be stripped.
- Duplicate or nested markers cause unpredictable behavior.
- Script works on Windows (CRLF) but fails when deployed to router (LF line endings).

### Prevention Strategy

1. **Markers must be at the same indentation level as surrounding content:**
   ```yaml
     # >>> ADULT
     - 'Sin'
     - 'ST'
     # <<< ADULT
   ```
2. **Use multiple marker pairs for different sections** (not one huge block):
   - `# >>> ADULT-GROUPS` / `# <<< ADULT-GROUPS` for proxy-groups
   - `# >>> ADULT-PROVIDERS` / `# <<< ADULT-PROVIDERS` for rule-providers
   - `# >>> ADULT-RULES` / `# <<< ADULT-RULES` for rules section
   - `# >>> ADULT-GLOBAL` / `# <<< ADULT-GLOBAL` for GLOBAL group entries
3. **The generation script must:**
   - Validate matching open/close markers (every `>>>` has a `<<<`)
   - Validate YAML syntax of the output
   - Handle both CRLF and LF line endings
   - Check for zero adult-related keywords in the work output
4. **Test the script with the current config structure** before beginning refactoring. If the script works with the messy current config, it will definitely work with the clean refactored version.
5. **Add a `--validate` flag to the script** that checks the output without writing it.

### Applicable Phase

Generation script development phase. Script design should happen early; implementation after adult content consolidation.

---

## Pitfall 14: Refilter/Antifilter Rules Overlapping with Community Rules

**Risk Level:** MEDIUM
**Phase:** Russian blocklist integration

### Description

The current config uses three overlapping Russian blocklist sources:
- `ru-bundle` (line 1278) -> `Комьюнити` group
- `refilter_domains` (line 835) -> `Комьюнити` group
- `ru-inside` (line 863) -> `Комьюнити` group
- `ru-inline-banned` (line 669) -> `TV` group

These sources may contain the same domains, creating multiple rule evaluations for the same traffic. More critically, `ru-inside` uses `behavior: classical` with `format: text` and routes to `Комьюнити`, while `ru-inline-banned` (inline, classical) routes to `TV`. If the same domain appears in both lists, the first-matched rule wins, potentially sending traffic to the wrong group.

### Warning Signs

- Adding antifilter lists causes some sites to switch from `TV` group to `Комьюнити` group.
- Community sources have different opinions on whether a domain is blocked (some may lag behind actual censorship changes).
- New blocklist additions don't change behavior because older rules catch the same traffic first.

### Prevention Strategy

1. **Choose one primary blocklist source** and use others only as supplements. Recommended hierarchy:
   - Primary: `refilter_domains` (most actively maintained for Russian censorship)
   - Supplement: `ru-bundle` (broader community list)
   - Specialized: `ru-inline-banned` (for specific sites needing special group assignment like anime -> `TV`)
2. **Assign all general blocklist rules to the same proxy group** (e.g., `Комьюнити`). Only use different groups when there is a specific routing need (like `TV` for streaming sites).
3. **Audit overlap** by downloading the lists and comparing domain contents. Document which source covers what.
4. **When adding antifilter.download lists**, check if they duplicate refilter_domains content. The antifilter project and refilter project have different approaches -- antifilter is IP-based, refilter is domain-based.

### Applicable Phase

Russian blocklist integration phase. Audit should happen before adding new sources.

---

## Pitfall 15: DOMAIN-KEYWORD Rules Creating Overly Broad Matches

**Risk Level:** MEDIUM
**Phase:** Rules restructuring and deduplication

### Description

The config uses `DOMAIN-KEYWORD` rules extensively (40+ instances). These match ANY domain containing the keyword as a substring. Overly broad keywords cause unintended matches:

- `DOMAIN-KEYWORD,discord` (line 1132) matches `discord.com` but also `discordmerchshop.example.com` or any future domain with "discord" in it.
- `DOMAIN-KEYWORD,copilot` (line 892) matches `copilot.microsoft.com` but also `copilot-insurance.com`.
- `DOMAIN-KEYWORD,premier` (line 724 in ru-inline) matches Russian `premier.one` but also `premierleague.com` (UK football).
- `DOMAIN-KEYWORD,anker` (line 1506) matches `anker.com` but also `bankers-trust.com`.
- `DOMAIN-KEYWORD,logi` (line 1518) matches `logitech.com` but also `logicgate.com`, `logistics.fedex.com`.

### Warning Signs

- Unrelated domains being routed through wrong proxy groups.
- Dashboard shows unexpected domains in service groups (e.g., `premierleague.com` in `RU трафик`).
- Broad keywords like `logi`, `premier`, `anker` catch CDN or unrelated subdomains.

### Prevention Strategy

1. **Replace DOMAIN-KEYWORD with DOMAIN-SUFFIX where possible:**
   - `DOMAIN-KEYWORD,discord` -> `DOMAIN-SUFFIX,discord.com` + `DOMAIN-SUFFIX,discordapp.com` + ...
   - `DOMAIN-KEYWORD,copilot` -> specific DOMAIN-SUFFIX rules for known copilot domains
2. **If DOMAIN-KEYWORD is necessary, use the inline `discord` rule pattern** (line 1132) with NOT combinator:
   ```yaml
   AND,((DOMAIN-KEYWORD,discord),(NOT,((DOMAIN-SUFFIX,ru))))
   ```
3. **Audit each DOMAIN-KEYWORD for false positives.** Priority keywords to check:
   - `premier`, `anker`, `logi`, `copilot`, `claude`, `bard`, `gemini` (common English words)
   - `ozon`, `wink`, `okko` (short, could match substrings)
4. **In the refactored config, prefer RULE-SET approach over DOMAIN-KEYWORD** for services with known domain lists.

### Applicable Phase

Rules deduplication and restructuring phase. Keyword audit should happen during service-by-service consolidation.

---

## Summary: Phase Mapping

| Pitfall | Phase | Priority |
|---------|-------|----------|
| 1. Breaking rule priority order | Rules restructuring | CRITICAL - First |
| 2. Renaming proxy groups without updating references | Naming standardization | CRITICAL |
| 3. Losing MATCH catch-all coverage | Rules restructuring | HIGH |
| 4. Stale rule-set caches after URL updates | Rule-set migration | HIGH |
| 5. Format mismatches in RULE-SET migration | RULE-SET consolidation | HIGH |
| 6. Russian blocklists vs. direct RU traffic | Russian blocklist integration | CRITICAL |
| 7. DNS leaks with blocked domains | DPI circumvention | HIGH |
| 8. Adult content leaking into work config | Work/personal variant generation | CRITICAL |
| 9. Duplicate rules and deduplication errors | Rules deduplication | MEDIUM |
| 10. DPI circumvention breaking routing | DPI circumvention | HIGH |
| 11. External rule-set sources going offline | Rule-set URL updates | MEDIUM |
| 12. OISD big+small overlap | Ad-blocking optimization | MEDIUM - Quick win |
| 13. Generation script marker errors | Generation script development | HIGH |
| 14. Overlapping Russian blocklist sources | Russian blocklist integration | MEDIUM |
| 15. DOMAIN-KEYWORD overly broad matches | Rules restructuring | MEDIUM |

### Recommended Phase Order (Risk-Aware)

1. **Phase 0 -- Immediate fixes:** DST-PORT,53 bug, OISD dedup, habr.com conflict (Pitfalls 7, 12, 6)
2. **Phase 1 -- Adult consolidation:** Move all adult content into marked sections (Pitfall 8)
3. **Phase 2 -- Naming standardization:** Rename groups atomically with reference validation (Pitfall 2)
4. **Phase 3 -- Rules restructuring:** Reorder with priority invariant, deduplicate per-service (Pitfalls 1, 3, 9, 15)
5. **Phase 4 -- RULE-SET migration:** Convert inline to external, validate formats (Pitfalls 4, 5)
6. **Phase 5 -- Russian blocklists:** Add antifilter/refilter, audit conflicts (Pitfalls 6, 14)
7. **Phase 6 -- DPI circumvention:** ECH rules, QUIC policy, fragmentation (Pitfalls 7, 10)
8. **Phase 7 -- Generation script:** Markers, validation, testing (Pitfalls 8, 13)
9. **Phase 8 -- Maintenance setup:** URL monitoring, source documentation (Pitfall 11)

---

*Research completed: 2026-02-25*
*Source: Analysis of config.yaml (1672 lines), CONCERNS.md, ARCHITECTURE.md, CONVENTIONS.md, INTEGRATIONS.md, TESTING.md*
