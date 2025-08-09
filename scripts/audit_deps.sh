#!/usr/bin/env bash
# Назначение: аудит зависимостей и проверка конфликтов.
# Модули: bash, npm, pnpm, audit-ci.
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

npx --yes audit-ci --package-manager pnpm --audit-level high
npm audit --prefix "$DIR/bot" --audit-level high
npm audit --prefix "$DIR/bot/web" --audit-level high
npm ls --prefix "$DIR/bot/web" >/dev/null
