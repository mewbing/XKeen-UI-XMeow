#!/bin/sh
# XMeow UI Setup — install, update, reinstall, uninstall
# Agent:  curl -sSL https://raw.githubusercontent.com/mewbing/XKeen-UI-XMeow/master/setup.sh | sh -s -- --agent
# Install: curl -sSL https://raw.githubusercontent.com/mewbing/XKeen-UI-XMeow/master/setup.sh | sh
# Usage:   sh setup.sh [install|update|reinstall|uninstall|--agent]
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
    EXTUI_BACKUP="$INSTALL_DIR/.extui-backup"
    XMEOW_EXTUI_URL="https://github.com/$REPO/releases/latest/download/dist.tar.gz"
    TMP_DIR="/tmp/xmeow-install"

    # --- Agent Constants ---
    AGENT_BIN="xmeow-agent"
    AGENT_CONF="$INSTALL_DIR/agent.conf"
    AGENT_INITD="/opt/etc/init.d/S99xmeow-agent"
    AGENT_PIDFILE="/opt/var/run/xmeow-agent.pid"
    XMEOW_CMD="/opt/sbin/xmeow"

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
            # Backup original external-ui settings (only on first install)
            if [ ! -f "$EXTUI_BACKUP" ]; then
                ORIG_EXTUI=$(grep "^external-ui:" "$MIHOMO_CONFIG" 2>/dev/null || true)
                ORIG_EXTUI_URL=$(grep "^external-ui-url:" "$MIHOMO_CONFIG" 2>/dev/null || true)
                printf "%s\n%s\n" "$ORIG_EXTUI" "$ORIG_EXTUI_URL" > "$EXTUI_BACKUP"
                info "$(msg "Оригинальные настройки external-ui сохранены" \
                           "Original external-ui settings saved")"
            fi

            # Set external-ui: ui
            if grep -q "^external-ui:" "$MIHOMO_CONFIG"; then
                sed -i "s|^external-ui:.*|external-ui: ui|" "$MIHOMO_CONFIG"
            else
                printf "\nexternal-ui: ui\n" >> "$MIHOMO_CONFIG"
            fi

            # Set external-ui-url to XMeow dashboard (for auto-update on mihomo restart)
            if grep -q "^external-ui-url:" "$MIHOMO_CONFIG"; then
                sed -i "s|^external-ui-url:.*|external-ui-url: '$XMEOW_EXTUI_URL'|" "$MIHOMO_CONFIG"
            else
                printf "external-ui-url: '%s'\n" "$XMEOW_EXTUI_URL" >> "$MIHOMO_CONFIG"
            fi

            success "$(msg "external-ui-url обновлен на XMeow Dashboard" \
                          "external-ui-url updated to XMeow Dashboard")"
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

    # --- Create xmeow command ---
    create_xmeow_cmd() {
        cat > "$XMEOW_CMD" << 'XMEOW_EOF'
#!/bin/sh
# XMeow command utility
# Server: xmeow -start | -stop | -restart | -status
# Agent:  xmeow -starta | -stopa | -restarta | -statusa
SERVER="/opt/etc/init.d/S99xmeow-ui"
AGENT="/opt/etc/init.d/S99xmeow-agent"

case "$1" in
    -start)     [ -x "$SERVER" ] && "$SERVER" start   || echo "xmeow-server not installed" ;;
    -stop)      [ -x "$SERVER" ] && "$SERVER" stop    || echo "xmeow-server not installed" ;;
    -restart)   [ -x "$SERVER" ] && "$SERVER" restart || echo "xmeow-server not installed" ;;
    -status)    [ -x "$SERVER" ] && "$SERVER" status  || echo "xmeow-server not installed" ;;
    -starta)    [ -x "$AGENT" ]  && "$AGENT" start    || echo "xmeow-agent not installed" ;;
    -stopa)     [ -x "$AGENT" ]  && "$AGENT" stop     || echo "xmeow-agent not installed" ;;
    -restarta)  [ -x "$AGENT" ]  && "$AGENT" restart  || echo "xmeow-agent not installed" ;;
    -statusa)   [ -x "$AGENT" ]  && "$AGENT" status   || echo "xmeow-agent not installed" ;;
    *)
        echo "XMeow UI command utility"
        echo ""
        if [ -x "$SERVER" ]; then
            echo "Server:  xmeow -start | -stop | -restart | -status"
        fi
        if [ -x "$AGENT" ]; then
            echo "Agent:   xmeow -starta | -stopa | -restarta | -statusa"
        fi
        if [ ! -x "$SERVER" ] && [ ! -x "$AGENT" ]; then
            echo "Nothing installed. Run setup.sh first."
        fi
        ;;
