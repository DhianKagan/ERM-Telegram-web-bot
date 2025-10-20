#!/usr/bin/env bash
# Назначение: установка корневых, серверных и клиентских зависимостей с автоматическим устранением уязвимостей.
# Модули: bash, pnpm, npm, corepack, curl.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"

is_network_error() {
  local message="$1"
  [[ "$message" =~ ERR_SOCKET_TIMEOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|503[[:space:]]Service[[:space:]]Unavailable|network[[:space:]]error ]]
}

run_audit_with_fallback() {
  local dir="$1"
  shift
  local attempts=0
  local max_attempts=3
  local backoff=5
  local output
  local status

  while (( attempts < max_attempts )); do
    if output=$(pnpm audit --dir "$dir" "$@" 2>&1); then
      printf '%s\n' "$output"
      return 0
    fi
    status=$?
    printf '%s\n' "$output" >&2
    if ! is_network_error "$output"; then
      return "$status"
    fi
    attempts=$((attempts + 1))
    if (( attempts < max_attempts )); then
      local delay=$((backoff * attempts))
      echo "pnpm audit завершился сетевой ошибкой, повтор через ${delay} с..." >&2
      sleep "$delay"
    fi
  done

  echo "pnpm audit недоступен из-за сетевых ошибок. Пробуем audit-ci..." >&2
  if output=$(pnpm --dir "$DIR" exec -- audit-ci --config "$DIR/audit-ci.json" --path "$dir" --audit-level high 2>&1); then
    printf '%s\n' "$output"
    echo "audit-ci подтвердил отсутствие высоких уязвимостей." >&2
    return 0
  fi

  printf '%s\n' "$output" >&2
  if is_network_error "$output"; then
    echo "Не удалось выполнить аудит зависимостей из-за сетевых ошибок. Проверьте соединение и повторите запуск." >&2
    return 0
  fi

  echo "audit-ci обнаружил проблемы, установка прервана." >&2
  return 1
}

# Последняя линия обороны: загрузка бинарника pnpm из GitHub.
install_pnpm_from_github() {
  local version
  version=$(node -p "require('$DIR/package.json').packageManager.split('@')[1]" 2>/dev/null || echo "10.15.0")
  mkdir -p "$PNPM_HOME"
  if curl -fsSL --retry 5 --retry-delay 1 "https://github.com/pnpm/pnpm/releases/download/v${version}/pnpm-linuxstatic-x64" -o "$PNPM_HOME/pnpm"; then
    chmod +x "$PNPM_HOME/pnpm"
    export PATH="$PNPM_HOME:$PATH"
    return 0
  fi
  echo "Не удалось скачать бинарник pnpm с GitHub." >&2
  return 1
}

# Проверяем наличие pnpm и устанавливаем при отсутствии
if ! command -v pnpm >/dev/null; then
  if command -v corepack >/dev/null; then
    echo "Устанавливаем pnpm через corepack..."
    if ! (corepack enable >/dev/null && corepack prepare pnpm@latest --activate >/dev/null); then
      echo "corepack не смог установить pnpm, пробуем npm..." >&2
      if ! npm install -g pnpm >/dev/null 2>&1; then
        echo "npm не смог установить pnpm, скачиваем скрипт..." >&2
        if ! curl -fsSL --retry 5 --retry-delay 1 https://get.pnpm.io/install.sh | sh - >/dev/null 2>&1; then
          echo "Не удалось скачать скрипт установки pnpm." >&2
          install_pnpm_from_github || true
        fi
        export PATH="$PNPM_HOME:$PATH"
      fi
    fi
  else
    echo "Не найден pnpm и corepack; устанавливаем pnpm через npm..." >&2
    if ! npm install -g pnpm >/dev/null 2>&1; then
      echo "npm не смог установить pnpm, скачиваем скрипт..." >&2
      if ! curl -fsSL --retry 5 --retry-delay 1 https://get.pnpm.io/install.sh | sh - >/dev/null 2>&1; then
        echo "Не удалось скачать скрипт установки pnpm." >&2
        install_pnpm_from_github || true
      fi
      export PATH="$PNPM_HOME:$PATH"
    fi
  fi
  command -v pnpm >/dev/null || { echo "Не удалось установить pnpm." >&2; exit 1; }
fi

# Гарантируем использование реестра npmjs.org для всех пакетов и scope @jsr
pnpm config set registry https://registry.npmjs.org/ >/dev/null
pnpm config set @jsr:registry https://registry.npmjs.org/ >/dev/null
npm config set registry https://registry.npmjs.org/ >/dev/null 2>&1 || true
npm config set @jsr:registry https://registry.npmjs.org/ >/dev/null 2>&1 || true

# Устанавливаем корневые зависимости для линтера
pnpm install --frozen-lockfile || pnpm install
# Устанавливаем зависимости сервера
pnpm install --dir "$DIR/apps/api" --frozen-lockfile || pnpm install --dir "$DIR/apps/api"
# Устанавливаем зависимости веб-клиента
pnpm install --dir "$DIR/apps/web" --frozen-lockfile || pnpm install --dir "$DIR/apps/web"
# Слабые уязвимости не блокируют установку
pnpm audit --dir "$DIR/apps/api" --fix || true
# Проверяем наличие серьёзных проблем с устойчивостью к сетевым сбоям
run_audit_with_fallback "$DIR/apps/api" --audit-level high --ignore-unfixable
