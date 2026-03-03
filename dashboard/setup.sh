#!/bin/sh
# XMeow UI Installer for Keenetic routers with Entware
# Usage: curl -sL https://raw.githubusercontent.com/mewbing/XKeen-UI-Xmeow/main/setup.sh | sh
# Or:    sh setup.sh [--install|--update|--uninstall]
set -e

main() {

# ─── Constants ────────────────────────────────────────────────────────

REPO="mewbing/XKeen-UI-Xmeow"
API_URL="https://api.github.com/repos/$REPO/releases/latest"
INSTALL_DIR="/opt/etc/xmeow-ui"
BIN_NAME="xmeow-server"
BIN_PATH="$INSTALL_DIR/$BIN_NAME"
CONF_PATH="$INSTALL_DIR/xmeow-ui.conf"
INITD_PATH="/opt/etc/init.d/S99xmeow-ui"
PIDFILE="/opt/var/run/xmeow-ui.pid"
MIHOMO_DIR="/opt/etc/mihomo"
EXTUI_DIR="$MIHOMO_DIR/ui"
TMP_DIR="/tmp/xmeow-install"
SCRIPT_VER="1.0.0"

# ─── Colors (POSIX printf) ───────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Color helpers ────────────────────────────────────────────────────

info()    { printf "${BLUE}[INFO]${NC} %s\n" "$1"; }
success() { printf "${GREEN}[OK]${NC} %s\n" "$1"; }
warn()    { printf "${YELLOW}[!]${NC} %s\n" "$1"; }
error()   { printf "${RED}[ERROR]${NC} %s\n" "$1"; }
die()     { error "$1"; cleanup; exit 1; }

# ─── Cleanup trap ─────────────────────────────────────────────────────

cleanup() {
    rm -rf "$TMP_DIR" 2>/dev/null || true
}

trap cleanup EXIT

# ─── Language detection ───────────────────────────────────────────────

detect_lang() {
    case "${LANG:-}" in
        ru_*|ru) LANG_CODE="ru" ;;
        *)       LANG_CODE="en" ;;
    esac
}

msg() {
    if [ "$LANG_CODE" = "ru" ]; then
        printf '%s' "$1"
    else
        printf '%s' "$2"
    fi
}

msgln() {
    if [ "$LANG_CODE" = "ru" ]; then
        printf '%s\n' "$1"
    else
        printf '%s\n' "$2"
    fi
}

# ─── ASCII logo ───────────────────────────────────────────────────────

print_logo() {
    printf "${CYAN}${BOLD}"
    printf '  __  ____  __                     _   _ ___ \n'
    printf '  \\ \\/ /  \\/  | ___  _____      __| | | |_ _|\n'
    printf '   \\  /| |\\/| |/ _ \\/ _ \\ \\ /\\ / /| | | || | \n'
    printf '   /  \\| |  | |  __/ (_) \\ V  V / | |_| || | \n'
    printf '  /_/\\_\\_|  |_|\\___|\\___/ \\_/\\_/   \\___/|___|\n'
    printf "${NC}\n"
    printf "  ${BOLD}XMeow UI Dashboard${NC} — $(msg 'установщик' 'installer') v${SCRIPT_VER}\n"
    printf "  ${BLUE}https://github.com/${REPO}${NC}\n\n"
}

# ─── TTY detection ────────────────────────────────────────────────────

detect_tty() {
    if [ -t 0 ]; then
        TTY_MODE="direct"
    else
        TTY_MODE="pipe"
    fi
}

prompt() {
    local _var="$1"
    local _prompt="$2"
    local _reply=""
    printf "%s" "$_prompt"
    if [ "$TTY_MODE" = "pipe" ]; then
        read -r _reply < /dev/tty
    else
        read -r _reply
    fi
    eval "$_var=\"\$_reply\""
}

# ─── Architecture detection ──────────────────────────────────────────

