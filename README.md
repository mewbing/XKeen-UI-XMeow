# ✨ XMeow UI

Панель управления для [mihomo](https://github.com/MetaCubeX/mihomo) на роутерах **Keenetic**.

Go-сервер + SPA-дашборд. Без внешних зависимостей, работает на ARM/MIPS роутерах.

## ⚡ Быстрый старт

```bash
curl -sL https://raw.githubusercontent.com/mewbing/XKeen-UI-XMeow/main/setup.sh | sh
```

## ✨ Особенности

- 📊 Обзор системы: трафик, память, CPU, соединения, тесты задержки
- 🔀 Управление прокси-группами и нодами с тестированием задержки
- 📝 Визуальный редактор правил маршрутизации с drag & drop
- ⚙️ Редактор конфигурации с подсветкой синтаксиса и diff-превью
- 📜 Логи и соединения в реальном времени через WebSocket
- 💻 Веб-терминал (SSH/PTY) для управления роутером
- 🔄 Управление версиями: mihomo, XKeen, XMeow — обновление и откат
- 🚀 Работает без Go-бэкенда (базовый режим через mihomo API)
- ⛔ Без внешних зависимостей — один бинарник
- 📉 Минимальное потребление ресурсов

## 🖥️ Поддерживаемые архитектуры

| Архитектура | Роутеры |
|---|---|
| `linux_arm64` | Keenetic KN-1811, KN-1812 и новее (aarch64) |
| `linux_armv7` | Keenetic Giga, Ultra старых ревизий (ARMv7) |
| `linux_mipsle` | Keenetic 4G, Lite и др. (MIPS little-endian) |

## ⚙️ Конфигурация

Файл конфигурации: `/opt/etc/xmeow-ui/xmeow-ui.conf`

| Переменная | Описание | По умолчанию |
|---|---|---|
| `PORT` | Порт API-сервера | `5000` |
| `MIHOMO_CONFIG_PATH` | Путь к config.yaml mihomo | `/opt/etc/mihomo/config.yaml` |
| `XKEEN_DIR` | Директория XKeen | `/opt/etc/xkeen` |
| `XKEEN_LOG_DIR` | Директория логов | `/opt/var/log/xray` |

## 🎛️ Управление сервисом

```bash
/opt/etc/init.d/S99xmeow-ui start    # Запуск
/opt/etc/init.d/S99xmeow-ui stop     # Остановка
/opt/etc/init.d/S99xmeow-ui restart  # Перезапуск
/opt/etc/init.d/S99xmeow-ui status   # Статус
```

Dashboard доступен по адресу: `http://<router-ip>:9090/ui/`

## 🔗 external-ui-url

Для автоматической загрузки дашборда через mihomo, добавьте в `config.yaml`:

```yaml
external-ui: ui
external-ui-url: https://github.com/mewbing/XKeen-UI-XMeow/releases/latest/download/dist.tar.gz
```

## 🪙 Понравился проект?

[Поддержать автора](https://pay.cloudtips.ru/p/9752caf9)

## 🙏 Благодарности

- [zxc-rv/XKeen-UI](https://github.com/zxc-rv/XKeen-UI) — оригинальный XKeen UI для Keenetic
- [MetaCubeX/Zashboard](https://github.com/MetaCubeX/Zashboard) — mihomo dashboard
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo) — ядро прокси-сервера
- [jameszeroX/XKeen](https://github.com/jameszeroX/XKeen) — XKeen для Keenetic
