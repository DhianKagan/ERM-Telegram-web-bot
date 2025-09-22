#!/bin/bash
# Назначение скрипта: установка браузеров Playwright, необходимых для e2e-тестов.
# Основные модули: pnpm, Playwright.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm не найден. Установите pnpm перед запуском тестов." >&2
  exit 1
fi

INSTALL_ARGS=("firefox" "chromium" "webkit")
if [[ "${CI:-}" == "true" ]] || [[ "$(uname -s)" == "Linux" ]]; then
  INSTALL_ARGS=("--with-deps" "firefox" "chromium" "webkit")
fi

pnpm exec playwright install "${INSTALL_ARGS[@]}"