detect_arch() {
    local raw_arch
    raw_arch=$(uname -m)

    case "$raw_arch" in
        aarch64)
            ARCH="arm64"
            ;;
        armv7l|armv7)
            ARCH="armv7"
            ;;
        x86_64)
            ARCH="amd64"
            ;;
        mips*)
            # Stage 1: Parse opkg.conf for Entware architecture
            if [ -f /opt/etc/opkg.conf ] && grep -qi "mipsel" /opt/etc/opkg.conf 2>/dev/null; then
                ARCH="mipsle"
            elif [ -f /opt/etc/opkg.conf ] && grep -qi "mips" /opt/etc/opkg.conf 2>/dev/null; then
                ARCH="mips"
            else
                # Stage 2: Portable endianness detection via od
                local endian_byte
                endian_byte=$(echo -n I | od -to2 | head -n1 | cut -f2 -d" " | cut -c6)
                if [ "$endian_byte" = "1" ]; then
                    ARCH="mipsle"
                else
                    ARCH="mips"
                fi
            fi
            ;;
        *)
            die "$(msg "Неподдерживаемая архитектура: $raw_arch" "Unsupported architecture: $raw_arch")"
            ;;
    esac

    info "$(msg "Архитектура: $ARCH" "Architecture: $ARCH")"
}

# ─── HTTP client ──────────────────────────────────────────────────────

check_http_client() {
    if command -v curl >/dev/null 2>&1; then
        HTTP_CLIENT="curl"
    elif command -v wget >/dev/null 2>&1; then
        HTTP_CLIENT="wget"
    else
        die "$(msg 'curl или wget не найдены. Установите: opkg install curl' 'curl or wget not found. Install: opkg install curl')"
    fi
}

# Silent download (API calls, checksums)
download_silent() {
    local url="$1"
    local output="$2"

    if [ "$HTTP_CLIENT" = "curl" ]; then
        if [ -n "$output" ]; then
            curl --retry 3 -fsSL "$url" -o "$output"
        else
            curl --retry 3 -fsSL "$url"
        fi
    else
        if [ -n "$output" ]; then
            wget -q -O "$output" "$url"
        else
            wget -qO- "$url"
        fi
    fi
}

# Progress download (binary, dist)
download_progress() {
    local url="$1"
    local output="$2"

    if [ "$HTTP_CLIENT" = "curl" ]; then
        curl --retry 3 --progress-bar -fSL "$url" -o "$output"
    else
        wget --show-progress -q -O "$output" "$url" 2>&1 || wget -O "$output" "$url"
    fi
}

# ─── GitHub API ───────────────────────────────────────────────────────

