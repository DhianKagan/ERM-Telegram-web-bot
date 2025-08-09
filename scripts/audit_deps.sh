#!/usr/bin/env bash
# Назначение: аудит зависимостей и проверка конфликтов.
# Модули: bash, npm, pnpm, audit-ci.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

npx audit-ci --package-manager pnpm --audit-level high
npm audit --prefix "$DIR/bot" --audit-level high
npm audit --prefix "$DIR/bot/web" --audit-level high
npm ls --prefix "$DIR/bot/web" >/dev/null
