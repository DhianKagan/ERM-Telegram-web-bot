#!/bin/bash
# Назначение скрипта: установка зависимостей и сборка фронтенда.
# Модули: npm, bash.
set -e
cd "$(dirname "$0")/.."
if [ ! -d bot/web/node_modules ]; then
  npm --prefix bot/web install > /tmp/npm_install.log 2>&1 && tail -n 20 /tmp/npm_install.log
fi
npm --prefix bot run build-client > /tmp/npm_build.log 2>&1 && tail -n 20 /tmp/npm_build.log

