# XMeow UI

Панель управления для [mihomo](https://github.com/MetaCubeX/mihomo) на роутерах **Keenetic**.

Go-сервер + SPA-дашборд + удалённое управление. Без внешних зависимостей, работает на ARM/MIPS роутерах.

## Быстрый старт

**Установка сервера + дашборда:**

```bash
curl -sL https://raw.githubusercontent.com/mewbing/XKeen-UI-XMeow/main/setup.sh | sh
```

**Установка агента (для удалённого управления):**

```bash
curl -sL https://raw.githubusercontent.com/mewbing/XKeen-UI-XMeow/main/setup.sh | sh -s -- --agent
```

После установки дашборд доступен по адресу: `http://<router-ip>:9090/ui/`

## Возможности

### Мониторинг и управление
- Обзор системы: трафик, память, CPU, соединения, тесты задержки, DNS-статистика
- Управление прокси-группами и нодами с тестированием задержки
- Логи и соединения в реальном времени через WebSocket
- Веб-терминал (SSH/PTY) для управления роутером

### Конфигурация
- Визуальный редактор правил маршрутизации с drag & drop
- Редактор конфигурации с подсветкой синтаксиса (Monaco Editor) и diff-превью
- Три режима плотности правил: компактный, средний, подробный

### Обновления
- Управление версиями: mihomo, XKeen, XMeow, Agent — обновление и установка
- Обновление mihomo через RAM (бэкенд) или встроенный endpoint mihomo
- Автоматическая проверка обновлений

### Удалённое управление (Remote Management)
- SSH-сервер для подключения удалённых агентов через reverse tunnel
- Direct-подключение к роутерам по IP (без агента)
- Переключение контекста между локальным и удалёнными роутерами
- Удалённый терминал через SSH-туннель
- Выполнение команд XKeen на удалённых роутерах
- Токены доступа для агентов (создание, отзыв)

### Общее
- Работает без Go-бэкенда (базовый режим через mihomo API)
- Один бинарник, минимальное потребление ресурсов
- Тема "Antigravity" (тёмная, blue-violet палитра)
- Интерфейс на русском языке

## Архитектура

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   XMeow UI      │────▶│ xmeow-server │────▶│   mihomo     │
│  (SPA, React)   │     │  (Go, :5000) │     │   (:9090)    │
└─────────────────┘     └──────┬───────┘     └─────────────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
              ┌──────────┐ ┌────────┐ ┌────────┐
              │ agent #1 │ │agent #2│ │agent #3│
              │(SSH тун.)│ │(direct)│ │(тун.)  │
              └──────────┘ └────────┘ └────────┘
```

- **xmeow-server** — API-сервер + SSH-сервер для агентов. Не раздаёт SPA.
- **xmeow-agent** — reverse SSH tunnel + heartbeat, устанавливается на удалённые роутеры.
- **UI** — раздаётся через mihomo `external-ui` (порт 9090, путь `/ui/`).

## Поддерживаемые архитектуры

| Архитектура | Роутеры |
|---|---|
| `linux_arm64` | Keenetic KN-1811, KN-1812 и новее (aarch64) |
| `linux_armv7` | Keenetic Giga, Ultra старых ревизий (ARMv7) |
| `linux_mipsle` | Keenetic 4G, Lite и др. (MIPS little-endian) |

## Конфигурация

### Сервер

Файл: `/opt/etc/xmeow-ui/xmeow-ui.conf`

| Переменная | Описание | По умолчанию |
|---|---|---|
| `PORT` | Порт API-сервера | `5000` |
| `SECRET` | API-ключ (Bearer token) | — |
| `MIHOMO_CONFIG_PATH` | Путь к config.yaml mihomo | `/opt/etc/mihomo/config.yaml` |
| `XKEEN_DIR` | Директория XKeen | `/opt/etc/xkeen` |
| `SSH_PORT` | Порт SSH-сервера для агентов | `2222` |

### Агент

Файл: `/opt/etc/xmeow-ui/agent.conf`

```json
{
  "server_host": "master-router-ip",
  "server_port": 2222,
  "token": "agent-token-from-server",
  "device_name": "Router-Name",
  "tunnel_ports": [5000, 9090, 22]
}
```

## Управление сервисом

```bash
# CLI-утилита (устанавливается автоматически)
xmeow -start      # Запуск сервера
xmeow -stop       # Остановка сервера
xmeow -restart    # Перезапуск сервера
xmeow -status     # Статус сервера

xmeow -starta     # Запуск агента
xmeow -stopa      # Остановка агента
xmeow -restarta   # Перезапуск агента
xmeow -statusa    # Статус агента

# Init.d скрипты (альтернативно)
/opt/etc/init.d/S99xmeow-ui start|stop|restart|status
/opt/etc/init.d/S99xmeow-agent start|stop|restart|status
```

## external-ui-url

Для автоматической загрузки дашборда через mihomo, добавьте в `config.yaml`:

```yaml
external-ui: ui
external-ui-url: https://github.com/mewbing/XKeen-UI-XMeow/releases/latest/download/dist.tar.gz
```

## Технологии

- **Frontend**: React 19, Vite 7, TypeScript, Tailwind CSS v4, shadcn/ui, Monaco Editor
- **Backend**: Go (chi router, gorilla/websocket, x/crypto/ssh)
- **Сборка**: Cross-compile для linux/arm64, linux/armv7, linux/mipsle

## Понравился проект?

[Поддержать автора](https://pay.cloudtips.ru/p/9752caf9)

## Благодарности

- [zxc-rv/XKeen-UI](https://github.com/zxc-rv/XKeen-UI) — оригинальный XKeen UI для Keenetic
- [MetaCubeX/Zashboard](https://github.com/MetaCubeX/Zashboard) — mihomo dashboard
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo) — ядро прокси-сервера
- [jameszeroX/XKeen](https://github.com/jameszeroX/XKeen) — XKeen для Keenetic
