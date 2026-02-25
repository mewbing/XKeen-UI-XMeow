# Phase 5: Generation Script - Research

**Researched:** 2026-02-26
**Domain:** Python script for YAML config generation (text processing + validation)
**Confidence:** HIGH

## Summary

Фаза 5 требует создания Python-скрипта, который читает единый базовый `config.yaml` (1541 строка) и генерирует два варианта: `config-personal.yaml` (полная копия) и `config-work.yaml` (без adult-контента). Adult-контент уже изолирован в 4 пары маркеров `# >>> ADULT` / `# <<< ADULT` (Phase 3), что делает задачу чисто текстовой обработкой -- построчное чтение с пропуском блоков между маркерами.

Задача не требует парсинга YAML-структуры для удаления блоков -- маркеры работают на уровне строк. Однако YAML-валидация выходных файлов необходима для проверки корректности (PyYAML 6.0.3 уже установлен в системе).

**Primary recommendation:** Использовать построчную обработку (readline) для генерации work-конфига, PyYAML `yaml.safe_load()` для валидации, и Python stdlib `re` для проверки adult-ключевых слов.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Вызов: `python generate.py` без аргументов -- все пути зашиты в скрипте
- Скрипт лежит в корне репозитория рядом с config.yaml
- Поддержка `--dry-run` флага: показать что будет сделано без создания файлов
- Зависимости: на усмотрение Claude (stdlib или PyYAML для валидации)
- Подробный отчёт: каждый удалённый блок, список проверенных ключевых слов
- Цветной вывод: ANSI-цвета (зелёный/красный для OK/FAIL)
- Показывать каждое adult-ключевое слово с результатом: `pornhub OK`, `stripchat OK`, и т.д.
- Язык вывода: русский
- Маркеры не найдены/непарные: предупреждение, но генерация продолжается
- Adult-проверка нашла совпадения: файл создаётся, но яркое предупреждение с номерами строк
- Невалидный YAML: предупреждение, файл остаётся на диске для отладки
- Exit code: ненулевой при ошибках (сломанные маркеры, найденные adult-слова, невалидный YAML)
- Выходные файлы: `output/config-personal.yaml` и `output/config-work.yaml`
- Перед перезаписью: бэкап существующих файлов как .bak
- output/ добавить в .gitignore (сгенерированные файлы не пушатся в GitHub)

### Claude's Discretion
- Выбор зависимостей (stdlib vs PyYAML для валидации)
- Формат бэкапов (.bak или с таймстампом)
- Внутренняя структура скрипта (функции, классы)
- Обработка edge-case'ов при удалении маркеров (включая сами строки маркеров)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCRIPT-01 | Python-скрипт читает базовый config.yaml и генерирует два файла: config-personal.yaml и config-work.yaml | Построчное чтение + `shutil.copy2` для personal, line-filter для work |
| SCRIPT-02 | Скрипт удаляет всё между маркерами `# >>> ADULT` и `# <<< ADULT` для work-варианта | State machine: `inside_adult` флаг переключается при встрече маркеров, строки маркеров тоже удаляются |
| SCRIPT-03 | Скрипт валидирует выходной YAML (парсинг без ошибок) | `yaml.safe_load()` из PyYAML 6.0.3 (уже установлен) |
| SCRIPT-04 | Скрипт проверяет work-конфиг на отсутствие adult-keywords | `re.search()` по списку 10 ключевых слов case-insensitive по каждой строке |
| SCRIPT-05 | Скрипт работает на Windows (Python 3.x) | Python 3.14.0 установлен, `pathlib.Path` для кроссплатформенных путей, `os.makedirs` для output/ |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python stdlib | 3.14 | Основной runtime | Уже установлен, достаточен для текстовой обработки |
| PyYAML | 6.0.3 | YAML-валидация выходных файлов | Уже установлен, `yaml.safe_load()` -- стандарт валидации |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pathlib` | stdlib | Кроссплатформенные пути | Все файловые операции |
| `re` | stdlib | Regex для keyword-проверки | Проверка adult-keywords в work-конфиге |
| `shutil` | stdlib | Копирование файлов, бэкапы | personal-конфиг (полная копия), .bak файлы |
| `argparse` | stdlib | Парсинг `--dry-run` | CLI-интерфейс |
| `sys` | stdlib | Exit codes | Ненулевой код при ошибках |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PyYAML | `ruamel.yaml` | Сохраняет комментарии, но overkill -- нам нужна только валидация, не round-trip |
| PyYAML | `yaml` stdlib check | Нет YAML в stdlib Python -- PyYAML необходим |
| `shutil.copy2` | Построчное копирование | `shutil.copy2` сохраняет metadata, но для personal-конфига лучше построчная запись для единообразия |

**Installation:**
```bash
pip install pyyaml  # Уже установлен (6.0.3), но добавить в документацию
```

## Architecture Patterns

### Recommended Script Structure
```
generate.py          # Единый файл в корне репозитория
```

Скрипт достаточно прост для одного файла (~150-200 строк). Классы излишни, функциональная структура оптимальна.

### Pattern 1: State Machine для удаления маркерных блоков
**What:** Построчное чтение с флагом `inside_adult_block`
**When to use:** Когда маркеры не вложены и работают как toggle
**Example:**
```python
def filter_adult_blocks(lines: list[str]) -> tuple[list[str], list[dict]]:
    """Remove lines between # >>> ADULT and # <<< ADULT markers (inclusive).

    Returns: (filtered_lines, removed_blocks_info)
    """
    result = []
    removed_blocks = []
    inside_adult = False
    block_start = -1
    block_lines = 0

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped == '# >>> ADULT':
            inside_adult = True
            block_start = i
            block_lines = 0
            continue
        if stripped == '# <<< ADULT':
            inside_adult = False
            removed_blocks.append({
                'start': block_start,
                'end': i,
                'lines': block_lines
            })
            continue
        if inside_adult:
            block_lines += 1
            continue
        result.append(line)

    return result, removed_blocks