get_latest() {
    info "$(msg 'Получение информации о последнем релизе...' 'Fetching latest release info...')"

    local release_json
    release_json=$(download_silent "$API_URL" "") || die "$(msg 'Не удалось получить информацию о релизе' 'Failed to fetch release info')"

    LATEST_VER=$(printf '%s' "$release_json" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name" *: *"\([^"]*\)".*/\1/')
    LATEST_VER_NUM=$(printf '%s' "$LATEST_VER" | sed 's/^v//')

    if [ -z "$LATEST_VER_NUM" ]; then
        die "$(msg 'Не удалось определить версию релиза' 'Failed to determine release version')"
    fi

    BINARY_NAME="xmeow-server_${LATEST_VER_NUM}_linux_${ARCH}.tar.gz"
    DOWNLOAD_URL="https://github.com/$REPO/releases/download/$LATEST_VER/$BINARY_NAME"
    CHECKSUM_URL="https://github.com/$REPO/releases/download/$LATEST_VER/checksums.txt"
    DISTUI_URL="https://github.com/$REPO/releases/download/$LATEST_VER/dist.tar.gz"

    success "$(msg "Последняя версия: $LATEST_VER_NUM" "Latest version: $LATEST_VER_NUM")"
}

# ─── Checksum verification ───────────────────────────────────────────

verify_checksum() {
    local file="$1"
    local basename_file
    basename_file=$(basename "$file")

    info "$(msg "Проверка контрольной суммы $basename_file..." "Verifying checksum for $basename_file...")"

    local checksum_file="$TMP_DIR/checksums.txt"
    if [ ! -f "$checksum_file" ]; then
        download_silent "$CHECKSUM_URL" "$checksum_file" || die "$(msg 'Не удалось скачать checksums.txt' 'Failed to download checksums.txt')"
    fi

    local expected
    expected=$(grep "$basename_file" "$checksum_file" | awk '{print $1}')
    if [ -z "$expected" ]; then
        die "$(msg "Контрольная сумма не найдена для $basename_file" "Checksum not found for $basename_file")"
    fi

    local actual
    actual=$(sha256sum "$file" | awk '{print $1}')

    if [ "$expected" != "$actual" ]; then
        die "$(msg "Контрольная сумма не совпадает! Ожидалось: $expected, Получено: $actual" "Checksum mismatch! Expected: $expected, Got: $actual")"
    fi

    success "$(msg 'Контрольная сумма верна' 'Checksum verified OK')"
}

# ─── IP detection ─────────────────────────────────────────────────────

get_local_ip() {
    local ip=""

    # Method 1: ip route
    ip=$(ip route get 1 2>/dev/null | grep -o 'src [0-9.]*' | awk '{print $2}')

    # Method 2: hostname -I
    if [ -z "$ip" ]; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi

    # Method 3: ifconfig parsing
    if [ -z "$ip" ]; then
        ip=$(ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}' | sed 's/addr://')
    fi

    printf '%s' "${ip:-<router-ip>}"
}

# ─── Config file creation ────────────────────────────────────────────

create_config() {
    if [ -f "$CONF_PATH" ]; then
        info "$(msg 'Конфиг уже существует, пропускаем' 'Config already exists, skipping')"
        return 0
    fi

    info "$(msg 'Создание конфигурации...' 'Creating configuration...')"

    cat > "$CONF_PATH" << 'CONF_EOF'
PORT=5000
MIHOMO_CONFIG_PATH=/opt/etc/mihomo/config.yaml
XKEEN_DIR=/opt/etc/xkeen
XKEEN_LOG_DIR=/opt/var/log/xray
CONF_EOF

    success "$(msg "Конфиг создан: $CONF_PATH" "Config created: $CONF_PATH")"
}

# ─── init.d script creation ──────────────────────────────────────────

create_initd() {
    info "$(msg 'Создание init.d сервиса...' 'Creating init.d service...')"

    cat > "$INITD_PATH" << 'INITD_EOF'
#!/bin/sh
# /opt/etc/init.d/S99xmeow-ui — XMeow UI Dashboard Service

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
            rm -f "$PIDFILE"
            echo "Starting xmeow-ui..."
            "$BIN" >> /opt/var/log/xmeow-ui.log 2>&1 &
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
                echo "xmeow-ui stopped"
            else
                echo "xmeow-ui not running (stale PID file)"
                rm -f "$PIDFILE"
            fi
        else
            # Fallback: try pidof
            PID=$(pidof xmeow-server 2>/dev/null || true)
            if [ -n "$PID" ]; then
                echo "Stopping xmeow-ui (PID $PID)..."
                kill "$PID"
                echo "xmeow-ui stopped"
            else
                echo "xmeow-ui not running"
            fi
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
            PID=$(pidof xmeow-server 2>/dev/null || true)
            if [ -n "$PID" ]; then
                echo "xmeow-ui running (PID $PID, no PID file)"
            else
                echo "xmeow-ui not running"
            fi
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
INITD_EOF

    chmod +x "$INITD_PATH"
    success "$(msg "init.d сервис создан: $INITD_PATH" "init.d service created: $INITD_PATH")"
}

# ─── External-UI installation ────────────────────────────────────────

install_extui() {
    info "$(msg 'Установка External-UI (SPA дашборд)...' 'Installing External-UI (SPA dashboard)...')"

    mkdir -p "$EXTUI_DIR"

    local dist_file="$TMP_DIR/dist.tar.gz"
    msgln "$(msg 'Скачивание SPA...' 'Downloading SPA...')"
    download_progress "$DISTUI_URL" "$dist_file" || die "$(msg 'Не удалось скачать dist.tar.gz' 'Failed to download dist.tar.gz')"

    verify_checksum "$dist_file"

    # Extract (dist.tar.gz is flat — files directly inside)
    tar -xzf "$dist_file" -C "$EXTUI_DIR" || die "$(msg 'Не удалось распаковать dist.tar.gz' 'Failed to extract dist.tar.gz')"

    # Update mihomo config.yaml: set external-ui path
    local config_file="${MIHOMO_CONFIG_PATH:-/opt/etc/mihomo/config.yaml}"
    if [ -f "$config_file" ]; then
        if grep -q "^external-ui:" "$config_file" 2>/dev/null; then
            sed -i "s|^external-ui:.*|external-ui: $EXTUI_DIR|" "$config_file"
        else
            printf '\nexternal-ui: %s\n' "$EXTUI_DIR" >> "$config_file"
        fi

        # Warn about external-ui-url conflict
        if grep -q "^external-ui-url:" "$config_file" 2>/dev/null; then
            warn "$(msg "Обнаружен external-ui-url в $config_file" "Found external-ui-url in $config_file")"
            warn "$(msg 'Рекомендуем закомментировать эту строку, иначе mihomo перезапишет локальные файлы' 'Consider commenting it out, otherwise mihomo will overwrite local files')"
        fi
    else
        warn "$(msg "mihomo config не найден: $config_file" "mihomo config not found: $config_file")"
    fi

    success "$(msg "External-UI установлен: $EXTUI_DIR" "External-UI installed: $EXTUI_DIR")"
}

# ─── Print success ────────────────────────────────────────────────────

print_success() {
    local version="$1"
    local ip
    ip=$(get_local_ip)
    local port=5000
    if [ -f "$CONF_PATH" ]; then
        local conf_port
        conf_port=$(grep "^PORT=" "$CONF_PATH" 2>/dev/null | cut -d= -f2)
        if [ -n "$conf_port" ]; then
            port="$conf_port"
        fi
    fi

    printf "\n"
    printf "  ${GREEN}${BOLD}================================================${NC}\n"
    msgln "$(msg "  ${GREEN}${BOLD}  XMeow UI успешно установлен!${NC}" "  ${GREEN}${BOLD}  XMeow UI installed successfully!${NC}")"
    printf "  ${GREEN}${BOLD}================================================${NC}\n"
    printf "\n"
    msgln "$(msg "  ${BOLD}Версия:${NC}     $version" "  ${BOLD}Version:${NC}     $version")"
    printf "  ${BOLD}Dashboard:${NC}  http://%s:%s\n" "$ip" "$port"
    printf "  ${BOLD}External-UI:${NC} http://%s:9090/ui\n" "$ip"
    printf "\n"
    msgln "$(msg "  ${BOLD}Управление сервисом:${NC}" "  ${BOLD}Service commands:${NC}")"
    printf "    ${CYAN}%s start${NC}    — $(msg 'Запустить' 'Start')\n" "$INITD_PATH"
    printf "    ${CYAN}%s stop${NC}     — $(msg 'Остановить' 'Stop')\n" "$INITD_PATH"
    printf "    ${CYAN}%s restart${NC}  — $(msg 'Перезапустить' 'Restart')\n" "$INITD_PATH"
    printf "    ${CYAN}%s status${NC}   — $(msg 'Статус' 'Status')\n" "$INITD_PATH"
    printf "\n"
}

# ─── do_install ───────────────────────────────────────────────────────

do_install() {
    # Check if already installed
    if [ -f "$BIN_PATH" ]; then
        warn "$(msg 'XMeow UI уже установлен.' 'XMeow UI is already installed.')"
        local current_ver
        current_ver=$("$BIN_PATH" --version 2>/dev/null || printf 'unknown')
        msgln "$(msg "Текущая версия: $current_ver" "Current version: $current_ver")"
        msgln "$(msg 'Используйте опцию "Обновить" для обновления.' 'Use "Update" option to update.')"
        return 0
    fi

    detect_arch
    get_latest
    check_http_client

    mkdir -p "$TMP_DIR" "$INSTALL_DIR"

    # Download binary archive
    local archive="$TMP_DIR/$BINARY_NAME"
    info "$(msg "Скачивание $BIN_NAME v$LATEST_VER_NUM ($ARCH)..." "Downloading $BIN_NAME v$LATEST_VER_NUM ($ARCH)...")"
    download_progress "$DOWNLOAD_URL" "$archive" || die "$(msg 'Не удалось скачать бинарник' 'Failed to download binary')"

    # Verify checksum
    verify_checksum "$archive"

    # Extract binary
    info "$(msg 'Распаковка...' 'Extracting...')"
    tar -xzf "$archive" -C "$TMP_DIR" || die "$(msg 'Не удалось распаковать архив' 'Failed to extract archive')"

    if [ ! -f "$TMP_DIR/$BIN_NAME" ]; then
        die "$(msg "Бинарник $BIN_NAME не найден в архиве" "Binary $BIN_NAME not found in archive")"
    fi

    mv "$TMP_DIR/$BIN_NAME" "$BIN_PATH"
    chmod +x "$BIN_PATH"
    success "$(msg "Бинарник установлен: $BIN_PATH" "Binary installed: $BIN_PATH")"

    # Create config (only if not exists)
    create_config

    # Create init.d (always overwrite)
    create_initd

    # Install external-UI
    install_extui

    # Start service
    info "$(msg 'Запуск сервиса...' 'Starting service...')"
    "$INITD_PATH" start

    # Wait and verify
    sleep 2
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        success "$(msg 'Сервис запущен' 'Service is running')"
    else
        local pid
        pid=$(pidof "$BIN_NAME" 2>/dev/null || true)
        if [ -n "$pid" ]; then
            success "$(msg "Сервис запущен (PID $pid)" "Service is running (PID $pid)")"
        else
            warn "$(msg 'Сервис не запустился. Проверьте логи: /opt/var/log/xmeow-ui.log' 'Service may not have started. Check logs: /opt/var/log/xmeow-ui.log')"
        fi
    fi

    print_success "$LATEST_VER_NUM"
}

# ─── do_update ────────────────────────────────────────────────────────

do_update() {
    # Check if installed
    if [ ! -f "$BIN_PATH" ]; then
        die "$(msg 'XMeow UI не установлен. Сначала выполните установку.' 'XMeow UI is not installed. Please install first.')"
    fi

    local current_ver
    current_ver=$("$BIN_PATH" --version 2>/dev/null || printf 'unknown')
    info "$(msg "Текущая версия: $current_ver" "Current version: $current_ver")"

    detect_arch
    get_latest
    check_http_client

    # Compare versions
    if [ "$current_ver" = "$LATEST_VER_NUM" ]; then
        success "$(msg "Уже установлена последняя версия ($current_ver)" "Already on latest version ($current_ver)")"
        return 0
    fi

    info "$(msg "Обновление: $current_ver -> $LATEST_VER_NUM" "Updating: $current_ver -> $LATEST_VER_NUM")"

    mkdir -p "$TMP_DIR"

    # Download new binary
    local archive="$TMP_DIR/$BINARY_NAME"
    info "$(msg "Скачивание $BIN_NAME v$LATEST_VER_NUM ($ARCH)..." "Downloading $BIN_NAME v$LATEST_VER_NUM ($ARCH)...")"
    download_progress "$DOWNLOAD_URL" "$archive" || die "$(msg 'Не удалось скачать бинарник' 'Failed to download binary')"

    # Verify checksum
    verify_checksum "$archive"

    # Extract binary to tmp
    tar -xzf "$archive" -C "$TMP_DIR" || die "$(msg 'Не удалось распаковать архив' 'Failed to extract archive')"

    if [ ! -f "$TMP_DIR/$BIN_NAME" ]; then
        die "$(msg "Бинарник $BIN_NAME не найден в архиве" "Binary $BIN_NAME not found in archive")"
    fi

    # Stop service
    info "$(msg 'Остановка сервиса...' 'Stopping service...')"
    "$INITD_PATH" stop 2>/dev/null || true
    sleep 1

    # Backup old binary
    local backup_path="$INSTALL_DIR/${BIN_NAME}.${current_ver}"
    cp "$BIN_PATH" "$backup_path"
    info "$(msg "Бэкап создан: $backup_path" "Backup created: $backup_path")"

    # Replace binary
    mv "$TMP_DIR/$BIN_NAME" "$BIN_PATH"
    chmod +x "$BIN_PATH"

    # Overwrite init.d (DO NOT touch .conf)
    create_initd

    # Start service
    info "$(msg 'Запуск сервиса...' 'Starting service...')"
    "$INITD_PATH" start

    # Wait and verify
    sleep 2
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        success "$(msg 'Сервис запущен' 'Service is running')"
    else
        local pid
        pid=$(pidof "$BIN_NAME" 2>/dev/null || true)
        if [ -n "$pid" ]; then
            success "$(msg "Сервис запущен (PID $pid)" "Service is running (PID $pid)")"
        else
            warn "$(msg 'Сервис не запустился. Проверьте логи: /opt/var/log/xmeow-ui.log' 'Service may not have started. Check logs: /opt/var/log/xmeow-ui.log')"
        fi
    fi

    print_success "$LATEST_VER_NUM"
}

# ─── do_uninstall ─────────────────────────────────────────────────────

do_uninstall() {
    # Check if installed
    if [ ! -f "$BIN_PATH" ] && [ ! -f "$INITD_PATH" ]; then
        die "$(msg 'XMeow UI не установлен.' 'XMeow UI is not installed.')"
    fi

    warn "$(msg 'Удаление XMeow UI...' 'Uninstalling XMeow UI...')"

    # Stop service
    if [ -f "$INITD_PATH" ]; then
        info "$(msg 'Остановка сервиса...' 'Stopping service...')"
        "$INITD_PATH" stop 2>/dev/null || true
        sleep 1
    fi

    # Remove binary
    if [ -f "$BIN_PATH" ]; then
        rm -f "$BIN_PATH"
        success "$(msg "Бинарник удален: $BIN_PATH" "Binary removed: $BIN_PATH")"
    fi

    # Remove init.d
    if [ -f "$INITD_PATH" ]; then
        rm -f "$INITD_PATH"
        success "$(msg "init.d сервис удален: $INITD_PATH" "init.d service removed: $INITD_PATH")"
    fi

    # Remove PID file
    rm -f "$PIDFILE" 2>/dev/null || true

    # Ask about config and backups
    local remove_all=""
    printf "\n"
    prompt remove_all "$(msg 'Удалить конфиг и бэкапы? (y/N): ' 'Remove config and backups? (y/N): ')"

    case "$remove_all" in
        y|Y|yes|YES|да|ДА)
            rm -rf "$INSTALL_DIR"
            success "$(msg "Директория удалена: $INSTALL_DIR" "Directory removed: $INSTALL_DIR")"
            ;;
        *)
            info "$(msg "Конфиг сохранен: $CONF_PATH" "Config preserved: $CONF_PATH")"
            ;;
    esac

    printf "\n"
    success "$(msg 'XMeow UI удален.' 'XMeow UI uninstalled.')"
    msgln "$(msg 'Файлы mihomo и external-ui не были затронуты.' 'mihomo files and external-ui were not touched.')"
    printf "\n"
}

# ─── Menu ─────────────────────────────────────────────────────────────

show_menu() {
    print_logo

    printf "  ${BOLD}$(msg 'Выберите действие:' 'Select action:')${NC}\n\n"
    printf "    ${CYAN}1)${NC} $(msg 'Установить' 'Install') / Install\n"
    printf "    ${CYAN}2)${NC} $(msg 'Обновить' 'Update') / Update\n"
    printf "    ${CYAN}3)${NC} $(msg 'Удалить' 'Uninstall') / Uninstall\n"
    printf "\n"

    local choice=""
    prompt choice "  $(msg 'Введите номер [1-3]: ' 'Enter number [1-3]: ')"

    case "$choice" in
        1) do_install ;;
        2) do_update ;;
        3) do_uninstall ;;
        *)
            die "$(msg "Неверный выбор: $choice" "Invalid choice: $choice")"
            ;;
    esac
}

# ─── Entry point ──────────────────────────────────────────────────────

detect_lang
detect_tty
check_http_client

case "${1:-}" in
    --install)
        do_install
        ;;
    --update)
        do_update
        ;;
    --uninstall)
        do_uninstall
        ;;
    *)
        show_menu
        ;;
esac

}

# Wrapper function pattern: ensures entire script is downloaded before execution
main "$@"
