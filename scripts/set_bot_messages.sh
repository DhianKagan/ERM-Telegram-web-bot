#!/usr/bin/env bash
# Назначение: установка описания и команд бота через Telegram Bot API.
# Модули: bash, jq, curl
set -euo pipefail
FILE="${1:-$(dirname "$0")/bot_messages.json}"
BOT_TOKEN=${BOT_TOKEN:?BOT_TOKEN is required}
BASE="https://api.telegram.org/bot${BOT_TOKEN}"

desc=$(jq -r '.description' "$FILE")
short=$(jq -r '.short_description' "$FILE")
cmds=$(jq '.commands' "$FILE")

curl -s -X POST "$BASE/setMyDescription" -H 'Content-Type: application/json' -d "{\"description\":\"${desc}\"}"
curl -s -X POST "$BASE/setMyShortDescription" -H 'Content-Type: application/json' -d "{\"short_description\":\"${short}\"}"
curl -s -X POST "$BASE/setMyCommands" -H 'Content-Type: application/json' -d "${cmds}"

echo "Настройки бота обновлены"
