#!/usr/bin/env bash
# Назначение: установка зависимостей бота с автоматическим устранением уязвимостей.
# Модули: bash, npm.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

npm ci --prefix "$DIR/bot" || npm --prefix "$DIR/bot" install
npm audit fix --prefix "$DIR/bot"
