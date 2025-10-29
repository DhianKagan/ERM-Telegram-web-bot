#!/usr/bin/env bash
# Назначение: запуск eslint-plugin-security только для изменённых TypeScript-файлов.
# Основные модули: scripts/get_changed_files.sh, eslint, pnpm exec.
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

mapfile -t CHANGED < <(scripts/get_changed_files.sh || true)
if [[ ${#CHANGED[@]} -eq 0 ]]; then
  echo "Нет изменённых файлов для проверки безопасности."
  exit 0
fi

PATTERN='\.(ts|tsx|mts|cts)$'
mapfile -t TARGETS < <(printf '%s\n' "${CHANGED[@]}" | grep -E "$PATTERN" | sort -u || true)
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  echo "Изменённых TypeScript-файлов нет, проверка безопасности пропущена."
  exit 0
fi

printf 'Запускаем security-правила для %d файлов...\n' "${#TARGETS[@]}"
ESLINT_USE_FLAT_CONFIG=true pnpm exec eslint --config eslint.security.config.ts --max-warnings=0 "${TARGETS[@]}"
