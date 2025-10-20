#!/usr/bin/env bash
# Назначение: аудит зависимостей и проверка конфликтов.
# Модули: bash, pnpm, audit-ci.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

DEFAULT_FETCH_TIMEOUT=120000
export NPM_CONFIG_FETCH_TIMEOUT="${NPM_CONFIG_FETCH_TIMEOUT:-$DEFAULT_FETCH_TIMEOUT}"
export NPM_CONFIG_FETCH_RETRIES="${NPM_CONFIG_FETCH_RETRIES:-5}"
export NPM_CONFIG_FETCH_RETRY_MINTIMEOUT="${NPM_CONFIG_FETCH_RETRY_MINTIMEOUT:-20000}"
export NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT="${NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT:-$DEFAULT_FETCH_TIMEOUT}"

run_with_retry() {
  local attempts=$1
  shift
  local delay=$1
  shift
  local cmd=("$@")
  local attempt=1
  local exit_code=0
  local current_delay=$delay

  while (( attempt <= attempts )); do
    set +e
    "${cmd[@]}"
    exit_code=$?
    set -e
    if (( exit_code == 0 )); then
      return 0
    fi
    if (( attempt == attempts )); then
      break
    fi
    printf 'Попытка %d команды %s завершилась с кодом %d. Повтор через %d с...\n' \
      "$attempt" "$(printf '%q ' "${cmd[@]}")" "$exit_code" "$current_delay" >&2
    sleep "$current_delay"
    current_delay=$(( current_delay * 2 ))
    ((attempt++))
  done

  printf 'Команда %s завершилась ошибкой (код %d) после %d попыток.\n' \
    "$(printf '%q ' "${cmd[@]}")" "$exit_code" "$attempts" >&2
  return "$exit_code"
}

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

run_with_retry 4 10 npx --yes audit-ci --config "$DIR/audit-ci.json" --package-manager pnpm --audit-level high
run_with_retry 4 10 npx --yes audit-ci --config "$DIR/audit-ci.json" --package-manager pnpm --path "$DIR/apps/api" --audit-level high
run_with_retry 4 10 npx --yes audit-ci --config "$DIR/audit-ci.json" --package-manager pnpm --path "$DIR/apps/web" --audit-level high
pnpm ls --dir "$DIR/apps/web" >/dev/null
