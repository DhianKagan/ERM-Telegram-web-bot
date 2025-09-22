#!/bin/bash
# Назначение скрипта: запуск диагностики Playwright с запасным режимом проверки установки.
# Основные модули: pnpm, Playwright CLI.
set -euo pipefail
cd "$(dirname "$0")/.."

LOG_FILE="${1:-}"

run_with_optional_log() {
  local -a cmd=("$@")
  if [[ -n "$LOG_FILE" ]]; then
    "${cmd[@]}" 2>&1 | tee "$LOG_FILE"
  else
    "${cmd[@]}"
  fi
}

if run_with_optional_log pnpm exec playwright doctor; then
  exit 0
fi

echo "Команда 'playwright doctor' недоступна, выполняем 'playwright install --list'." >&2
run_with_optional_log pnpm exec playwright install --list
