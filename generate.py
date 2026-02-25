#!/usr/bin/env python3
"""Генерация двух вариантов конфига mihomo из базового config.yaml.

Скрипт читает базовый config.yaml и создаёт:
- config-personal.yaml — полная копия (все правила включены)
- config-work.yaml — без adult-контента (блоки между маркерами # >>> ADULT / # <<< ADULT удалены)

Выходные файлы сохраняются в директорию output/.
Перед перезаписью существующих файлов создаётся бэкап (.bak).

Использование:
    python generate.py            # Генерация обоих конфигов
    python generate.py --dry-run  # Показать отчёт без создания файлов
"""

import argparse
import os
import shutil
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("Ошибка: PyYAML не установлен. Установите: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

# --- Включение ANSI-цветов на Windows ---
if os.name == "nt":
    os.system("")

# --- Константы ---
BASE_CONFIG = Path(__file__).parent / "config.yaml"
OUTPUT_DIR = Path(__file__).parent / "output"
PERSONAL_OUTPUT = OUTPUT_DIR / "config-personal.yaml"
WORK_OUTPUT = OUTPUT_DIR / "config-work.yaml"

ADULT_START = "# >>> ADULT"
ADULT_END = "# <<< ADULT"

ADULT_KEYWORDS = [
    "pornhub",
    "stripchat",
    "chaturbate",
    "bongacams",
    "onlyfans",
    "fansly",
    "hentai",
    "rule34",
    "nsfw",
    "porn",
]

# --- ANSI-цвета ---
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
RESET = "\033[0m"


def parse_args() -> argparse.Namespace:
    """Парсинг аргументов командной строки."""
    parser = argparse.ArgumentParser(
        description="Генерация конфигов mihomo (personal и work) из базового config.yaml"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Показать отчёт без создания файлов",
    )
    return parser.parse_args()


def read_config(path: Path) -> list[str]:
    """Читает базовый конфиг и возвращает список строк.

    Использует encoding='utf-8-sig' для автоматического удаления BOM.
    """
    if not path.exists():
        print(f"{RED}Ошибка: файл {path} не найден{RESET}", file=sys.stderr)
        sys.exit(1)
    with open(path, encoding="utf-8-sig") as f:
        return f.readlines()


def filter_adult_blocks(lines: list[str]) -> tuple[list[str], list[dict], list[str]]:
    """Удаляет строки между маркерами # >>> ADULT и # <<< ADULT (включительно).

    Возвращает:
        - Отфильтрованные строки (без adult-блоков)
        - Список удалённых блоков [{start, end, lines_count}]
        - Список предупреждений (непарные маркеры и т.д.)
    """
    result = []
    removed_blocks = []
    warnings = []
    inside_adult = False
    block_start = -1
    block_lines = 0

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped == ADULT_START:
            if inside_adult:
                warnings.append(
                    f"Строка {i}: вложенный маркер '{ADULT_START}' "
                    f"(предыдущий открыт на строке {block_start})"
                )
            inside_adult = True
            block_start = i
            block_lines = 0
            continue
        if stripped == ADULT_END:
            if not inside_adult:
                warnings.append(
                    f"Строка {i}: закрывающий маркер '{ADULT_END}' без открывающего"
                )
                continue
            inside_adult = False
            removed_blocks.append(
                {"start": block_start, "end": i, "lines_count": block_lines}
            )
            continue
        if inside_adult:
            block_lines += 1
            continue
        result.append(line)

    if inside_adult:
        warnings.append(
            f"Строка {block_start}: незакрытый маркер '{ADULT_START}' — "
            f"всё после строки {block_start} удалено ({block_lines} строк)"
        )
        removed_blocks.append(
            {"start": block_start, "end": len(lines), "lines_count": block_lines}
        )

    return result, removed_blocks, warnings


def validate_yaml(content: str) -> tuple[bool, str | None]:
    """Валидирует YAML-содержимое через yaml.safe_load().

    Возвращает (True, None) при успехе или (False, описание_ошибки) при ошибке.
    """
    try:
        yaml.safe_load(content)
        return True, None
    except yaml.YAMLError as e:
        return False, str(e)


def check_adult_keywords(lines: list[str]) -> dict[str, list[int]]:
    """Проверяет наличие adult-ключевых слов в строках (case-insensitive).

    Возвращает словарь {keyword: [номера_строк_где_найдено]}.
    Пустой список означает, что keyword не найден.
    """
    findings: dict[str, list[int]] = {kw: [] for kw in ADULT_KEYWORDS}
    for i, line in enumerate(lines, 1):
        lower = line.lower()
        for kw in ADULT_KEYWORDS:
            if kw in lower:
                findings[kw].append(i)
    return findings


def backup_if_exists(path: Path) -> bool:
    """Создаёт .bak-бэкап файла, если он существует.

    Возвращает True, если бэкап был создан.
    """
    if path.exists():
        bak = path.with_suffix(path.suffix + ".bak")
        shutil.copy2(path, bak)
        return True
    return False


def write_output(path: Path, lines: list[str], dry_run: bool) -> bool:
    """Записывает строки в файл, создавая директорию при необходимости.

    При dry_run=True файл не создаётся.
    Возвращает True, если был создан бэкап.
    """
    backed_up = False
    if dry_run:
        return backed_up
    os.makedirs(path.parent, exist_ok=True)
    backed_up = backup_if_exists(path)
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    return backed_up


def print_report(
    source_path: Path,
    source_lines: int,
    removed_blocks: list[dict],
    marker_warnings: list[str],
    keyword_results: dict[str, list[int]],
    personal_valid: tuple[bool, str | None],
    work_valid: tuple[bool, str | None],
    personal_lines: int,
    work_lines: int,
    personal_backed_up: bool,
    work_backed_up: bool,
    dry_run: bool,
) -> list[str]:
    """Выводит детальный отчёт и возвращает список ошибок."""
    errors = []

    print(f"\n{BOLD}{'=' * 50}")
    print(f" Генерация конфигов mihomo")
    print(f"{'=' * 50}{RESET}\n")

    # Источник
    print(f"{BOLD}Источник:{RESET} {source_path}")
    print(f"  Строк: {source_lines}\n")

    # Маркерные предупреждения
    if marker_warnings:
        print(f"{BOLD}{YELLOW}Предупреждения маркеров:{RESET}")
        for w in marker_warnings:
            print(f"  {YELLOW}! {w}{RESET}")
            errors.append(w)
        print()

    # Удалённые блоки
    total_removed = sum(b["lines_count"] for b in removed_blocks)
    print(f"{BOLD}Удалённые adult-блоки:{RESET}")
    if removed_blocks:
        for b in removed_blocks:
            print(
                f"  строки {b['start']}–{b['end']}: "
                f"{b['lines_count']} строк удалено"
            )
        print(f"  {BOLD}Итого:{RESET} {total_removed} строк в {len(removed_blocks)} блоках")
    else:
        print(f"  {YELLOW}Блоки не найдены{RESET}")
    print()

    # Проверка adult-keywords
    print(f"{BOLD}Проверка adult-ключевых слов в work-конфиге:{RESET}")
    keywords_found = False
    for kw in ADULT_KEYWORDS:
        line_nums = keyword_results[kw]
        if line_nums:
            keywords_found = True
            lines_str = ", ".join(str(n) for n in line_nums[:5])
            suffix = f" (+{len(line_nums) - 5} ещё)" if len(line_nums) > 5 else ""
            print(f"  {RED}НАЙДЕНО{RESET}  {kw} — строки: {lines_str}{suffix}")
        else:
            print(f"  {GREEN}OK{RESET}       {kw}")
    if keywords_found:
        errors.append("Adult-ключевые слова найдены в work-конфиге")
    print()

    # Валидация YAML
    print(f"{BOLD}Валидация YAML:{RESET}")
    label = "[DRY RUN] " if dry_run else ""

    p_ok, p_err = personal_valid
    if p_ok:
        print(f"  {GREEN}OK{RESET}  {label}config-personal.yaml ({personal_lines} строк)")
    else:
        print(f"  {RED}ОШИБКА{RESET}  {label}config-personal.yaml: {p_err}")
        errors.append(f"Невалидный YAML: config-personal.yaml")

    w_ok, w_err = work_valid
    if w_ok:
        print(f"  {GREEN}OK{RESET}  {label}config-work.yaml ({work_lines} строк)")
    else:
        print(f"  {RED}ОШИБКА{RESET}  {label}config-work.yaml: {w_err}")
        errors.append(f"Невалидный YAML: config-work.yaml")
    print()

    # Результат
    print(f"{BOLD}Результат:{RESET}")
    if dry_run:
        print(f"  {YELLOW}[DRY RUN] Файлы не созданы{RESET}")
    else:
        bak_p = " (бэкап создан)" if personal_backed_up else ""
        bak_w = " (бэкап создан)" if work_backed_up else ""
        print(f"  {GREEN}Создан{RESET}  {PERSONAL_OUTPUT}{bak_p}")
        print(f"  {GREEN}Создан{RESET}  {WORK_OUTPUT}{bak_w}")
    print()

    # Итог
    if errors:
        print(f"{RED}{BOLD}ОШИБКИ ({len(errors)}):{RESET}")
        for e in errors:
            print(f"  {RED}✗ {e}{RESET}")
    else:
        print(f"{GREEN}{BOLD}Все проверки пройдены ✓{RESET}")
    print()

    return errors


def main() -> None:
    """Главная функция генерации конфигов."""
    args = parse_args()

    # Чтение базового конфига
    lines = read_config(BASE_CONFIG)

    # Фильтрация adult-блоков для work-конфига
    work_lines, removed_blocks, marker_warnings = filter_adult_blocks(lines)

    # Запись файлов
    personal_backed_up = write_output(PERSONAL_OUTPUT, lines, args.dry_run)
    work_backed_up = write_output(WORK_OUTPUT, work_lines, args.dry_run)

    # Валидация YAML
    if args.dry_run:
        personal_content = "".join(lines)
        work_content = "".join(work_lines)
    else:
        with open(PERSONAL_OUTPUT, encoding="utf-8") as f:
            personal_content = f.read()
        with open(WORK_OUTPUT, encoding="utf-8") as f:
            work_content = f.read()

    personal_valid = validate_yaml(personal_content)
    work_valid = validate_yaml(work_content)

    # Проверка adult-keywords в work-конфиге
    keyword_results = check_adult_keywords(work_lines)

    # Отчёт
    errors = print_report(
        source_path=BASE_CONFIG,
        source_lines=len(lines),
        removed_blocks=removed_blocks,
        marker_warnings=marker_warnings,
        keyword_results=keyword_results,
        personal_valid=personal_valid,
        work_valid=work_valid,
        personal_lines=len(lines),
        work_lines=len(work_lines),
        personal_backed_up=personal_backed_up,
        work_backed_up=work_backed_up,
        dry_run=args.dry_run,
    )

    # Exit code
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
