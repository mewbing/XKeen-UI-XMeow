# Technology Stack

**Analysis Date:** 2026-02-25

## Configuration Format

**Primary Format:**
- YAML - Complete configuration in `config.yaml`
- Format: Clash Meta (Mihomo) configuration specification

**Key Features:**
- Rule-based routing with regex and domain matching
- Multi-proxy group management with fallback/url-test strategies
- Dynamic rule provider loading with interval-based updates
- Inline rules and HTTP-sourced rule providers

## Mihomo/Clash Meta Version

**Target:**
- Mihomo (Clash Meta) - Latest stable supporting:
  - Geodata mode (`geodata-mode: true`)
  - IPv6 support (`ipv6: true`)
  - GeoSite/GeoIP domain-based and IP-based filtering
  - Rule provider behavior classification (domain, ipcidr, classical)
  - Meta-specific format support (MRS files)

**Protocol Support:**
- HTTP proxy (port 7890)
- SOCKS5 proxy (port 7891)
- Transparent redirect (TPROXY) - port 7893
- HTTP redirect - port 7892

## Proxy Protocols Supported

**Protocol Types in Configuration:**
- **Shadowsocks (SS)** - Used via proxy providers (subscription-based)
- **VMess** - Used via proxy providers
- **Trojan** - Referenced in common proxy provider patterns
- **VLESS** - Modern protocol support
- All protocols sourced from external subscription provider

**Subscription Provider:**
- Type: HTTP proxy provider
- URL: `https://prev.mewal.nl/KRKygPMyu6-cYWg_`
- Update interval: 3600 seconds (1 hour)
- Health check: Enabled with 300-second intervals
- Expected status: HTTP 204 (No Content)
- Optimization: TCP Fast Open (TFO), MPTCP, UDP enabled

## Rule Providers

**Inline Rules:**
- Domain regex patterns (DOMAIN-REGEX)
- Domain suffix matching (DOMAIN-SUFFIX)
- Domain keyword matching (DOMAIN-KEYWORD)
- IP CIDR ranges (IP-CIDR)
- IP ASN matching (IP-ASN)
- Process name matching (PROCESS-NAME, PROCESS-NAME-REGEX)
- Port-based rules (DST-PORT)
- Combined AND/OR logic rules

**HTTP-Based Rule Providers:**

*Domain/GeoSite Rules (MRS format):*
- GeoSite: Domains categorized by country/service
- Supported behaviors: domain, classical (text)
- Formats: MRS (Meta Rules Set), YAML, text

*IP/GeoIP Rules (MRS format):*
- GeoIP: IP CIDR blocks by country/service
- Supported behaviors: ipcidr, classical
- Format: MRS (Meta Rules Set)

*Categories Provided:*
- Geolocation: geosite-ru, geoip-ru, geoip-by, geosite-private, geoip-private
- Services: youtube, telegram, discord, github-ai, cloudflare, etc.
- Special: OISD (ad-blocking), torrent-clients/trackers/websites, gaming, re-filter (ECH)
- Media: category-porn, tidal, spotify, netflix, twitch
- Infrastructure: CDN/Cloud IP lists (Akamai, Amazon, Cloudflare, DigitalOcean, Fastly, Google, Hetzner, Meta, Oracle, OVH, Vultr, etc.)

## DNS Configuration

**DNS Handling:**
- Default mode: Router-managed DNS (Keenetic)
- Configured for transparent proxy on router
- UDP port: 7893 (TPROXY)
- TCP redirect: Port 7892

**DNS-Related Rules:**
- DST-PORT 53 rule routes to named group "53"
- Rule provider for DNS queries managed through policy groups

## Data Storage & Caching

**Configuration Storage:**
- Local file system in `config.yaml`
- Proxy provider cache: `./proxy-providers/subscription.yaml`
- Rule provider cache: `./rule-sets/` and `./oisd/`, `./re-filter/`, `./ru-bundle/` directories

**Update Intervals:**
- Proxy subscription: 3600 seconds (1 hour)
- Rule providers: 86400 seconds (24 hours)
- Geo-update: 168 hours (7 days)

**Cache Behavior:**
- All rule providers store downloaded files locally
- Path: `./[category]/[provider-name].[format]`
- Formats cached: `.mrs` (MRS), `.yaml` (YAML), `.lst` (text list)

## Web Interface & Management

**Dashboard Access:**
- External controller: `0.0.0.0:9090`
- Authentication: Secret password required (`admin` - requires change to secure)
- UI: External HTML dashboard
- UI source: Zashboard (auto-downloaded from GitHub releases)
- UI URL: `https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip`

**Profile Management:**
- Store-selected: Enabled (retains user proxy selections for proxy groups)

## Network Monitoring & Sniffer

**Traffic Sniffer:**
- Enable: true
- Parse pure IP: true (analyze traffic to direct IPs)
- Force DNS mapping: true (intercept DNS queries)
- Sniff types: HTTP, TLS (HTTPS/SSL), QUIC

**Health Check System:**
- URL: `http://www.gstatic.com/generate_204` (Google generate 204 endpoint)
- Interval: 300 seconds
- Timeout: 10000 milliseconds
- Lazy mode: Enabled (check only when needed)
- Expected response: HTTP 204

## GeoIP/GeoSite Databases

**Database Sources:**
- GeoSite: `https://github.com/v2fly/domain-list-community/releases/latest/download/dlc.dat`
- GeoIP: `https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geoip.dat`
- Format: DAT (binary format used by Clash/Mihomo)

**Auto-Update:**
- geo-auto-update: Enabled
- Update interval: 168 hours (7 days)

## Logging

**Log Level:** silent (no console logging)
**Recommended for debugging:** info

## System Configuration

**Keep-Alive:**
- Interval: 30 seconds

**Mode:**
- Rule: RULE-based routing (not direct or proxy-only)

**Unified Delay:**
- Enabled: true (unified response time measurement)

**IPv6 Support:**
- Enabled: true (modern dual-stack support)

**LAN Access:**
- Allow: true (other devices on local network can use proxy)

---

*Stack analysis: 2026-02-25*
