#!/usr/bin/env bash
# Назначение: выборка изменённых файлов и проверка форматирования через Prettier.
# Основные модули: git status, git diff, pnpm exec prettier.
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

mapfile -t CANDIDATES < <(scripts/get_changed_files.sh || true)
if [[ ${#CANDIDATES[@]} -eq 0 ]]; then
  echo "Нет изменённых файлов для проверки Prettier."
  exit 0
fi

PATTERN='\.(ts|tsx|js|jsx|json|md|yml|yaml|cjs|mjs|cts|mts)$'
mapfile -t TARGETS < <(printf '%s\n' "${CANDIDATES[@]}" | grep -E "$PATTERN" | sort -u || true)
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  echo "Изменённых файлов подходящих расширений нет, Prettier пропущен."
  exit 0
fi

printf 'Проверяем форматирование %d файлов...\n' "${#TARGETS[@]}"
pnpm exec prettier --check "${TARGETS[@]}"
