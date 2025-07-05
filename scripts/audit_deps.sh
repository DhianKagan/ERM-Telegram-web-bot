#!/usr/bin/env bash
# Назначение: аудит зависимостей и проверка конфликтов.
# Модули: bash, npm.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

npm audit --prefix "$DIR/bot"
npm audit --prefix "$DIR/bot/web"
npm ls --prefix "$DIR/bot/web" >/dev/null
