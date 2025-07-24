#!/usr/bin/env bash
# Назначение: установка зависимостей бота с автоматическим устранением уязвимостей.
# Модули: bash, npm.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

# Устанавливаем зависимости сервера
npm ci --prefix "$DIR/bot" || npm --prefix "$DIR/bot" install
# Устанавливаем зависимости веб-клиента
npm ci --prefix "$DIR/bot/web" || npm --prefix "$DIR/bot/web" install
# Слабые уязвимости не блокируют установку
npm audit fix --prefix "$DIR/bot" || npm audit fix --force --prefix "$DIR/bot" || true
# Проверяем наличие серьёзных проблем
npm audit --prefix "$DIR/bot" --audit-level high

