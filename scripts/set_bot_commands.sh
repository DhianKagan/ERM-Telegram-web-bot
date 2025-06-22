#!/usr/bin/env bash
# Назначение: установка списка команд бота через BotFather.
# Модули: curl, bash.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
FILE="${1:-$DIR/scripts/bot_commands.json}"
BOT_TOKEN=${BOT_TOKEN:?BOT_TOKEN is required}

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands" \
  -H "Content-Type: application/json" \
  -d "@${FILE}"

echo "Команды обновлены"
