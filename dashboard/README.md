# XMeow UI

Dashboard для [mihomo](https://github.com/MetaCubeX/mihomo) proxy на роутерах Keenetic.

Единый Go-бинарник со встроенным SPA — без внешних зависимостей, готов к запуску на ARM/MIPS роутерах.

## Возможности

- Обзор системы: трафик, соединения, DNS-статистика
- Управление прокси-группами и нодами с тестированием задержки
- Визуальный редактор правил маршрутизации
- Редактор конфигурации с подсветкой синтаксиса и diff-превью
- Просмотр логов и соединений в реальном времени через WebSocket

## Запуск

```bash
./xmeow-ui
```

По умолчанию запускается на порту **5000**.

### Переменные окружения

| Переменная | Описание | По умолчанию |
|---|---|---|
| `XMEOW_PORT` | Порт веб-интерфейса | `5000` |
| `MIHOMO_CONFIG_PATH` | Путь к config.yaml mihomo | `/opt/etc/mihomo/config.yaml` |
| `MIHOMO_API_URL` | URL API mihomo | `http://127.0.0.1:9090` |
| `XMEOW_SECRET` | Секретный ключ для аутентификации | (не задан) |

## Поддерживаемые архитектуры

| Архитектура | Описание |
|---|---|
| `linux_arm64` | Keenetic KN-1811, KN-1812 и др. (aarch64) |
| `linux_armv7` | Keenetic Giga, Ultra и др. (ARMv7) |
| `linux_mipsle` | Keenetic 4G, Lite и др. (MIPS little-endian) |
| `linux_mips` | Keenetic Omni и др. (MIPS big-endian) |
| `linux_amd64` | x86_64 серверы и ПК |

## Ссылки

- [GitHub](https://github.com/mewbing/XKeen-UI-Xmeow)
