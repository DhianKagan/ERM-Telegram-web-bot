#!/usr/bin/env bash
# Назначение: проверка отсутствия JavaScript-файлов в репозитории.
# Модули: bash, ripgrep.
set -euo pipefail
cd "$(dirname "$0")/.."
if rg --files -g '*.js' -g '!node_modules/**' -g '!dist/**' | grep -q '.'; then
  echo 'Найдены файлы JavaScript. Используйте TypeScript.' >&2
  exit 1
fi
