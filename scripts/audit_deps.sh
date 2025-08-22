#!/usr/bin/env bash
# Назначение: аудит зависимостей и проверка конфликтов.
# Модули: bash, pnpm, audit-ci.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

# Проверяем наличие pnpm и устанавливаем через corepack при отсутствии
if ! command -v pnpm >/dev/null; then
  if command -v corepack >/dev/null; then
    echo "Устанавливаем pnpm через corepack..."
    corepack enable >/dev/null
    corepack prepare pnpm@latest --activate >/dev/null
  else
    echo "Не найден pnpm и corepack; установите pnpm вручную." >&2
    exit 1
  fi
fi

npx --yes audit-ci --config "$DIR/audit-ci.json" --package-manager pnpm --audit-level high
npx --yes audit-ci --config "$DIR/audit-ci.json" --package-manager pnpm --path "$DIR/apps/api" --audit-level high
npx --yes audit-ci --config "$DIR/audit-ci.json" --package-manager pnpm --path "$DIR/apps/web" --audit-level high
pnpm ls --dir "$DIR/apps/web" >/dev/null
