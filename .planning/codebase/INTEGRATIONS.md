# External Integrations

**Analysis Date:** 2026-02-25

## Proxy Providers

**Subscription Service:**
- Provider: External HTTP-based proxy subscription
- URL: `https://prev.mewal.nl/KRKygPMyu6-cYWg_`
- Type: HTTP proxy provider (subscription)
- Supported protocols: Shadowsocks (SS), VMess, Trojan, VLESS
- Health check: `http://www.gstatic.com/generate_204` (Google endpoint)
- Health check interval: 300 seconds
- Update interval: 3600 seconds (1 hour)
- Optimization flags: TCP Fast Open (TFO), MPTCP, UDP enabled

## Domain/GeoSite Database Services

**Primary GeoSite Source:**
- Service: v2fly domain-list-community
- URL: `https://github.com/v2fly/domain-list-community/releases/latest/download/dlc.dat`
- Format: DAT (binary)
- Purpose: Domain categorization by country and service
- Update cycle: 168 hours (7 days)

**Specific GeoSite Providers (MetaCubeX):**
- Base URL: `https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/`
- Categories: youtube, google-gemini, telegram, discord, cloudflare, tidal, linkedin, facebook, netflix, spotify, speedtest, instagram, steam, twitter, tiktok, intel, google, google-play, github, microsoft, amazon, cdn77, category-anticensorship, whatsapp, category-ru, category-gov-ru, openai, anthropic, logitech, drweb, category-porn, mailru, yandex, private (private networks)
- Format: MRS (Meta Rules Set)
- Behavior: domain (domain matching)
- Update interval: 86400 seconds (24 hours)

## IP Database Services

**Primary GeoIP Source:**
- Service: MetaCubeX meta-rules-dat
- URL: `https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geoip.dat`
- Format: DAT (binary)
- Purpose: IP CIDR geolocation
- Update cycle: 168 hours (7 days)

**Specific GeoIP Providers (MetaCubeX):**
- Base URL: `https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/`
- Categories: ru, by, private (private networks), telegram, cloudflare
- Format: MRS (Meta Rules Set)
- Behavior: ipcidr (IP CIDR matching)
- Update interval: 86400 seconds (24 hours)

## Ad-Blocking & Security Services

**OISD (Open Internet Security Database):**
- Source: GitHub - legiz-ru/mihomo-rule-sets
- URL Base: `https://github.com/legiz-ru/mihomo-rule-sets/raw/main/oisd/`
- Files provided: big.mrs, small.mrs, nsfw_big.mrs, nsfw_small.mrs
- Purpose: Advertisement and tracker domain blocking
- Format: MRS (domain-based)
- Update interval: 86400 seconds (24 hours)
- Usage: Ad-Filter proxy group selector (can toggle blocking)

**Hagezi Pro Ad Filter:**
- Source: GitHub - zxc-rv/ad-filter
- URL: `https://github.com/zxc-rv/ad-filter/releases/latest/download/adlist.mrs`
- Format: MRS (domain)
- Purpose: Alternative ad and tracking list
- Update interval: 86400 seconds (24 hours)

**Dr.Web Security List:**
- Source: MetaCubeX meta-rules-dat
- URL: `https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/drweb.mrs`
- Format: MRS (domain)
- Purpose: Malware/security threat domain blocking
- Update interval: 86400 seconds (24 hours)

## ECH (Encrypted Client Hello) & Re-Filter Services

**Re-Filter Provider:**
- Source: GitHub - legiz-ru/mihomo-rule-sets
- URL Base: `https://github.com/legiz-ru/mihomo-rule-sets/raw/main/re-filter/`
- Files: re-filter-ech.mrs, re-filter-noech.mrs, ip-rule.mrs
- Purpose: Handle Encrypted Client Hello protocol filtering
- Format: MRS (domain and IP CIDR)
- Update interval: 86400 seconds (24 hours)

## Russian Content & Regional Services

