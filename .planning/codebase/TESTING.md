# Testing Patterns

**Analysis Date:** 2026-02-25

## Test Framework

**Testing Type:** Manual validation (No automated test framework detected)

**Validation Method:**
- Runtime configuration validation through Mihomo proxy application
- Health checks built into configuration for proxy providers
- Manual testing of routing rules and proxy groups

**Configuration Validation:**
YAML syntax validation through:
- Mihomo native configuration parser
- YAML linting (external tools if applied during deployment)

## Health Check System

**Built-in Health Monitoring:**

Located in `proxy-providers` section at `d:/AI/antigravity/claude/config/mihomo/config.yaml` (lines 51-56):
```yaml
health-check:
  enable: true # Включить функцию сниффера для определения типа трафика
  url: http://www.gstatic.com/generate_204
  interval: 300
  timeout: 10000
  lazy: true
  expected-status: 204
```

**Health Check Parameters:**
- `enable: true` - Active health checking enabled
- `url: http://www.gstatic.com/generate_204` - Google connectivity test endpoint
- `interval: 300` - Check every 300 seconds (5 minutes)
- `timeout: 10000` - 10 second timeout for each check
- `lazy: true` - Minimal checking when proxy group not in active use
- `expected-status: 204` - Expect 204 No Content response (successful connection)

**URL-Test Group Health Check:**

Located in `proxy-groups` section (lines 82-85):
```yaml
- name: ⚡Fastest
  icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Auto.png'
  type: url-test
  tolerance: 150
  url: 'https://cp.cloudflare.com/generate_204'
  interval: 300
```

**Fallback Group Health Check:**

Located in `proxy-groups` section (lines 91-93):
```yaml
- name: 📶Available
  icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Available.png'
  type: fallback
  url: 'https://cp.cloudflare.com/generate_204'
  interval: 300
```

## Configuration Validation Points

**Proxy Provider Validation:**
- Subscription endpoint reachability (line 48): `https://prev.mewal.nl/KRKygPMyu6-cYWg_`
- Update interval verification (line 50): 3600 seconds = 1 hour
- Health check response status codes

**GeoIP/GeoSite Database Validation:**

Located in `geox-url` section (lines 64-66):
```yaml
geox-url:
  geosite: 'https://github.com/v2fly/domain-list-community/releases/latest/download/dlc.dat'
  geoip: 'https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geoip.dat'
```

- Database URLs are validated on startup
- Updates occur on geo-auto-update interval (168 hours)
- Format compatibility with Mihomo version

**Proxy Group References:**
- All referenced proxy groups in rules must be defined in proxy-groups section
- Circular references prevented through group hierarchy validation
- Special groups: `DIRECT`, `REJECT` - built-in, no definition required

**Rule Provider Validation:**
- All rule sets in `rule-providers` section (lines 599-1289) must be accessible
- Format compatibility checked: `mrs`, `yaml`, `text` formats
- Interval refresh timing validated (typically 86400 seconds = 24 hours)
- Path locations verified for file write permissions: `./rule-sets/`, `./oisd/`, `./re-filter/`

## Testing Scenarios

**Proxy Selection Testing:**
Manual validation required for:
- Manual proxy group selection through Web UI (port 9090)
- URL-test group automatic selection based on latency
- Fallback group failover when primary proxy fails

**Rule Routing Testing:**
Manual validation scenarios:
1. Russian traffic routing to `RU трафик` group
2. YouTube traffic routing to `YouTube` group
3. Discord routing with voice/IP handling
4. Telegram routing with IP-CIDR and domain matching
5. Torrent blocking/allow-through verification
6. AI services routing through VPN (OpenAI, Claude, etc.)
7. Local network traffic (192.168.0.0/16, 10.0.0.0/8) direct routing
8. Port-based routing (voice ports 50000-50100 for Discord)
9. QUIC protocol rejection testing

**Ad-Filter Validation:**
- OISD rule set blocking effectiveness
- Ad-Filter group toggle between REJECT and DIRECT

