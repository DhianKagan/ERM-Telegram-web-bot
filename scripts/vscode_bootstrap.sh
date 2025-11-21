#!/usr/bin/env bash
# Назначение: подготовка локальной разработки в VS Code (зависимости, .env, Playwright, сборка).
# Модули: bash, pnpm, playwright.
set -euo pipefail

cd "$(dirname "$0")/.."

corepack enable || true

if [ ! -f .env ]; then
  ./scripts/create_env_from_exports.sh
fi

pnpm install --frozen-lockfile || pnpm install

if command -v pnpm >/dev/null; then
  pnpm dlx playwright install --with-deps chromium firefox
  if [ "${OSTYPE:-}" = "linux-gnu" ] || [ "${OSTYPE:-}" = "linux" ]; then
    pnpm dlx playwright install-deps chromium firefox || true
  fi
fi

pnpm --filter web run build:dist
pnpm dlx playwright doctor || pnpm dlx playwright install --list

echo "VS Code окружение готово: зависимости установлены, браузеры Playwright добавлены, сборка web выполнена."
