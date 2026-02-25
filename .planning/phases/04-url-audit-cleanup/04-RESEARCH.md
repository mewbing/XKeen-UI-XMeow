# Phase 4: URL Audit & Cleanup - Research

**Researched:** 2026-02-25
**Status:** Complete

## Domain Analysis

### What This Phase Must Accomplish

Phase 4 addresses 4 requirements (URL-01 through URL-04):
1. **URL-01**: Update Anton111111/rule-lists URLs to latest release
2. **URL-02**: Identify and remove unused rule-providers (orphan check)
3. **URL-03**: Verify all rule-provider URLs return HTTP 200
4. **URL-04**: Change web-dashboard password from 'admin'

### Current State of config.yaml URLs

**Total rule-providers:** 62 (confirmed by Phase 2 cleanup)
**RULE-SET references in rules:** 62 (perfect match, 0 orphans, 0 missing)

### URL Categories

#### 1. Anton111111/rule-lists (16 URLs) -- NEED UPDATE

Current tag: `lists-20251102-014123-835e3fe` (November 2, 2025)
Latest tag: `lists-20260222-003136-835e3fe` (February 22, 2026)
**Gap: ~3.5 months behind**

Files used in config (all confirmed present in latest release):
- akamai_ips.list
- amazon_ips.list
- cdn77_ips.list
- digitalocean_ips.list
- fastly_ips.list
- google_ips.list
- hetzner_ips.list
- mega_ips.list
- meta_ips.list
- oracle_ips.list
- ovh_ips.list
- vultr_ips.list
- other.list
- politic.list
- telegram_ips.list
- ru_ips.list

**Update strategy:** Simple string replacement of the tag in all 16 URLs.
The file names have NOT changed between old and new releases.

New files available in latest release (not currently used):
- arelion_ips.list, azure_ips.list, bunnycdn_ips.list, cloudflare_ips.list,
  cn.list, cn_ips.list, colocrossing_ips.list, contabo_ips.list,
  discord_ips.list, domains.list, frantech_ips.list, gcore_ips.list,
  leaseweb_ips.list, linode_ips.list, liquidweb_ips.list, scaleway_ips.list,
  vodafone_ips.list, youtube.list, youtube_ips.list, bypass.list
These are NOT needed for this phase (no orphan issues), but noted for reference.

#### 2. MetaCubeX/meta-rules-dat (18 URLs) -- ON `meta` BRANCH

All use `raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/...`
The `meta` branch is a continuously updated branch (not a tag). These are already "latest" by design.
**No action needed.**

Providers:
- geosite: category-ru, yandex, category-ai-!cn, mailru, drweb, private, speedtest, category-remote-control, youtube, google-gemini, discord, cloudflare, telegram, category-porn
- geoip: by, private, cloudflare, telegram

#### 3. legiz-ru/mihomo-rule-sets (13 URLs) -- ON `main` BRANCH

All use `main` branch (raw.githubusercontent or github.com/...raw/main/...).
**No action needed** -- always points to latest.

Providers: refilter_domains, discord-voice-ip-list, games-direct, ru-app-list, refilter_noech, refilter_ech, refilter_ipsum, torrent-clients, torrent-trackers, torrent-websites, oisd_big, oisd_nsfw_small, oisd_nsfw_big, ru-bundle

#### 4. itdoginfo/allow-domains (2 URLs) -- ON `main` BRANCH

- ru-inside: `main/Russia/inside-clashx.lst`
- ru-outside: `main/Russia/outside-clashx.lst`
**No action needed.**

#### 5. Other URLs (non-rule-provider)

- **geox-url geosite:** `v2fly/domain-list-community` -- uses `releases/latest/download` (auto-latest). OK.
- **geox-url geoip:** `MetaCubeX/meta-rules-dat` -- uses `releases/latest/download` (auto-latest). OK.
- **external-ui-url:** `Zephyruso/zashboard` -- uses `releases/latest/download` (auto-latest). OK.
- **subscription:** `prev.mewal.nl` -- user's personal subscription URL. Do not touch.
- **health-check url:** `gstatic.com` and `cloudflare.com` -- standard health-check endpoints. OK.

#### 6. Inline Providers (10 providers) -- NO URLs

UG_NAS, ru-inline-banned, ru-inline, inline-blocked-ips, github-ai, discord_vc, quic, Sin_in, ST_in, BG_in, BGP_in, CB_in -- all `type: inline`, no external URL.

### Orphan Analysis (URL-02)

**Result: 0 orphan providers, 0 missing providers.**

Phase 2 (02-03) already cleaned up 4 orphans (hagezi_pro, geoip-ru, gaming-ips, steam-domain).
Current state is clean: every provider defined in rule-providers is referenced in rules, and vice versa.

URL-02 requirement may already be satisfied. Verification step should confirm.

### Dashboard Password (URL-04)

Current config line 25: `secret: 'admin'`

Per CONTEXT.md decision:
- Password is set by user manually (not auto-generated)
- Storage in plaintext is OK (local router)
- This should be a separate step, NOT in automatic execution
- Plan should leave a TODO comment

### Key Risks and Considerations

1. **Anton111111 tag update** is a simple find-and-replace. File names are stable across releases.
2. **HTTP 200 verification** -- per CONTEXT.md, Claude checks each URL manually (curl/fetch), no separate script.
3. **The `meta` branch URLs** for MetaCubeX are not versioned -- they auto-update. No action required.
4. **URL response validation** should check not just HTTP 200 but that content looks like valid rule lists (non-empty, expected format).
5. **Password change** is user-action, plan should add a TODO comment but NOT change the password automatically.

### Scope Boundaries

**In scope:**
- Update 16 Anton111111 URLs to latest release tag
- Verify all HTTP URLs return 200 with valid content
- Confirm 0 orphan providers
- Add TODO comment for password change

**Out of scope:**
- Adding new providers from Anton111111 (new files in latest release)
- Changing MetaCubeX or legiz-ru URLs (already on auto-update branches)
- Actually changing the password (user does this)

## RESEARCH COMPLETE

All 4 requirements (URL-01 through URL-04) have clear implementation paths.
The phase is straightforward: primarily a tag update + URL health verification.

---
*Phase: 04-url-audit-cleanup*
*Research completed: 2026-02-25*
