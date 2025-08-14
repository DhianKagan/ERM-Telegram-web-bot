#!/usr/bin/env bash
# Назначение: проверка отсутствия JavaScript-файлов в репозитории.
# Модули: bash, ripgrep, git.
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v rg >/dev/null; then
  if rg --files -g '*.js' -g '!node_modules/**' -g '!dist/**' | grep -q '.'; then
    echo 'Найдены файлы JavaScript. Используйте TypeScript.' >&2
    exit 1
  fi
else
  echo 'Предупреждение: ripgrep не найден, используем git ls-files.' >&2
  if git ls-files '*.js' | grep -q '.'; then
    echo 'Найдены файлы JavaScript. Используйте TypeScript.' >&2
    exit 1
  fi
fi
