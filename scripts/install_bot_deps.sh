#!/usr/bin/env bash
# Назначение: установка корневых, серверных и клиентских зависимостей с автоматическим устранением уязвимостей.
# Модули: bash, pnpm, npm, corepack.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

# Проверяем наличие pnpm и устанавливаем при отсутствии
if ! command -v pnpm >/dev/null; then
  if command -v corepack >/dev/null; then
    echo "Устанавливаем pnpm через corepack..."
    if ! (corepack enable >/dev/null && corepack prepare pnpm@latest --activate >/dev/null); then
      echo "corepack не смог установить pnpm, пробуем npm..." >&2
      npm install -g pnpm >/dev/null 2>&1 || { echo "Не удалось установить pnpm." >&2; exit 1; }
    fi
  else
    echo "Не найден pnpm и corepack; устанавливаем pnpm через npm..." >&2
    npm install -g pnpm >/dev/null 2>&1 || { echo "Не удалось установить pnpm." >&2; exit 1; }
  fi
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
