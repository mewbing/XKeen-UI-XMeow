# Phase 5: Generation Script - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Python-скрипт генерации двух вариантов конфига mihomo из единого базового config.yaml: config-personal.yaml (полная копия) и config-work.yaml (без adult-контента). Скрипт удаляет блоки между маркерами `# >>> ADULT` / `# <<< ADULT`, валидирует выходной YAML и проверяет work-конфиг на отсутствие adult-ключевых слов.

</domain>

<decisions>
## Implementation Decisions

### Запуск и CLI
- Вызов: `python generate.py` без аргументов — все пути зашиты в скрипте
- Скрипт лежит в корне репозитория рядом с config.yaml
- Поддержка `--dry-run` флага: показать что будет сделано без создания файлов
- Зависимости: на усмотрение Claude (stdlib или PyYAML для валидации)

### Отчёт и вывод
- Подробный отчёт: каждый удалённый блок, список проверенных ключевых слов
- Цветной вывод: ANSI-цвета (зелёный/красный для OK/FAIL)
- Показывать каждое adult-ключевое слово с результатом: `pornhub ✔`, `stripchat ✔`, и т.д.
- Язык вывода: русский

### Обработка ошибок
- Маркеры не найдены/непарные: предупреждение, но генерация продолжается (personal создаётся, work — с предупреждением)
- Adult-проверка нашла совпадения: файл создаётся, но яркое предупреждение с номерами строк
- Невалидный YAML: предупреждение, файл остаётся на диске для отладки
- Exit code: ненулевой при ошибках (сломанные маркеры, найденные adult-слова, невалидный YAML)

### Файлы и пути
- Выходные файлы: `output/config-personal.yaml` и `output/config-work.yaml`
- Перед перезаписью: бэкап существующих файлов как .bak
- Имена файлов: config-personal.yaml и config-work.yaml
- output/ добавить в .gitignore (сгенерированные файлы не пушатся в GitHub)

### Claude's Discretion
- Выбор зависимостей (stdlib vs PyYAML для валидации)
- Формат бэкапов (.bak или с таймстампом)
- Внутренняя структура скрипта (функции, классы)
- Обработка edge-case'ов при удалении маркеров (включая сами строки маркеров)

</decisions>

<specifics>
## Specific Ideas

- Скрипт должен работать как `python generate.py` — просто и без лишних зависимостей
- Отчёт должен быть визуально понятным: цвета + галочки/крестики для каждой проверки
- При `--dry-run` показать те же проверки и статистику, но без записи файлов
- В конфиге уже 4 пары маркеров `# >>> ADULT` / `# <<< ADULT` в разных секциях (proxy-groups, select-group, rule-providers, rules)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-generation-script*
*Context gathered: 2026-02-26*
