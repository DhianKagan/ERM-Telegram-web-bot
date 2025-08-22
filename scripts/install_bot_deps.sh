#!/usr/bin/env bash
# Назначение: установка корневых, серверных и клиентских зависимостей с автоматическим устранением уязвимостей.
# Модули: bash, pnpm, npm.
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
