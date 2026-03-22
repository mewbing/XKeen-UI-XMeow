# XMeow UI

Панель управления для [mihomo](https://github.com/MetaCubeX/mihomo) на роутерах **Keenetic**.

Один бинарник, минимальное потребление ресурсов. Работает на ARM/MIPS роутерах.

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

- Обзор системы: трафик, память, CPU, соединения, тесты задержки, DNS-статистика
- Управление прокси-группами и нодами с тестированием задержки
- Логи и соединения в реальном времени
- Веб-терминал для управления роутером
- Визуальный редактор правил маршрутизации с drag & drop
- Редактор конфигурации с подсветкой синтаксиса и diff-превью
- Обновление mihomo, XKeen, XMeow и Agent из дашборда
- Удалённое управление несколькими роутерами из одного дашборда
- Подключение удалённых роутеров по IP или через агент
- Переключение между роутерами в один клик
- Работает и без сервера (базовый режим через mihomo API)
- Интерфейс на русском языке

## Как это работает

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  XMeow UI   │────▶│ xmeow-server │────▶│   mihomo     │
│  (дашборд)  │     │  (порт 5000) │     │  (порт 9090) │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                ┌──────────┼──────────┐
                ▼          ▼          ▼
          ┌──────────┐ ┌────────┐ ┌────────┐
          │ Роутер 1 │ │Роутер 2│ │Роутер 3│
          │ (агент)  │ │(по IP) │ │(агент) │
          └──────────┘ └────────┘ └────────┘
```

- **xmeow-server** — управляет mihomo, XKeen, терминалом и удалёнными роутерами
- **xmeow-agent** — устанавливается на удалённые роутеры для подключения к серверу
- **Дашборд** — раздаётся через mihomo на порту 9090

## Конфигурация

Сервер: `/opt/etc/xmeow-ui/xmeow-ui.conf`

| Параметр | Описание | По умолчанию |
|---|---|---|
| `PORT` | Порт сервера | `5000` |
| `SECRET` | Пароль доступа | — |
| `SSH_PORT` | Порт для подключения агентов | `2222` |

Агент: `/opt/etc/xmeow-ui/agent.conf`

```json
{
  "server_host": "IP-адрес-основного-роутера",
  "server_port": 2222,
  "token": "токен-из-дашборда",
  "device_name": "Название-роутера"
}
```

## Поддерживаемые архитектуры

| Архитектура | Роутеры |
|---|---|
| `arm64` | Keenetic KN-1811, KN-1812 и новее |
| `armv7` | Keenetic Giga, Ultra старых ревизий |
| `mipsle` | Keenetic 4G, Lite и др. |

## Управление

```bash
xmeow -start      # Запуск сервера
xmeow -stop       # Остановка сервера
xmeow -restart    # Перезапуск сервера
xmeow -status     # Статус сервера

xmeow -starta     # Запуск агента
xmeow -stopa      # Остановка агента
xmeow -restarta   # Перезапуск агента
xmeow -statusa    # Статус агента
```

## external-ui-url

Для автоматической загрузки дашборда через mihomo, добавьте в `config.yaml`:

```yaml
external-ui: ui
external-ui-url: https://github.com/mewbing/XKeen-UI-XMeow/releases/latest/download/dist.tar.gz
```

## Понравился проект?

[Поддержать автора](https://pay.cloudtips.ru/p/9752caf9)

## Благодарности

- [zxc-rv/XKeen-UI](https://github.com/zxc-rv/XKeen-UI) — оригинальный XKeen UI
- [MetaCubeX/Zashboard](https://github.com/MetaCubeX/Zashboard) — mihomo dashboard
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo) — ядро прокси-сервера
- [jameszeroX/XKeen](https://github.com/jameszeroX/XKeen) — XKeen для Keenetic
