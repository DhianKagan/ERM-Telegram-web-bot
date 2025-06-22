#!/usr/bin/env bash
# Назначение: проверка и обновление зависимостей модуля bot.
# Модули: стандартные возможности bash и npm.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

npm --prefix "$DIR/bot" audit
npm --prefix "$DIR/bot" outdated || true