```

### Pattern 2: Keyword Checker с детальным отчётом
**What:** Проверка каждого ключевого слова отдельно с номерами строк
**When to use:** Для отчёта по каждому keyword с OK/FAIL
**Example:**
```python
ADULT_KEYWORDS = [
    'pornhub', 'stripchat', 'chaturbate', 'bongacams',
    'onlyfans', 'fansly', 'hentai', 'rule34', 'nsfw', 'porn'
]

def check_adult_keywords(lines: list[str]) -> dict[str, list[int]]:
    """Check for adult keywords, return {keyword: [line_numbers]}."""
    findings = {kw: [] for kw in ADULT_KEYWORDS}
    for i, line in enumerate(lines, 1):
        lower = line.lower()
        for kw in ADULT_KEYWORDS:
            if kw in lower:
                findings[kw].append(i)
    return findings
```

### Pattern 3: ANSI-цвета для Windows
**What:** Windows 10+ поддерживает ANSI escape codes в cmd/PowerShell, но нужно включить
**When to use:** Цветной вывод на Windows
**Example:**
```python
import os
# Enable ANSI colors on Windows
if os.name == 'nt':
    os.system('')  # Enables ANSI processing on Windows 10+

GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BOLD = '\033[1m'
RESET = '\033[0m'
```

### Anti-Patterns to Avoid
- **Парсинг YAML для удаления блоков:** Маркеры -- текстовые, не YAML-структурные. YAML-парсинг уничтожит комментарии и форматирование. Работаем на уровне строк.
- **Чтение всего файла в память:** 1541 строка -- мелочь, но всё равно лучше `readlines()` + list processing, а не многократные `read()`
- **Hardcoded keyword list без возможности расширения:** Список keywords лучше вынести в константу вверху скрипта

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML validation | Свой YAML-парсер | `yaml.safe_load()` | Edge cases: multiline strings, anchors, special chars |
| File backups | Ручное `open+write` | `shutil.copy2()` | Сохраняет metadata, атомарность |
| CLI parsing | Ручной `sys.argv` | `argparse` | Стандарт, автоматический `--help` |
| Path handling | String concatenation | `pathlib.Path` | Кроссплатформенность Windows/Linux |

**Key insight:** Скрипт прост, но edge cases в YAML-обработке опасны. Не парсить YAML для модификации -- только для валидации.

## Common Pitfalls

### Pitfall 1: Encoding на Windows
**What goes wrong:** `open()` без указания encoding на Windows использует cp1252, а config.yaml содержит UTF-8 (русские комментарии, emoji)
**Why it happens:** Python default encoding зависит от OS locale
**How to avoid:** Всегда `open(path, encoding='utf-8')`
**Warning signs:** `UnicodeDecodeError` или искажённые символы в отчёте

### Pitfall 2: Незакрытый маркер ADULT
**What goes wrong:** `# >>> ADULT` без парного `# <<< ADULT` -- всё после маркера будет удалено
**Why it happens:** Ошибка при ручном редактировании config.yaml
**How to avoid:** После обработки проверить: `inside_adult` должен быть `False`. Если `True` -- предупреждение о непарном маркере.
**Warning signs:** Выходной файл значительно меньше ожидаемого