**Russian Domain Bundles:**
- Source: GitHub - legiz-ru/mihomo-rule-sets
- URL: `https://github.com/legiz-ru/mihomo-rule-sets/raw/main/ru-bundle/rule.mrs`
- Purpose: Consolidated Russian-language content and services
- Format: MRS (domain)
- Update interval: 86400 seconds (24 hours)

**Russian Network Classification:**
- Inside Russia: `https://raw.githubusercontent.com/itdoginfo/allow-domains/main/Russia/inside-clashx.lst`
- Outside Russia: `https://raw.githubusercontent.com/itdoginfo/allow-domains/main/Russia/outside-clashx.lst`
- Format: Text list
- Purpose: Classify domains accessible from within/outside Russia
- Update interval: 86400 seconds (24 hours)

**Russian Services (Inline Rules):**
- Yandex, VK.com, Mail.ru, Avito, Ozon, Wildberries, Sberbank
- 2Gis, Kinescope, Kaspersky, Stepik
- Russian government and regional services

**Russian Content (Inline Rules - Banned):**
- News/media: Habr, TVRain, Novaya Gazeta, Moscow Times, The Village, SNOB
- Anime streaming: AnimeGo, YummyAnime, AnimeLib, Anilibria, AniDub
- Book/knowledge: Lib.Social, Kemono, JutSu

## Gaming & Entertainment Services

**Game Servers & Platforms:**
- Steam: `https://raw.githubusercontent.com/OMchik33/custom-rules/refs/heads/main/mihomo/gaming-domains.yaml`
- Gaming IPs: `https://raw.githubusercontent.com/OMchik33/custom-rules/main/mihomo/gaming-ips.yaml`
- Games Direct: `https://github.com/legiz-ru/mihomo-rule-sets/raw/main/other/games-direct.yaml`
- Format: YAML
- Update interval: 86400 seconds (24 hours)

**Streamer/Content Platforms:**
- Twitch, YouTube, Spotify, Netflix, Discord
- Sourced via GeoSite database

**Adult/NSFW Platforms (Inline Rules):**
- Sinparty.com, Stripchat.com, ChatUrbate.com, BongaCams.com, BongaModels.com
- OnlyFans, Fansly, Patreon, PornHub
- Individual domain rules with regex patterns

**Gaming Chats (Warframe):**
- Specific IP block: 172.232.25.131/32 (Warframe chat server)

## CDN & Infrastructure Provider IP Lists

**Source:** GitHub - Anton111111/rule-lists

**Providers Tracked (IP CIDR ranges):**
- Akamai, Amazon (AWS), CDN77, Cloudflare, DigitalOcean
- Fastly, Google Cloud, Hetzner, Mega (file storage)
- Meta (Facebook/Instagram), Oracle Cloud, OVH, Vultr
- Base URL: `https://github.com/Anton111111/rule-lists/releases/download/lists-20251102-014123-835e3fe/`
- Format: Text lists (.list)
- Update interval: 86400 seconds (24 hours)
- Purpose: Route CDN traffic through appropriate proxy groups

## Communication Platforms

**Discord:**
- Voice IP ranges: `https://raw.githubusercontent.com/legiz-ru/mihomo-rule-sets/main/other/discord-voice-ip-list.mrs`
- Domain list: `https://github.com/MetaCubeX/meta-rules-dat/raw/meta/geo/geosite/discord.mrs`
- IP list: Multiple CIDR blocks from Anton111111 repo
- UDP ports for voice: 50000-50100
- Special handling: AND rules combining IP, protocol, and port

**Telegram:**
- Domains: `https://github.com/MetaCubeX/meta-rules-dat/raw/meta/geo/geosite/telegram.mrs`
- IPs: `https://github.com/MetaCubeX/meta-rules-dat/raw/meta/geo/geoip/telegram.mrs`
- Format: MRS
- ASN-based rules: 32934, 11917, 9002
- Purpose: Reliable Telegram access with fallback mechanisms

**Whatsapp:**
- GeoSite rules via MetaCubeX
- ASN-based rules: 32934, 11917, 9002

## Developer/AI Services

**Source:** Inline rules in configuration

