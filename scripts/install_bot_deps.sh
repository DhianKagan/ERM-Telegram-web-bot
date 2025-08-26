#!/usr/bin/env bash
# Назначение: установка корневых, серверных и клиентских зависимостей с автоматическим устранением уязвимостей.
# Модули: bash, pnpm, npm, corepack, curl.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"

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

# Устанавливаем корневые зависимости для линтера
pnpm install --frozen-lockfile || pnpm install
# Устанавливаем зависимости сервера
pnpm install --dir "$DIR/apps/api" --frozen-lockfile || pnpm install --dir "$DIR/apps/api"
# Устанавливаем зависимости веб-клиента
pnpm install --dir "$DIR/apps/web" --frozen-lockfile || pnpm install --dir "$DIR/apps/web"
# Слабые уязвимости не блокируют установку
pnpm audit --dir "$DIR/apps/api" --fix || true
# Проверяем наличие серьёзных проблем
pnpm audit --dir "$DIR/apps/api" --audit-level high