**ECH Re-filter Testing:**
- ECH detection on domain routing
- Re-filter domain set application (lines 835-841, 1168-1188)

## Manual Testing Checklist

**Before Deployment:**
1. Validate YAML syntax using YAML validator
2. Verify all remote URLs are accessible
3. Check proxy provider subscription endpoint
4. Confirm GeoIP/GeoSite database URLs
5. Test Web UI access on external-controller port 9090
6. Verify credentials (secret: 'admin' on line 25)
7. Check Keenetic router port forwarding (7890, 7891, 7892, 7893)

**Runtime Validation:**
1. Monitor health check intervals through logs
2. Test manual proxy selection in Web UI
3. Verify automatic failover behavior
4. Check rule routing via connection logs
5. Validate that blocked services are unreachable
6. Confirm local network traffic bypasses proxy
7. Test Discord voice communication routing

**Periodic Validation:**
1. Weekly: Verify health check status in Web UI
2. Daily: Check rule provider update intervals
3. Monthly: Validate geosite/geoip database freshness
4. As-needed: Test new rule additions before permanent deployment

## Remote Rule Set Validation

**Rule Set Update Intervals:**
- Default: 86400 seconds (24 hours)
- Subscription proxies: 3600 seconds (1 hour)

**Data Format Support:**
- `.mrs` format: Binary Clash Meta format (most rule sets)
- `.yaml` format: YAML parsed rules (gaming-ips, games-direct)
- `.list` or `.lst` format: Text format, one rule per line
- `inline` type: YAML payload directly in config

**Sources with Validation:**
All rule set URLs follow GitHub release patterns:
- `https://github.com/{organization}/{repo}/releases/latest/download/{file}`
- `https://raw.githubusercontent.com/{organization}/{repo}/branch/{file}`

Examples:
- Anton111111 rules (lines 956-1090): IP-based rule sets for CDN/cloud providers
- legiz-ru rules (lines 1149-1204): Russian-focused and torrent rules
- MetaCubeX rules (lines 750-862): GeoIP/GeoSite databases and service rules
- OISD rules (lines 1214-1241): Ad-blocking and tracker lists

## Configuration Testing Best Practices

**When Adding New Rules:**
1. Place new rules in "ПЕРСОНАЛЬНЫЕ ПРАВИЛА" section (lines 1649-1651)
2. Use template patterns provided in comments (lines 1653-1669)
3. Test with single service/domain before batch additions
4. Verify no conflicts with existing rule priorities
5. Document purpose in inline comment
6. Use same naming conventions for custom providers

**When Adding New Proxy Groups:**
1. Follow naming convention with emoji prefix
2. Include icon URL from Qure or compatible source
3. Choose appropriate type (select/url-test/fallback)
4. Reference existing proxy providers or GLOBAL group
5. Add to GLOBAL hidden group for completeness
6. Test in Web UI selection

**When Adding New Rule Providers:**
1. Verify data source URL accessibility
2. Choose correct behavior type (classical/domain/ipcidr)
3. Select appropriate format (mrs/yaml/text)
4. Set reasonable update interval
5. Create local path following subdirectory convention
6. Test rule parsing before adding to rules section

## Validation Tools

**Recommended External Tools:**
- YAML validator (online or CLI): Syntax checking before deployment
- Curl/Wget: Verify remote URL accessibility
- Mihomo CLI: Configuration dry-run validation if available
- Network sniffer: Validate actual routing behavior

## Failure Recovery

**Common Issues:**
1. Unreachable proxy provider → Health check fails, fallback group activates
2. Invalid rule syntax → Configuration fails to load, Web UI shows error
3. Missing proxy group reference → Rule fails to apply
4. Port conflicts → Web UI/proxy ports unavailable

**Recovery Steps:**
1. Check Mihomo logs for configuration errors
2. Validate most recently modified sections
3. Revert to last known-working configuration
4. Restart Mihomo service with known good config
5. Gradually re-add customizations in test environment

---

*Testing validation analysis: 2026-02-25*