esac
XMEOW_EOF
        chmod +x "$XMEOW_CMD"
        success "$(msg "Команда xmeow создана: $XMEOW_CMD" "Command xmeow created: $XMEOW_CMD")"
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
        create_xmeow_cmd
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
        create_xmeow_cmd
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

        # Remove UI files and restore original external-ui settings
        if [ -d "$EXTUI_DIR" ]; then
            rm -rf "$EXTUI_DIR"
            success "$(msg "UI удален" "UI removed")"
        fi

        # Restore original external-ui / external-ui-url in mihomo config
        if [ -f "$EXTUI_BACKUP" ] && [ -f "$MIHOMO_CONFIG" ]; then
            ORIG_EXTUI=$(sed -n '1p' "$EXTUI_BACKUP")
            ORIG_EXTUI_URL=$(sed -n '2p' "$EXTUI_BACKUP")

            if [ -n "$ORIG_EXTUI" ]; then
                sed -i "s|^external-ui:.*|$ORIG_EXTUI|" "$MIHOMO_CONFIG"
            else
                sed -i "/^external-ui: ui$/d" "$MIHOMO_CONFIG"
            fi

            if [ -n "$ORIG_EXTUI_URL" ]; then
                sed -i "s|^external-ui-url:.*|$ORIG_EXTUI_URL|" "$MIHOMO_CONFIG"
            else
                sed -i "/^external-ui-url:.*XKeen-UI-XMeow/d" "$MIHOMO_CONFIG"
            fi

            rm -f "$EXTUI_BACKUP"
            success "$(msg "Настройки external-ui восстановлены" \
                          "External-UI settings restored")"
        fi

        # Remove PID file
        rm -f "$PIDFILE"

        # Remove xmeow command (only if agent is also not installed)
        if [ -f "$XMEOW_CMD" ] && [ ! -x "$AGENT_INITD" ]; then
            rm -f "$XMEOW_CMD"
            success "$(msg "Команда xmeow удалена" "Command xmeow removed")"
        elif [ -f "$XMEOW_CMD" ]; then
            info "$(msg "Команда xmeow сохранена (агент ещё установлен)" \
                        "Command xmeow kept (agent still installed)")"
        fi

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

        # Check agent version
        AGENT_VER=""
        if [ -x "$INSTALL_DIR/$AGENT_BIN" ]; then
            AGENT_VER=$("$INSTALL_DIR/$AGENT_BIN" --version 2>/dev/null) || AGENT_VER="?"
        fi

        printf "\n"
        if [ -n "$CUR_VER" ]; then
            info "$(msg "Сервер: v$CUR_VER" "Server: v$CUR_VER")"
        else
            info "$(msg "Сервер не установлен" "Server not installed")"
        fi
        if [ -n "$AGENT_VER" ]; then
            info "$(msg "Агент:  v$AGENT_VER" "Agent:  v$AGENT_VER")"
        else
            info "$(msg "Агент не установлен" "Agent not installed")"
        fi
        printf "\n"

        printf "  ${BOLD}1)${NC} $(msg "Установить сервер" "Install server")     $(msg "— сервер + дашборд" "— server + dashboard")\n"
        printf "  ${BOLD}2)${NC} $(msg "Обновить сервер" "Update server")       $(msg "— скачать последнюю версию" "— download latest version")\n"
        printf "  ${BOLD}3)${NC} $(msg "Переустановить" "Reinstall")            $(msg "— удалить и установить заново" "— remove and install fresh")\n"
        printf "  ${BOLD}4)${NC} $(msg "Удалить" "Uninstall")                   $(msg "— полное удаление" "— complete removal")\n"
        printf "  ${BOLD}5)${NC} $(msg "Установить агент" "Install agent")      $(msg "— для удалённого управления" "— for remote management")\n"
        printf "  ${BOLD}0)${NC} $(msg "Выход" "Exit")\n"
        printf "\n"

        printf "$(msg "Выберите действие" "Select action") [0-5]: "
        read -r CHOICE < /dev/tty 2>/dev/null || CHOICE="0"

        case "$CHOICE" in
            1) do_install ;;
            2) do_update ;;
            3) do_reinstall ;;
            4) do_uninstall ;;
            5) install_agent ;;
            0) msg "Выход." "Bye."; exit 0 ;;
            *) die "$(msg "Неверный выбор: $CHOICE" "Invalid choice: $CHOICE")" ;;
        esac
    }

    # =====================
    #   MODE: AGENT INSTALL
    # =====================
    install_agent() {
        msg "Установка XMeow Agent..." "Installing XMeow Agent..."
        detect_arch

        # Fetch latest release info
        info "$(msg "Получение последней версии..." "Fetching latest version...")"
        RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest") || \
            die "$(msg "Не удалось получить информацию о релизе" "Failed to fetch release info")"

        TAG=$(printf '%s' "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name" *: *"\([^"]*\)".*/\1/')
        [ -z "$TAG" ] && die "$(msg "Не удалось определить версию" "Failed to determine version")"
        VERSION=$(printf '%s' "$TAG" | sed 's/^v//')

        AGENT_ARCHIVE="${AGENT_BIN}-linux-${ARCH}.tar.gz"
        AGENT_URL="https://github.com/$REPO/releases/download/$TAG/$AGENT_ARCHIVE"
        CHECKSUM_URL="https://github.com/$REPO/releases/download/$TAG/checksums.txt"

        info "$(msg "Найдена версия: $VERSION ($TAG)" "Found version: $VERSION ($TAG)")"

        # Download agent archive
        mkdir -p "$TMP_DIR"
        info "$(msg "Скачивание $AGENT_ARCHIVE..." "Downloading $AGENT_ARCHIVE...")"
        curl --progress-bar --retry 3 -fSL -o "$TMP_DIR/$AGENT_ARCHIVE" "$AGENT_URL" || \
            die "$(msg "Не удалось скачать агент" "Failed to download agent")"

        # Download and verify checksum
        info "$(msg "Скачивание контрольных сумм..." "Downloading checksums...")"
        curl -fsSL -o "$TMP_DIR/checksums.txt" "$CHECKSUM_URL" || \
            die "$(msg "Не удалось скачать контрольные суммы" "Failed to download checksums")"

        EXPECTED=$(grep "$AGENT_ARCHIVE" "$TMP_DIR/checksums.txt" | awk '{print $1}')
        if [ -n "$EXPECTED" ]; then
            ACTUAL=$(sha256sum "$TMP_DIR/$AGENT_ARCHIVE" | awk '{print $1}')
            if [ "$EXPECTED" != "$ACTUAL" ]; then
                die "$(msg "Контрольная сумма не совпадает!" "Checksum mismatch!")"
            fi
            success "$(msg "Контрольная сумма OK" "Checksum OK")"
        else
            warn "$(msg "Контрольная сумма для агента не найдена -- пропускаем проверку" \
                        "Agent checksum not found -- skipping verification")"
        fi

        # Extract and install binary
        tar -xzf "$TMP_DIR/$AGENT_ARCHIVE" -C "$TMP_DIR" "$AGENT_BIN" || \
            die "$(msg "Не удалось распаковать архив" "Failed to extract archive")"

        mkdir -p "$INSTALL_DIR"
        cp "$TMP_DIR/$AGENT_BIN" "$INSTALL_DIR/$AGENT_BIN"
        chmod +x "$INSTALL_DIR/$AGENT_BIN"

        INSTALLED_VER=$("$INSTALL_DIR/$AGENT_BIN" --version 2>/dev/null) || \
            die "$(msg "Бинарник агента не запускается" "Agent binary failed to run")"
        success "$(msg "Установлен $AGENT_BIN v$INSTALLED_VER" "Installed $AGENT_BIN v$INSTALLED_VER")"

        # Create agent config (preserve existing)
        if [ -f "$AGENT_CONF" ]; then
            info "$(msg "Конфиг агента $AGENT_CONF уже существует -- пропускаем" \
                        "Agent config $AGENT_CONF already exists -- skipping")"
        else
            # Try interactive prompts if running in a terminal
            AGENT_SERVER_HOST=""
            AGENT_SERVER_PORT="2222"
            AGENT_TOKEN=""
            AGENT_DEVICE_NAME=$(hostname 2>/dev/null || echo "")

            if [ -e /dev/tty ]; then
                printf "\n${BOLD}$(msg "Настройка агента" "Agent configuration")${NC}\n\n"

                printf "$(msg "Адрес мастер-сервера (IP или домен)" "Master server address (IP or domain)"): "
                read -r AGENT_SERVER_HOST < /dev/tty 2>/dev/null || true

                printf "$(msg "Порт SSH мастер-сервера" "Master SSH port") [2222]: "
                read -r INPUT_PORT < /dev/tty 2>/dev/null || true
                [ -n "$INPUT_PORT" ] && AGENT_SERVER_PORT="$INPUT_PORT"

                printf "$(msg "Токен агента" "Agent token"): "
                read -r AGENT_TOKEN < /dev/tty 2>/dev/null || true

                printf "$(msg "Имя устройства" "Device name") [${AGENT_DEVICE_NAME:-unknown}]: "
                read -r INPUT_NAME < /dev/tty 2>/dev/null || true
                [ -n "$INPUT_NAME" ] && AGENT_DEVICE_NAME="$INPUT_NAME"
            fi

            # Write config — filled or template with comments
            if [ -n "$AGENT_SERVER_HOST" ] && [ -n "$AGENT_TOKEN" ]; then
                cat > "$AGENT_CONF" << AGENT_CONF_EOF
{
    "server_host": "${AGENT_SERVER_HOST}",
    "server_port": ${AGENT_SERVER_PORT},
    "token": "${AGENT_TOKEN}",
    "device_name": "${AGENT_DEVICE_NAME:-unknown}"
}
AGENT_CONF_EOF
                chmod 600 "$AGENT_CONF"
                success "$(msg "Конфиг агента создан: $AGENT_CONF" "Agent config created: $AGENT_CONF")"
            else
                AGENT_DEVICE_NAME=${AGENT_DEVICE_NAME:-$(hostname 2>/dev/null || echo "my-router")}
                cat > "$AGENT_CONF" << AGENT_TPL_EOF
{
    "server_host": "IP_АДРЕС_ОСНОВНОГО_РОУТЕРА",
    "server_port": 2222,
    "token": "ТОКЕН_ИЗ_ДАШБОРДА",
    "device_name": "${AGENT_DEVICE_NAME}"
}
AGENT_TPL_EOF
                chmod 600 "$AGENT_CONF"
                success "$(msg "Шаблон конфига создан: $AGENT_CONF" "Config template created: $AGENT_CONF")"
                warn "$(msg "Заполните server_host и token в $AGENT_CONF перед запуском" \
                            "Fill in server_host and token in $AGENT_CONF before starting")"
            fi
        fi

        # Create init.d script for agent
        cat > "$AGENT_INITD" << 'AGENT_INITD_EOF'
