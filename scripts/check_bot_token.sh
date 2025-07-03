#!/usr/bin/env bash
# Проверка токена бота Telegram
# Модули: bash, curl
set -euo pipefail

if [ -z "${BOT_TOKEN:-}" ]; then
  echo "BOT_TOKEN не задан" >&2
  exit 1
fi

response=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe")
if echo "$response" | grep -q '"ok":true'; then
  echo "ok: true"
else
  echo "$response"
fi