**GitHub & Development:**
- GitHub.com, GitHub.dev, GitHubCopilot, Marketplace.VisualStudio.com
- VS Code: vscode.dev, vscode.microsoft.com, code.visualstudio.com
- Docker: docker.com, docker.io
- NPM: npmjs.com
- PyPI: pypi.org

**AI/LLM Services:**
- OpenAI: chat.openai.com, platform.openai.com, api.openai.com
- Google AI: gemini.google.com, bard.google.com, aistudio.google.com, makersuite.google.com
- Anthropic Claude: claude.ai, console.anthropic.com
- xAI Grok: x.ai, grok.x.ai
- Perplexity: perplexity.ai, pplx.ai
- HuggingFace: huggingface.co, huggingface.com, hf.co
- Midjourney: midjourney.com, cdn.midjourney.com
- Stability AI: stability.ai, stablediffusionweb.com, dreamstudio.ai
- Runway ML: runwayml.com, runway.ml
- Character.AI: character.ai, beta.character.ai
- Replicate: replicate.com
- Cohere: cohere.ai, cohere.com
- JetBrains: jetbrains.com
- Replit: replit.com, repl.it
- StackOverflow: stackoverflow.com

## Torrent Services

**Torrent Rules Provider:**
- Source: GitHub - legiz-ru/mihomo-rule-sets
- URL Base: `https://github.com/legiz-ru/mihomo-rule-sets/raw/main/other/`
- Files: torrent-clients.yaml, torrent-trackers.mrs, torrent-websites.mrs
- Format: YAML and MRS
- Purpose: Torrent client detection and torrent site classification
- Update interval: 86400 seconds (24 hours)
- Handling: Torrent traffic directed DIRECT (not through VPN)

## Stream Quality & Performance Testing

**Speedtest:**
- GeoSite: `https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/speedtest.mrs`
- Format: MRS (domain)
- Update interval: 86400 seconds (24 hours)

**Remote Control Services:**
- Tailscale, WireGuard, NetBird, AnyDesk, RustDesk, TeamViewer
- Process name matching: regex pattern detection
- Remote Control GeoSite: `https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-remote-control.mrs`
- Format: MRS (domain)

## Specialized Application Lists

**Russian Apps & Services:**
- Source: GitHub - legiz-ru/mihomo-rule-sets
- URL: `https://github.com/legiz-ru/mihomo-rule-sets/raw/main/other/ru-app-list.yaml`
- Format: YAML
- Purpose: Classify Russian mobile/desktop applications

**Other Domains List:**
- Source: Anton111111 rule-lists
- URL: `https://github.com/Anton111111/rule-lists/releases/download/lists-20251102-014123-835e3fe/other.list`
- Format: Text list
- Purpose: Miscellaneous services not in specific categories

**Political/Government List:**
- URL: `https://github.com/Anton111111/rule-lists/releases/download/lists-20251102-014123-835e3fe/politic.list`
- Format: Text list

## YouTube Enhanced CDN Support

**Enhanced YouTube Tracking:**
- Domain rules: `https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.mrs`
- Additional domains from Anton111111: `https://github.com/Anton111111/rule-lists/releases/download/lists-20251102-014123-835e3fe/youtube.list`
- IP ranges from Anton111111: `https://github.com/Anton111111/rule-lists/releases/download/lists-20251102-014123-835e3fe/youtube_ips.list`
- Purpose: Comprehensive YouTube service handling including CDN edges

## Web Dashboard UI

**UI Framework:**
- Provider: Zashboard project
- URL: `https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip`
- Download: Automatic on first run
- Purpose: Web-based proxy management dashboard
- Storage: `ui/` directory (local)

## Icon Resources

**Icon CDN Sources:**
- jsDelivr CDN: `https://cdn.jsdelivr.net/` (Qure icon set, Homarr dashboard icons)
- SVG Repo: `https://www.svgrepo.com/`
- IconFinder: `https://www.iconfinder.com/`
- Direct URLs: Company favicon and status pages

---

*Integration audit: 2026-02-25*