#!/bin/sh
CONF="/opt/etc/xmeow-ui/agent.conf"
BIN="/opt/etc/xmeow-ui/xmeow-agent"
PIDFILE="/opt/var/run/xmeow-agent.pid"

case "$1" in
    start)
        if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
            echo "xmeow-agent already running (PID $(cat "$PIDFILE"))"
        else
            echo "Starting xmeow-agent..."
            "$BIN" -config "$CONF" > /dev/null 2>&1 &
            echo $! > "$PIDFILE"
            echo "xmeow-agent started (PID $!)"
        fi
        ;;
    stop)
        if [ -f "$PIDFILE" ]; then
            PID=$(cat "$PIDFILE")
            if kill -0 "$PID" 2>/dev/null; then
                echo "Stopping xmeow-agent (PID $PID)..."
                kill "$PID"
                rm -f "$PIDFILE"
            else
                echo "xmeow-agent not running (stale PID file)"
                rm -f "$PIDFILE"
            fi
        else
            echo "xmeow-agent not running"
        fi
        ;;
    restart)
        "$0" stop
        sleep 1
        "$0" start
        ;;
    status)
        if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
            echo "xmeow-agent running (PID $(cat "$PIDFILE"))"
        else
            echo "xmeow-agent not running"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
AGENT_INITD_EOF
        chmod +x "$AGENT_INITD"
        mkdir -p /opt/var/run
        success "$(msg "Сервис агента создан: $AGENT_INITD" "Agent service created: $AGENT_INITD")"

        # Create xmeow command
        create_xmeow_cmd

        # Start agent if config is filled
        if [ -n "$AGENT_SERVER_HOST" ] && [ -n "$AGENT_TOKEN" ]; then
            "$AGENT_INITD" stop 2>/dev/null || true
            "$AGENT_INITD" start
            sleep 1
            if [ -f "$AGENT_PIDFILE" ] && kill -0 "$(cat "$AGENT_PIDFILE")" 2>/dev/null; then
                success "$(msg "Агент запущен (PID $(cat "$AGENT_PIDFILE"))" \
                              "Agent running (PID $(cat "$AGENT_PIDFILE"))")"
            else
                warn "$(msg "Агент не запустился -- проверьте конфиг и логи" \
                            "Agent failed to start -- check config and logs")"
            fi
        else
            info "$(msg "Агент не запущен — заполните конфиг и запустите:" \
                        "Agent not started — fill config and run:")"
            info "  $(msg "1. Отредактируйте" "1. Edit") $AGENT_CONF"
            info "  $(msg "2. Запустите:" "2. Run:") xmeow -starta"
        fi

        cleanup

        # Print success
        printf "\n${GREEN}${BOLD}"
        printf "====================================\n"
        printf " XMeow Agent v%s $(msg "установлен!" "installed!")\n" "$VERSION"
        printf "====================================\n"
        printf "${NC}${GREEN}"
        printf " Service: %s {start|stop|restart|status}\n" "$AGENT_INITD"
        printf " Config:  %s\n" "$AGENT_CONF"
        printf " Binary:  %s/%s\n" "$INSTALL_DIR" "$AGENT_BIN"
        printf "====================================\n"
        printf "${NC}\n"
    }

    # --- Main flow ---
    detect_lang
    print_logo

    [ "$(id -u)" -ne 0 ] && die "$(msg "Требуются права root. Запустите: sudo sh setup.sh" \
                                       "Root required. Run: sudo sh setup.sh")"

    ACTION="${1:-}"

    case "$ACTION" in
        install)        do_install ;;
        update)         do_update ;;
        reinstall)      do_reinstall ;;
        uninstall)      do_uninstall ;;
        --agent|-agent) install_agent ;;
        "")             show_menu ;;
        *)
            error_msg "$(msg "Неизвестная команда: $ACTION" "Unknown command: $ACTION")"
            printf "\n$(msg "Использование" "Usage"): setup.sh [install|update|reinstall|uninstall|--agent]\n"
            exit 1
            ;;
    esac
}

main "$@"
