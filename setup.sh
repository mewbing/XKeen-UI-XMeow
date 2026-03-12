#!/bin/sh
# XMeow UI Setup — install, update, reinstall, uninstall
# Install: curl -sSL https://raw.githubusercontent.com/mewbing/XKeen-UI-XMeow/master/setup.sh | sh
# Usage:   sh setup.sh [install|update|reinstall|uninstall]
# Note:    If copied from Windows, fix line endings first: tr -d '\r' < setup.sh > setup_lf.sh && sh setup_lf.sh

main() {
    set -eu

    # --- Constants ---
    REPO="mewbing/XKeen-UI-XMeow"
    INSTALL_DIR="/opt/etc/xmeow-ui"
    BIN_NAME="xmeow-server"
    CONF_FILE="$INSTALL_DIR/xmeow-ui.conf"
    INITD_SCRIPT="/opt/etc/init.d/S99xmeow-ui"
    PIDFILE="/opt/var/run/xmeow-ui.pid"
    MIHOMO_DIR="/opt/etc/mihomo"
    MIHOMO_CONFIG="$MIHOMO_DIR/config.yaml"
    EXTUI_DIR="$MIHOMO_DIR/ui"
    TMP_DIR="/tmp/xmeow-install"

    # --- ANSI Colors ---
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m'

    # --- Helper functions ---
    info()      { printf "${BLUE}[*]${NC} %s\n" "$1"; }
    success()   { printf "${GREEN}[+]${NC} %s\n" "$1"; }
    warn()      { printf "${YELLOW}[!]${NC} %s\n" "$1"; }
    error_msg() { printf "${RED}[-]${NC} %s\n" "$1"; }
    die()       { error_msg "$1"; cleanup; exit 1; }

    # --- Language detection ---
    detect_lang() {
        case "${LANG:-}" in
            ru_*) LANG_CODE="ru" ;;
            *)    LANG_CODE="en" ;;
        esac
    }

    msg() {
        if [ "$LANG_CODE" = "ru" ]; then
            printf "%s\n" "$1"
        else
            printf "%s\n" "$2"
        fi
    }

    # --- ASCII Logo ---
    print_logo() {
        printf "${CYAN}"
        printf "  __  ____  __                    \n"
        printf "  \\ \\/ /  \\/  | ___  _____      __\n"
        printf "   \\  /| |\\/| |/ _ \\/ _ \\ \\ /\\ / /\n"
        printf "   /  \\| |  | |  __/ (_) \\ V  V / \n"
        printf "  /_/\\_\\_|  |_|\\___|\\___/ \\_/\\_/  \n"
        printf "${NC}\n"
    }

    # --- Architecture detection ---
    detect_arch() {
        MACHINE=$(uname -m)
        case "$MACHINE" in
            aarch64)
                ARCH="arm64"
                ;;
            armv7l)
                ARCH="armv7"
                ;;
            x86_64)
                ARCH="amd64"
                ;;
            mips*)
                # Stage 1: check opkg.conf for endianness hint
                if grep -qi "mipsel" /opt/etc/opkg.conf 2>/dev/null; then
                    ARCH="mipsle"
                elif grep -qi "mips" /opt/etc/opkg.conf 2>/dev/null; then
                    ARCH="mips"
                else
                    # Stage 2: byte order detection fallback
                    BYTE=$(printf 'I' | od -to2 | head -n1 | cut -f2 -d" " | cut -c6)
                    if [ "$BYTE" = "1" ]; then
                        ARCH="mipsle"
                    else
                        ARCH="mips"
                    fi
                fi
                ;;
            *)
                die "$(msg "Неподдерживаемая архитектура: $MACHINE" "Unsupported architecture: $MACHINE")"
                ;;
        esac
        SUFFIX="linux_${ARCH}"
        info "$(msg "Архитектура: $ARCH ($MACHINE)" "Architecture: $ARCH ($MACHINE)")"
    }

    # --- Get latest release ---
    get_latest() {
        info "$(msg "Получение последней версии..." "Fetching latest version...")"
        RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest") || \
            die "$(msg "Не удалось получить информацию о релизе" "Failed to fetch release info")"

        TAG=$(printf '%s' "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name" *: *"\([^"]*\)".*/\1/')
        [ -z "$TAG" ] && die "$(msg "Не удалось определить версию" "Failed to determine version")"

        # Strip leading 'v' for version number
        VERSION=$(printf '%s' "$TAG" | sed 's/^v//')

        ARCHIVE_NAME="${BIN_NAME}_${VERSION}_${SUFFIX}.tar.gz"
        BINARY_URL="https://github.com/$REPO/releases/download/$TAG/$ARCHIVE_NAME"
        CHECKSUM_URL="https://github.com/$REPO/releases/download/$TAG/checksums.txt"
        DISTUI_URL="https://github.com/$REPO/releases/download/$TAG/dist.tar.gz"

        info "$(msg "Найдена версия: $VERSION ($TAG)" "Found version: $VERSION ($TAG)")"
    }

    # --- Download and verify ---
    download_and_verify() {
        mkdir -p "$TMP_DIR"

        info "$(msg "Скачивание $ARCHIVE_NAME..." "Downloading $ARCHIVE_NAME...")"
        curl --progress-bar --retry 3 -fSL -o "$TMP_DIR/$ARCHIVE_NAME" "$BINARY_URL" || \
            die "$(msg "Не удалось скачать бинарник" "Failed to download binary")"

        info "$(msg "Скачивание контрольных сумм..." "Downloading checksums...")"
        curl -fsSL -o "$TMP_DIR/checksums.txt" "$CHECKSUM_URL" || \
            die "$(msg "Не удалось скачать контрольные суммы" "Failed to download checksums")"

        # Verify SHA256
        EXPECTED=$(grep "$ARCHIVE_NAME" "$TMP_DIR/checksums.txt" | awk '{print $1}')
        [ -z "$EXPECTED" ] && die "$(msg "Контрольная сумма для $ARCHIVE_NAME не найдена" "Checksum for $ARCHIVE_NAME not found")"

        ACTUAL=$(sha256sum "$TMP_DIR/$ARCHIVE_NAME" | awk '{print $1}')
        if [ "$EXPECTED" != "$ACTUAL" ]; then
            die "$(msg "Контрольная сумма не совпадает!\n  Ожидалось: $EXPECTED\n  Получено:  $ACTUAL" \
                       "Checksum mismatch!\n  Expected: $EXPECTED\n  Got:      $ACTUAL")"
        fi

        # Extract binary
        tar -xzf "$TMP_DIR/$ARCHIVE_NAME" -C "$TMP_DIR" "$BIN_NAME" || \
            die "$(msg "Не удалось распаковать архив" "Failed to extract archive")"

        success "$(msg "Контрольная сумма OK" "Checksum OK")"
    }

    # --- Install binary ---
    install_binary() {
        mkdir -p "$INSTALL_DIR"
        cp "$TMP_DIR/$BIN_NAME" "$INSTALL_DIR/$BIN_NAME"
        chmod +x "$INSTALL_DIR/$BIN_NAME"

        INSTALLED_VER=$("$INSTALL_DIR/$BIN_NAME" --version 2>/dev/null) || \
            die "$(msg "Бинарник не запускается" "Binary failed to run")"

        success "$(msg "Установлен $BIN_NAME v$INSTALLED_VER" "Installed $BIN_NAME v$INSTALLED_VER")"
    }

    # --- Install external-UI ---
    install_extui() {
        info "$(msg "Скачивание UI..." "Downloading UI...")"
        curl --progress-bar --retry 3 -fSL -o "$TMP_DIR/dist.tar.gz" "$DISTUI_URL" || \
            die "$(msg "Не удалось скачать UI" "Failed to download UI")"

        # Verify dist.tar.gz checksum
        EXPECTED_UI=$(grep "dist.tar.gz" "$TMP_DIR/checksums.txt" | awk '{print $1}')
        if [ -n "$EXPECTED_UI" ]; then
            ACTUAL_UI=$(sha256sum "$TMP_DIR/dist.tar.gz" | awk '{print $1}')
            if [ "$EXPECTED_UI" != "$ACTUAL_UI" ]; then
                die "$(msg "Контрольная сумма UI не совпадает!" "UI checksum mismatch!")"
            fi
        fi

        mkdir -p "$EXTUI_DIR"
        tar -xzf "$TMP_DIR/dist.tar.gz" -C "$EXTUI_DIR" || \
            die "$(msg "Не удалось распаковать UI" "Failed to extract UI")"

        # Update mihomo config.yaml for external-ui
        if [ -f "$MIHOMO_CONFIG" ]; then
            if grep -q "^external-ui:" "$MIHOMO_CONFIG"; then
                sed -i "s|^external-ui:.*|external-ui: ui|" "$MIHOMO_CONFIG"
            else
                printf "\nexternal-ui: ui\n" >> "$MIHOMO_CONFIG"
            fi

            # Warn about external-ui-url overwriting local files
            if grep -q "^external-ui-url:" "$MIHOMO_CONFIG"; then
                warn "$(msg "external-ui-url задан в config.yaml -- mihomo будет перезаписывать UI при рестарте. Рекомендуется закомментировать эту строку." \
                         "external-ui-url is set in config.yaml -- mihomo will overwrite UI files on restart. Consider commenting it out.")"
            fi
        else
            warn "$(msg "Файл $MIHOMO_CONFIG не найден -- external-ui не настроен" \
                       "$MIHOMO_CONFIG not found -- external-ui not configured")"
        fi

        success "$(msg "UI установлен в $EXTUI_DIR" "UI installed to $EXTUI_DIR")"
    }

    # --- Create config file ---
    create_config() {
        if [ -f "$CONF_FILE" ]; then
            info "$(msg "Конфиг $CONF_FILE уже существует -- пропускаем" "Config $CONF_FILE already exists -- skipping")"
        else
            cat > "$CONF_FILE" << 'CONF_EOF'
PORT=5000
MIHOMO_CONFIG_PATH=/opt/etc/mihomo/config.yaml
XKEEN_DIR=/opt/etc/xkeen
XKEEN_LOG_DIR=/opt/var/log/xray
CONF_EOF
            success "$(msg "Конфиг создан: $CONF_FILE" "Config created: $CONF_FILE")"
        fi
    }

    # --- Create init.d script ---
    create_initd() {
        cat > "$INITD_SCRIPT" << 'INITD_EOF'
#!/bin/sh
CONF="/opt/etc/xmeow-ui/xmeow-ui.conf"
BIN="/opt/etc/xmeow-ui/xmeow-server"
PIDFILE="/opt/var/run/xmeow-ui.pid"

[ -f "$CONF" ] && . "$CONF"

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
            "$BIN" > /dev/null 2>&1 &
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
INITD_EOF
        chmod +x "$INITD_SCRIPT"
        mkdir -p /opt/var/run
        success "$(msg "Сервис создан: $INITD_SCRIPT" "Service created: $INITD_SCRIPT")"
    }

    # --- Start and verify ---
    start_and_verify() {
        "$INITD_SCRIPT" stop 2>/dev/null || true
        "$INITD_SCRIPT" start

        info "$(msg "Ожидание запуска..." "Waiting for startup...")"
        sleep 2

        if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
            success "$(msg "Сервис запущен (PID $(cat "$PIDFILE"))" "Service running (PID $(cat "$PIDFILE"))")"
        else
            warn "$(msg "Сервис не запустился -- проверьте логи" "Service failed to start -- check logs")"
        fi

        # Health check (non-fatal -- mihomo may not be configured yet)
        if curl -sf "http://127.0.0.1:${PORT:-5000}/api/health" > /dev/null 2>&1; then
            success "$(msg "Health check пройден" "Health check passed")"
        else
            warn "$(msg "Health check не пройден -- mihomo может быть не настроен" \
                       "Health check failed -- mihomo may not be configured yet")"
        fi
    }

    # --- Stop service ---
    stop_service() {
        if [ -f "$INITD_SCRIPT" ]; then
            "$INITD_SCRIPT" stop 2>/dev/null || true
        elif [ -f "$PIDFILE" ]; then
            kill "$(cat "$PIDFILE")" 2>/dev/null || true
            rm -f "$PIDFILE"
        fi
    }

    # --- Get current version ---
    get_current_version() {
        if [ -x "$INSTALL_DIR/$BIN_NAME" ]; then
            CUR_VER=$("$INSTALL_DIR/$BIN_NAME" --version 2>/dev/null) || CUR_VER="?"
        else
            CUR_VER=""
        fi
    }

    # --- Cleanup ---
    cleanup() {
        rm -rf "$TMP_DIR" 2>/dev/null || true
    }

    # --- Auto-detect IP ---
    detect_ip() {
        IP=$(ip route get 1 2>/dev/null | grep -o 'src [0-9.]*' | awk '{print $2}') || true
        if [ -z "$IP" ]; then
            IP=$(hostname -I 2>/dev/null | awk '{print $1}') || true
        fi
        if [ -z "$IP" ]; then
            IP="<router-ip>"
        fi
    }

    # --- Success message ---
    print_success() {
        detect_ip
        printf "\n${GREEN}${BOLD}"
        printf "====================================\n"
        printf " XMeow UI v%s $(msg "установлен!" "installed!")\n" "$VERSION"
        printf "====================================\n"
        printf "${NC}${GREEN}"
        printf " Dashboard: http://%s:%s\n" "$IP" "${PORT:-5000}"
        printf " Service:   %s {start|stop|restart|status}\n" "$INITD_SCRIPT"
        printf " Config:    %s\n" "$CONF_FILE"
        printf "====================================\n"
        printf "${NC}\n"
    }

    # =====================
    #   MODE: INSTALL
    # =====================
    do_install() {
        msg "Установка XMeow UI..." "Installing XMeow UI..."
        detect_arch
        get_latest
        download_and_verify
        install_binary
        install_extui
        create_config
        create_initd
        start_and_verify
        cleanup
        print_success
    }

    # =====================
    #   MODE: UPDATE
    # =====================
    do_update() {
        get_current_version
        if [ -z "$CUR_VER" ]; then
            die "$(msg "XMeow UI не установлен. Используйте: setup.sh install" \
                       "XMeow UI is not installed. Use: setup.sh install")"
        fi
        info "$(msg "Текущая версия: $CUR_VER" "Current version: $CUR_VER")"

        msg "Обновление XMeow UI..." "Updating XMeow UI..."
        detect_arch
        get_latest

        if [ "$CUR_VER" = "$VERSION" ]; then
            success "$(msg "Уже установлена последняя версия ($VERSION)" \
                          "Already running the latest version ($VERSION)")"
            return 0
        fi

        download_and_verify
        stop_service
        install_binary
        install_extui
        create_initd
        start_and_verify
        cleanup

        detect_ip
        printf "\n${GREEN}${BOLD}"
        printf "====================================\n"
        printf " XMeow UI $(msg "обновлен" "updated"): %s -> %s\n" "$CUR_VER" "$VERSION"
        printf "====================================\n"
        printf "${NC}${GREEN}"
        printf " Dashboard: http://%s:%s\n" "$IP" "${PORT:-5000}"
        printf "====================================\n"
        printf "${NC}\n"
    }

    # =====================
    #   MODE: REINSTALL
    # =====================
    do_reinstall() {
        msg "Переустановка XMeow UI..." "Reinstalling XMeow UI..."
        stop_service

        # Remove binary and init script, keep config
        rm -f "$INSTALL_DIR/$BIN_NAME"
        rm -f "$INITD_SCRIPT"
        rm -rf "$EXTUI_DIR"
        rm -f "$PIDFILE"
        info "$(msg "Файлы удалены" "Files removed")"

        # Full install
        do_install
    }

    # =====================
    #   MODE: UNINSTALL
    # =====================
    do_uninstall() {
        msg "Удаление XMeow UI..." "Uninstalling XMeow UI..."

        stop_service

        # Remove binary
        if [ -f "$INSTALL_DIR/$BIN_NAME" ]; then
            rm -f "$INSTALL_DIR/$BIN_NAME"
            success "$(msg "Бинарник удален" "Binary removed")"
        fi

        # Remove init.d script
        if [ -f "$INITD_SCRIPT" ]; then
            rm -f "$INITD_SCRIPT"
            success "$(msg "Сервис удален" "Service removed")"
        fi

        # Remove UI files
        if [ -d "$EXTUI_DIR" ]; then
            rm -rf "$EXTUI_DIR"
            success "$(msg "UI удален" "UI removed")"
        fi

        # Remove PID file
        rm -f "$PIDFILE"

        # Ask about config
        if [ -f "$CONF_FILE" ]; then
            printf "${YELLOW}[?]${NC} $(msg "Удалить конфиг $CONF_FILE? (y/N): " \
                                            "Remove config $CONF_FILE? (y/N): ")"
            read -r REPLY < /dev/tty 2>/dev/null || REPLY="n"
            case "$REPLY" in
                y|Y|yes|Yes)
                    rm -rf "$INSTALL_DIR"
                    success "$(msg "Конфиг удален" "Config removed")"
                    ;;
                *)
                    info "$(msg "Конфиг сохранен: $CONF_FILE" "Config kept: $CONF_FILE")"
                    ;;
            esac
        fi

        printf "\n${GREEN}${BOLD}"
        printf "====================================\n"
        msg " XMeow UI удален!" " XMeow UI uninstalled!"
        printf "====================================\n"
        printf "${NC}\n"
    }

    # =====================
    #   INTERACTIVE MENU
    # =====================
    show_menu() {
        get_current_version

        printf "\n"
        if [ -n "$CUR_VER" ]; then
            info "$(msg "Установленная версия: $CUR_VER" "Installed version: $CUR_VER")"
        else
            info "$(msg "XMeow UI не установлен" "XMeow UI is not installed")"
        fi
        printf "\n"

        printf "  ${BOLD}1)${NC} $(msg "Установить" "Install")         $(msg "— полная установка" "— full installation")\n"
        printf "  ${BOLD}2)${NC} $(msg "Обновить" "Update")            $(msg "— скачать последнюю версию" "— download latest version")\n"
        printf "  ${BOLD}3)${NC} $(msg "Переустановить" "Reinstall")   $(msg "— удалить и установить заново" "— remove and install fresh")\n"
        printf "  ${BOLD}4)${NC} $(msg "Удалить" "Uninstall")          $(msg "— полное удаление" "— complete removal")\n"
        printf "  ${BOLD}0)${NC} $(msg "Выход" "Exit")\n"
        printf "\n"

        printf "$(msg "Выберите действие" "Select action") [0-4]: "
        read -r CHOICE < /dev/tty 2>/dev/null || CHOICE="0"

        case "$CHOICE" in
            1) do_install ;;
            2) do_update ;;
            3) do_reinstall ;;
            4) do_uninstall ;;
            0) msg "Выход." "Bye."; exit 0 ;;
            *) die "$(msg "Неверный выбор: $CHOICE" "Invalid choice: $CHOICE")" ;;
        esac
    }

    # --- Main flow ---
    detect_lang
    print_logo

    [ "$(id -u)" -ne 0 ] && die "$(msg "Требуются права root. Запустите: sudo sh setup.sh" \
                                       "Root required. Run: sudo sh setup.sh")"

    ACTION="${1:-}"

    case "$ACTION" in
        install)    do_install ;;
        update)     do_update ;;
        reinstall)  do_reinstall ;;
        uninstall)  do_uninstall ;;
        "")         show_menu ;;
        *)
            error_msg "$(msg "Неизвестная команда: $ACTION" "Unknown command: $ACTION")"
            printf "\n$(msg "Использование" "Usage"): setup.sh [install|update|reinstall|uninstall]\n"
            exit 1
            ;;
    esac
}

main "$@"
