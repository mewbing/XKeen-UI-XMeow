# Phase 14: Installer (setup.sh) - Research

**Researched:** 2026-03-03
**Domain:** Shell scripting, Entware/Keenetic init.d, GitHub Releases API, architecture detection
**Confidence:** HIGH

## Summary

Phase 14 requires creating a POSIX-compatible shell script (`setup.sh`) that installs the XMeow UI dashboard on Keenetic routers running Entware. The script must download the correct binary from GitHub Releases, create an init.d service, configure environment variables, and optionally deploy the external-UI SPA files into mihomo's directory.

The primary technical challenge is **MIPS endianness detection**: `uname -m` returns `"mips"` for BOTH big-endian and little-endian MIPS systems on Linux. The solution is a two-stage detection: first parse `/opt/etc/opkg.conf` for the Entware architecture string (which reliably contains `mipsel` vs `mips`), then fall back to a portable `od`-based endianness test.

The script must work in BusyBox ash (POSIX sh), not bash. All constructs must avoid bashisms (no arrays, no `[[ ]]`, no process substitution). GitHub Releases API can be queried without `jq` using `grep`/`sed` parsing of JSON responses.

**Primary recommendation:** Write a single POSIX sh script with wrapper function pattern (for `curl | sh` safety), two-stage MIPS detection (opkg.conf + od fallback), and a custom init.d script (NOT rc.func, which doesn't support env var sourcing from .conf files).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
1. **Paths:** Install dir `/opt/etc/xmeow-ui/`, binary `xmeow-server`, config `xmeow-ui.conf`, init.d `S99xmeow-ui`
2. **Config file format:** `PORT=5000`, `MIHOMO_CONFIG_PATH=...`, `XKEEN_DIR=...`, `XKEEN_LOG_DIR=...` (sourced by init.d)
3. **Menu:** 3 options: Install / Update / Uninstall. Language auto-detect by `$LANG`
4. **Dual mode install:** Go backend (init.d service on :5000) + external-UI (dist.tar.gz into mihomo external-ui dir)
5. **Update:** Compare versions via GitHub API, backup old binary as `xmeow-server.<version>`, auto-restart, do NOT overwrite .conf, DO overwrite init.d script
6. **Verification:** SHA256 checksum from `checksums.txt`
7. **Progress:** `curl --progress-bar`
8. **ASCII logo:** XMeow branding at script start
9. **Finish message:** Auto-detect IP, show version, show start/stop/status commands
10. **CI rename needed:** Binary name `xmeow-ui` -> `xmeow-server` in release.yml

### Claude's Discretion
- Uninstall behavior details (stop service, remove binary + init.d, ask about config/backups, do NOT touch mihomo files)

### Deferred Ideas (OUT OF SCOPE)
- Rollback command in menu (Phase 15 scope)
- Port configuration during install (use .conf file instead)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INST-01 | setup.sh installs from GitHub releases via `curl \| sh` one-liner | Wrapper function pattern for pipe safety, GitHub Releases API without jq, SHA256 verification |
| INST-02 | setup.sh auto-detects router architecture (arm64/mipsle/mips) | Two-stage detection: opkg.conf parsing + od-based endianness fallback; uname -m mapping |
| INST-03 | setup.sh creates init.d service script (S99) for Entware | Custom init.d with case statement, .conf sourcing, env var export, PID management |
| INST-04 | setup.sh supports interactive menu (install/update/uninstall) | TTY detection via `[ -t 0 ]` and `/dev/tty`, ANSI colors, `$LANG` language detection |
| INST-05 | setup.sh validates successful installation and starts service | Post-install checks: binary exists + executable, init.d exists, service starts, HTTP health check |
</phase_requirements>

## Standard Stack

### Core
| Tool | Purpose | Why Standard |
|------|---------|--------------|
| POSIX sh | Script interpreter | BusyBox ash on Keenetic is POSIX sh, NOT bash |
| curl | HTTP client for downloads and API | Available on Entware Keenetic; preferred over wget for progress bar |
| tar | Archive extraction | BusyBox tar available on all Entware systems |
| sha256sum | Checksum verification | BusyBox applet, compatible with GNU sha256sum -c format |
| grep/sed/awk | JSON parsing (no jq) | BusyBox applets, always available; jq NOT guaranteed |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| wget | HTTP fallback | When curl is not installed; wget is more commonly pre-installed |
| od | Endianness detection | Fallback when opkg.conf doesn't reveal architecture |
| pidof | Process detection | For service status check; BusyBox applet |
| killall | Process termination | For service stop; BusyBox applet |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom init.d | Entware rc.func | rc.func doesn't support sourcing external .conf with env vars; custom script gives full control |
| grep/sed JSON | jq | jq not available on Entware by default; grep/sed is always available |
| curl --progress-bar | wget -q | curl gives better progress display, but wget is more commonly pre-installed |

## Architecture Patterns

### Script Structure (wrapper function pattern)
```
setup.sh
 +-- main()                    # Entry point, wraps everything for curl|sh safety
 |   +-- detect_lang()         # $LANG -> ru/en
 |   +-- print_logo()          # ASCII art + version header
 |   +-- detect_tty()          # Pipe vs direct execution
 |   +-- show_menu()           # Interactive 1/2/3 selection
 |   +-- do_install()          # Full install flow
 |   |   +-- detect_arch()     # Architecture detection
 |   |   +-- get_latest()      # GitHub API -> version + URLs
 |   |   +-- download_verify() # Download + SHA256 check
 |   |   +-- install_binary()  # Copy to /opt/etc/xmeow-ui/
 |   |   +-- install_extui()   # Extract dist.tar.gz to mihomo external-ui dir
 |   |   +-- create_config()   # Write xmeow-ui.conf (if not exists)
 |   |   +-- create_initd()    # Write S99xmeow-ui
 |   |   +-- start_service()   # Start and verify
 |   |   +-- print_success()   # IP, version, commands
 |   +-- do_update()           # Update flow
 |   |   +-- check_installed() # Verify current installation
 |   |   +-- get_current_ver() # xmeow-server --version
 |   |   +-- compare_versions()# Compare with latest
 |   |   +-- backup_binary()   # xmeow-server.<old_ver>
 |   |   +-- download_verify() # Same as install
 |   |   +-- replace_binary()  # Stop, replace, update init.d
 |   |   +-- restart_service() # Restart and verify
 |   +-- do_uninstall()        # Uninstall flow
 |       +-- stop_service()
 |       +-- remove_files()    # Binary, init.d
 |       +-- ask_cleanup()     # Config, backups (interactive)
```

### Pattern 1: Wrapper Function for curl|sh Safety
**What:** Wrap entire script in `main() { ... }; main "$@"` to prevent partial execution
**When to use:** Always -- prevents incomplete download from executing partial script
**Example:**
```sh
#!/bin/sh
# XMeow UI Installer
set -e

main() {
    # All script logic here
    detect_lang
    print_logo
    show_menu
}

# This ensures the entire script is downloaded before execution begins
main "$@"
```

### Pattern 2: Two-Stage MIPS Architecture Detection
**What:** Parse opkg.conf first, fall back to od-based endianness test
**When to use:** When `uname -m` returns "mips" (ambiguous for endianness)
**Why:** `uname -m` returns "mips" for BOTH big-endian AND little-endian MIPS on Linux
**Example:**
```sh
detect_arch() {
    ARCH=$(uname -m)
    case "$ARCH" in
        aarch64)  ARCH="arm64" ;;
        armv7l)   ARCH="armv7" ;;
        x86_64)   ARCH="amd64" ;;
        mips*)
            # Stage 1: Check opkg.conf for Entware architecture
            if grep -q "mipsel" /opt/etc/opkg.conf 2>/dev/null; then
                ARCH="mipsle"
            elif grep -q "mips" /opt/etc/opkg.conf 2>/dev/null; then
                # Confirmed big-endian from opkg
                ARCH="mips"
            else
                # Stage 2: Portable endianness detection via od
                ENDIAN=$(echo -n I | od -to2 | head -n1 | cut -f2 -d" " | cut -c6)
                if [ "$ENDIAN" = "1" ]; then
                    ARCH="mipsle"
                else
                    ARCH="mips"
                fi
            fi
            ;;
        *)
            die "Unsupported architecture: $ARCH"
            ;;
    esac
}
```

### Pattern 3: TTY Detection for Pipe Mode
**What:** Detect if running via `curl | sh` (no TTY) vs direct `sh setup.sh` (TTY available)
**When to use:** For interactive prompts -- must read from `/dev/tty` in pipe mode
**Example:**
```sh
# Check if stdin is a terminal
if [ -t 0 ]; then
    # Direct execution -- read from stdin normally
    read -r choice
else
    # Pipe mode (curl | sh) -- read from /dev/tty
    read -r choice < /dev/tty
fi
```

### Pattern 4: GitHub Releases API Without jq
**What:** Parse GitHub API JSON with grep/sed (no jq dependency)
**When to use:** Always -- jq is not available on Entware by default
**Example:**
```sh
get_latest_version() {
    LATEST_JSON=$(curl -fsSL "https://api.github.com/repos/mewbing/XKeen-UI-Xmeow/releases/latest")
    LATEST_VER=$(echo "$LATEST_JSON" | grep '"tag_name"' | sed 's/.*"tag_name": *"v\{0,1\}\([^"]*\)".*/\1/')
}
```

### Pattern 5: Custom init.d with .conf Sourcing
**What:** Init.d script that sources env vars from .conf file before starting daemon
**When to use:** Instead of rc.func (which doesn't support external config sourcing)
**Example:**
```sh
#!/bin/sh
# /opt/etc/init.d/S99xmeow-ui

CONF="/opt/etc/xmeow-ui/xmeow-ui.conf"
BIN="/opt/etc/xmeow-ui/xmeow-server"
PIDFILE="/opt/var/run/xmeow-ui.pid"

# Source config if exists
[ -f "$CONF" ] && . "$CONF"

# Export env vars for the binary
export PORT="${PORT:-5000}"
export MIHOMO_CONFIG_PATH="${MIHOMO_CONFIG_PATH:-/opt/etc/mihomo/config.yaml}"
export XKEEN_DIR="${XKEEN_DIR:-/opt/etc/xkeen}"
export XKEEN_LOG_DIR="${XKEEN_LOG_DIR:-/opt/var/log/xray}"

case "$1" in
    start)
        if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
            echo "xmeow-ui already running (PID $(cat "$PIDFILE"))"
        else
            echo "Starting xmeow-ui..."
            "$BIN" &
            echo $! > "$PIDFILE"
            echo "xmeow-ui started (PID $!)"
        fi
        ;;
    stop)
        if [ -f "$PIDFILE" ]; then
            PID=$(cat "$PIDFILE")
            if kill -0 "$PID" 2>/dev/null; then
                echo "Stopping xmeow-ui (PID $PID)..."
                kill "$PID"
                rm -f "$PIDFILE"
            else
                echo "xmeow-ui not running (stale PID file)"
                rm -f "$PIDFILE"
            fi
        else
            echo "xmeow-ui not running"
        fi
        ;;
    restart)
        "$0" stop
        sleep 1
        "$0" start
        ;;
    status)
        if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
            echo "xmeow-ui running (PID $(cat "$PIDFILE"))"
        else
            echo "xmeow-ui not running"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
```

### Anti-Patterns to Avoid
- **Bashisms in POSIX sh:** `[[ ]]`, arrays, `$()` nested, process substitution `<()`, `source` (use `.` instead), `function` keyword, `{a..z}` brace expansion -- NONE of these work in BusyBox ash
- **Using rc.func for custom services:** rc.func only supports PROCS/ARGS/PREARGS pattern; doesn't allow sourcing external .conf files with env vars before daemon start
- **Relying on `uname -m` alone for MIPS:** Returns "mips" for both big-endian and little-endian -- MUST use opkg.conf or endianness test
- **Using jq for JSON parsing:** Not installed on Entware by default; use grep/sed instead
- **`set -e` with piped commands:** `set -e` doesn't catch failures in pipes on POSIX sh; use explicit error checks
- **Hardcoding IP in finish message:** Must auto-detect via `ip route` or `hostname -I` or interface parsing

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress display | Custom byte counter | `curl --progress-bar` | curl handles it natively with percentage |
| SHA256 verification | Custom hash logic | `sha256sum -c` | BusyBox applet, handles checksums.txt format |
| Service management | Custom daemonization | init.d script with PID file | Standard Entware pattern; survives reboot |
| JSON parsing | Full JSON parser | `grep`/`sed` one-liners | Only need 2-3 fields; full parser overkill |
| Version comparison | Semantic version parser | String comparison via `xmeow-server --version` vs API tag | Simple equality check sufficient for "update available?" |
| Download retry | Custom retry loop | `curl --retry 3` | Built-in retry with backoff |

**Key insight:** The target environment (BusyBox on router) has minimal tools. Every dependency matters. The script should use ONLY tools guaranteed to be present: sh, curl/wget, tar, grep, sed, sha256sum, od.

## Common Pitfalls

### Pitfall 1: uname -m Returns "mips" for Both Endiannesses
**What goes wrong:** Script downloads big-endian binary for little-endian MIPS router -> binary crashes silently
**Why it happens:** Linux kernel reports "mips" for `uname -m` regardless of endianness on MIPS
**How to avoid:** Two-stage detection: (1) parse `/opt/etc/opkg.conf` for `mipsel`/`mips` strings, (2) fall back to `echo -n I | od -to2` endianness test
**Warning signs:** Binary downloaded but service won't start; no error messages

### Pitfall 2: Partial Execution via curl|sh
**What goes wrong:** Network interruption during download causes partial script to execute, potentially leaving system in broken state
**Why it happens:** Shell executes script line-by-line as it's received from pipe
**How to avoid:** Wrap entire script in `main() { ... }; main "$@"` -- shell parses entire function before executing
**Warning signs:** Impossible to detect at runtime; must be prevented by design

### Pitfall 3: Interactive Prompts in Pipe Mode
**What goes wrong:** `read` from stdin fails when stdin is the pipe from curl, not the terminal
**Why it happens:** `curl | sh` makes stdin the pipe, not the terminal
**How to avoid:** Detect pipe mode with `[ -t 0 ]` and read from `/dev/tty` instead of stdin
**Warning signs:** Script hangs or immediately exits when run via `curl | sh`

### Pitfall 4: Not Exporting Env Vars in init.d
**What goes wrong:** Sourcing .conf file sets variables locally but binary doesn't see them
**Why it happens:** Variables sourced with `.` are local to the script unless explicitly exported
**How to avoid:** `export PORT MIHOMO_CONFIG_PATH XKEEN_DIR XKEEN_LOG_DIR` after sourcing .conf
**Warning signs:** Binary starts with default values instead of configured ones

### Pitfall 5: external-ui Path Security in mihomo
**What goes wrong:** mihomo restricts all config paths to workdir; absolute path outside workdir gets rejected
**Why it happens:** mihomo security feature limits paths to working directory unless `SAFE_PATHS` env is set
**How to avoid:** Use relative path `external-ui: ui` if mihomo workdir is `/opt/etc/mihomo/`, OR ensure the absolute path is within mihomo's workdir
**Warning signs:** External-UI shows 404 / not found after installation

### Pitfall 6: Binary Name Mismatch with CI
**What goes wrong:** setup.sh looks for `xmeow-server` in tar.gz but CI produces `xmeow-ui`
**Why it happens:** Phase 13 CI names the binary `xmeow-ui`, but Phase 14 CONTEXT.md specifies `xmeow-server`
**How to avoid:** MUST update `release.yml` to rename binary from `xmeow-ui` to `xmeow-server` as part of Phase 14
**Warning signs:** Installation fails with "binary not found in archive"

### Pitfall 7: SHA256 Checksum File Format
**What goes wrong:** `sha256sum -c` fails because checksum file paths don't match downloaded file names
**Why it happens:** CI generates checksums.txt with original filenames; installer may rename during download
**How to avoid:** Download files with their ORIGINAL names from CI, verify checksum, THEN rename/move
**Warning signs:** "FAILED" or "no properly formatted SHA256 checksum lines found"

### Pitfall 8: PID File Stale After Reboot
**What goes wrong:** PID file exists from before reboot but process isn't running; start fails with "already running"
**Why it happens:** Unclean shutdown or reboot doesn't clean PID file
**How to avoid:** Always verify PID is alive with `kill -0 PID` before trusting PID file
**Warning signs:** "xmeow-ui already running" but service is actually down

## Code Examples

### GitHub API: Get Latest Release Version and Download URL (no jq)
```sh
# Source: GitHub REST API docs + community patterns
REPO="mewbing/XKeen-UI-Xmeow"
API_URL="https://api.github.com/repos/$REPO/releases/latest"

get_latest() {
    RELEASE_JSON=$(curl -fsSL "$API_URL") || die "Failed to fetch release info"

    # Extract tag name (version)
    LATEST_VER=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name" *: *"\([^"]*\)".*/\1/')
    # Strip leading 'v' if present
    LATEST_VER_NUM=$(echo "$LATEST_VER" | sed 's/^v//')

    # Extract download URL for our architecture
    BINARY_NAME="xmeow-server_${LATEST_VER_NUM}_linux_${ARCH}.tar.gz"
    DOWNLOAD_URL="https://github.com/$REPO/releases/download/$LATEST_VER/$BINARY_NAME"
    CHECKSUM_URL="https://github.com/$REPO/releases/download/$LATEST_VER/checksums.txt"
    DISTUI_URL="https://github.com/$REPO/releases/download/$LATEST_VER/dist.tar.gz"
}
```

### SHA256 Verification
```sh
# Source: sha256sum man page, BusyBox docs
verify_checksum() {
    FILE="$1"
    BASENAME=$(basename "$FILE")

    # Download checksums.txt
    curl -fsSL "$CHECKSUM_URL" -o /tmp/xmeow-checksums.txt || die "Failed to download checksums"

    # Extract expected hash for our file
    EXPECTED=$(grep "$BASENAME" /tmp/xmeow-checksums.txt | awk '{print $1}')
    if [ -z "$EXPECTED" ]; then
        die "Checksum not found for $BASENAME"
    fi

    # Calculate actual hash
    ACTUAL=$(sha256sum "$FILE" | awk '{print $1}')

    if [ "$EXPECTED" != "$ACTUAL" ]; then
        die "Checksum mismatch! Expected: $EXPECTED, Got: $ACTUAL"
    fi

    echo "Checksum verified OK"
    rm -f /tmp/xmeow-checksums.txt
}
```

### Auto-Detect IP Address
```sh
# Source: POSIX networking commands
get_local_ip() {
    # Method 1: ip route (most reliable on modern Linux)
    IP=$(ip route get 1 2>/dev/null | grep -o 'src [0-9.]*' | awk '{print $2}')

    # Method 2: hostname -I fallback
    if [ -z "$IP" ]; then
        IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi

    # Method 3: interface parsing fallback
    if [ -z "$IP" ]; then
        IP=$(ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}' | sed 's/addr://')
    fi

    echo "${IP:-<router-ip>}"
}
```

### Language Detection and Bilingual Output
```sh
# Source: POSIX locale conventions
detect_lang() {
    case "${LANG:-}" in
        ru_*|ru) LANG_CODE="ru" ;;
        *)       LANG_CODE="en" ;;
    esac
}

msg() {
    if [ "$LANG_CODE" = "ru" ]; then
        echo "$1"
    else
        echo "$2"
    fi
}

# Usage:
msg "Установка XMeow UI..." "Installing XMeow UI..."
```

### ANSI Color Helpers
```sh
# Colors (POSIX printf, no bashisms)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { printf "${BLUE}[INFO]${NC} %s\n" "$1"; }
success() { printf "${GREEN}[OK]${NC} %s\n" "$1"; }
warn()    { printf "${YELLOW}[WARN]${NC} %s\n" "$1"; }
error()   { printf "${RED}[ERROR]${NC} %s\n" "$1"; }
die()     { error "$1"; exit 1; }
```

### External-UI Installation into mihomo
```sh
install_extui() {
    # Determine mihomo external-ui directory
    MIHOMO_DIR="/opt/etc/mihomo"
    EXTUI_DIR="$MIHOMO_DIR/ui"

    mkdir -p "$EXTUI_DIR"

    # Download and extract dist.tar.gz
    info "$(msg 'Скачивание SPA для external-ui...' 'Downloading SPA for external-ui...')"
    curl --progress-bar -fSL "$DISTUI_URL" -o /tmp/xmeow-dist.tar.gz || die "Failed to download dist.tar.gz"

    # Verify checksum
    verify_checksum /tmp/xmeow-dist.tar.gz

    # Extract (dist.tar.gz is flat -- files directly inside, no subdirectory)
    tar -xzf /tmp/xmeow-dist.tar.gz -C "$EXTUI_DIR"
    rm -f /tmp/xmeow-dist.tar.gz

    # Update mihomo config.yaml to set external-ui path
    CONFIG_FILE="${MIHOMO_CONFIG_PATH:-/opt/etc/mihomo/config.yaml}"
    if [ -f "$CONFIG_FILE" ]; then
        if grep -q "^external-ui:" "$CONFIG_FILE"; then
            # Update existing line
            sed -i "s|^external-ui:.*|external-ui: $EXTUI_DIR|" "$CONFIG_FILE"
        else
            # Add external-ui line
            echo "external-ui: $EXTUI_DIR" >> "$CONFIG_FILE"
        fi
    fi

    success "$(msg 'External-UI установлен в '"$EXTUI_DIR" 'External-UI installed to '"$EXTUI_DIR")"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `uname -m` for arch | opkg.conf + od fallback | Always been needed for MIPS | Prevents silent binary crash on wrong endianness |
| Direct script execution | Wrapper function `main()` | Best practice since ~2018 | Prevents partial execution from interrupted downloads |
| `source file` | `. file` | POSIX standard | BusyBox ash doesn't support `source` keyword |
| `[[ ]]` test | `[ ]` test | POSIX standard | BusyBox ash doesn't support bash `[[ ]]` |
| Downloading to final path | Download to /tmp, verify, then move | Security best practice | Allows checksum verification before installation |
| `which` command | `command -v` | POSIX standard | `which` is not POSIX; `command -v` is portable |

**Deprecated/outdated:**
- `curl -s` without `-f`: Silently succeeds on HTTP errors; always use `-f` (fail on HTTP error)
- `wget -O -` without `--no-check-certificate`: On some BusyBox builds, TLS verification may fail; provide fallback

## Open Questions

1. **Exact opkg.conf format on target Keenetic**
   - What we know: Contains `src/gz entware` with architecture string like `mipsel-3.4` or `aarch64-3.10`
   - What's unclear: Exact grep pattern needed; might be `mipsel-3` or `mipsel_`
   - Recommendation: Use broad pattern `grep -qi "mipsel" /opt/etc/opkg.conf` -- case-insensitive, substring match

2. **wget as curl fallback**
   - What we know: curl may not be pre-installed on all Entware setups; wget is more common
   - What's unclear: Whether BusyBox wget supports `--progress-bar` equivalent
   - Recommendation: Check for curl first, provide wget fallback with simpler progress output. `wget -O file url` works on BusyBox.

3. **Binary rename from xmeow-ui to xmeow-server**
   - What we know: CONTEXT.md says binary should be `xmeow-server`; CI currently builds `xmeow-ui`
   - What's unclear: Whether to rename in CI (release.yml) or in the installer script
   - Recommendation: Rename in CI (release.yml) -- cleaner, consistent naming in release assets

4. **mihomo external-ui-url conflict**
   - What we know: If `external-ui-url` is set in config.yaml, mihomo will overwrite local external-ui files on restart
   - What's unclear: Whether installer should comment out `external-ui-url`
   - Recommendation: Warn user if `external-ui-url` is detected; suggest commenting it out

## Sources

### Primary (HIGH confidence)
- [OpenWrt MIPS Forum](https://forum.archive.openwrt.org/viewtopic.php?id=71) - `uname -m` returns "mips" for both endiannesses -- CONFIRMED
- [rustup PR #802](https://github.com/rust-lang/rustup/pull/802/files) - MIPS endianness detection issue documented by rust-lang
- [nfqws2-keenetic DeepWiki](https://deepwiki.com/nfqws/nfqws2-keenetic/2-installation-guide) - opkg.conf parsing for MIPS detection on Keenetic
- [GitHub REST API Docs](https://docs.github.com/en/rest/releases/assets) - Release asset download API
- [mihomo General Config](https://wiki.metacubex.one/en/config/general/) - external-ui path format and SAFE_PATHS
- [Entware Wiki](https://github.com/Entware/Entware/wiki/How-to-add-a-new-package) - init.d rc.func template
- [BusyBox sha256sum](https://boxmatrix.info/wiki/Property:sha256sum) - Confirmed BusyBox applet availability

### Secondary (MEDIUM confidence)
- [SNBForums Entware env vars](https://www.snbforums.com/threads/how-to-pass-environment-variables-in-init-d-scripts.79953/) - Sourcing config files in init.d
- [Endianness detection methods](https://grayson.sh/blogs/various-methods-for-finding-endianness) - od-based portable detection
- [curl|sh best practices](https://www.arp242.net/curl-to-sh.html) - Wrapper function pattern
- [Linux Journal TTY detection](https://www.linuxjournal.com/content/determine-if-shell-input-coming-terminal-or-pipe) - `[ -t 0 ]` for pipe detection
- [Keenetic Entware Quickstart](https://forum.keenetic.com/topic/4290-entware-quickstart/) - S99 naming convention

### Tertiary (LOW confidence)
- BusyBox wget progress bar support -- not verified on actual Keenetic BusyBox build

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - POSIX sh + BusyBox tools are well-documented, target environment is known
- Architecture: HIGH - Two-stage MIPS detection is proven pattern (nfqws-keenetic uses same approach)
- Pitfalls: HIGH - All pitfalls verified with primary sources (uname -m issue confirmed by multiple sources)
- Code examples: HIGH - All patterns use POSIX sh constructs verified against BusyBox compatibility

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable domain -- shell scripting and Entware patterns rarely change)