### Pitfall 3: Пустые строки вокруг удалённых блоков
**What goes wrong:** После удаления adult-блока остаются двойные пустые строки, что портит YAML-валидацию
**Why it happens:** Пустые строки до/после маркеров сохраняются
**How to avoid:** Не проблема для YAML-валидации (пустые строки допустимы), но можно убрать последовательные пустые строки для чистоты. Однако это может изменить авторское форматирование -- лучше не трогать.

### Pitfall 4: Keyword 'porn' матчит подстроки
**What goes wrong:** Keyword `porn` найдёт `pornhub`, `category-porn` -- двойной подсчёт
**Why it happens:** Простой `in` оператор для подстрок
**How to avoid:** Это expected behavior: если `porn` есть в строке, то строка содержит adult-контент. Двойной подсчёт keywords не критичен -- каждый keyword проверяется независимо. Но в отчёте не дублировать строки.

### Pitfall 5: BOM в UTF-8
**What goes wrong:** Некоторые Windows-редакторы добавляют BOM (byte order mark) в начало UTF-8 файлов
**Why it happens:** Windows notepad legacy
**How to avoid:** Использовать `encoding='utf-8-sig'` для чтения (автоматически убирает BOM), `encoding='utf-8'` для записи

## Code Examples

### Главная структура скрипта
```python
#!/usr/bin/env python3
"""Generate personal and work mihomo configs from base config.yaml."""

import argparse
import shutil
import sys
from pathlib import Path

import yaml

# --- Constants ---
BASE_CONFIG = Path(__file__).parent / 'config.yaml'
OUTPUT_DIR = Path(__file__).parent / 'output'
PERSONAL_OUTPUT = OUTPUT_DIR / 'config-personal.yaml'
WORK_OUTPUT = OUTPUT_DIR / 'config-work.yaml'

ADULT_START = '# >>> ADULT'
ADULT_END = '# <<< ADULT'

ADULT_KEYWORDS = [
    'pornhub', 'stripchat', 'chaturbate', 'bongacams',
    'onlyfans', 'fansly', 'hentai', 'rule34', 'nsfw', 'porn'
]

def main():
    args = parse_args()
    errors = []

    # Read base config
    lines = read_config(BASE_CONFIG)

    # Generate personal (full copy)
    generate_personal(lines, dry_run=args.dry_run)

    # Generate work (filter adult blocks)
    work_lines, blocks = filter_adult_blocks(lines)
    errors += generate_work(work_lines, blocks, dry_run=args.dry_run)

    # Validate YAML
    errors += validate_yaml(PERSONAL_OUTPUT, args.dry_run)
    errors += validate_yaml(WORK_OUTPUT, args.dry_run)

    # Check adult keywords in work config
    errors += check_and_report_keywords(work_lines)

    # Exit code
    sys.exit(1 if errors else 0)
```

### Бэкап перед перезаписью
```python
def backup_if_exists(path: Path) -> None:
    """Create .bak backup if file exists."""
    if path.exists():
        bak = path.with_suffix(path.suffix + '.bak')
        shutil.copy2(path, bak)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `os.path.join()` | `pathlib.Path` | Python 3.4+ | Cleaner path handling |
| `yaml.load(Loader=FullLoader)` | `yaml.safe_load()` | PyYAML 5.1+ | Security: no arbitrary code execution |
| Manual ANSI detection | `os.system('')` on Windows | Windows 10 1511+ | ANSI codes work in cmd.exe |

**Deprecated/outdated:**
- `yaml.load()` без Loader: security vulnerability (arbitrary code execution)

## Open Questions

1. **Нужен ли requirements.txt?**
   - What we know: PyYAML уже установлен глобально (6.0.3)
   - What's unclear: Нужно ли формализовать зависимости для воспроизводимости
   - Recommendation: Добавить простой requirements.txt с `pyyaml>=6.0` -- одна строка, но полезно для документации

## Sources

### Primary (HIGH confidence)
- Python 3.14 stdlib documentation (pathlib, argparse, shutil, re)
- PyYAML 6.0.3 -- `yaml.safe_load()` API
- Прямой анализ config.yaml (1541 строка, 4 пары маркеров на строках: 496/541, 591/597, 1145/1217, 1224/1262)

### Secondary (MEDIUM confidence)
- ANSI color support on Windows 10+ via `os.system('')` trick

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- PyYAML 6.0.3 подтверждён в системе, stdlib стабилен
- Architecture: HIGH -- задача текстовой обработки, паттерн state machine тривиален
- Pitfalls: HIGH -- основаны на прямом анализе config.yaml и Windows-специфики

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (стабильный домен, без быстрых изменений)
