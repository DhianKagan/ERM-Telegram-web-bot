#!/usr/bin/env bash
# Назначение: генерация `.env` из текущего окружения.
# Модули: стандартные возможности bash.
# Поддержка специальных символов обеспечивается использованием экранирования.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
ENV_FILE="$DIR/.env"
EXAMPLE="$DIR/.env.example"
if [[ -f $ENV_FILE ]]; then
  echo "$ENV_FILE уже существует" >&2
  exit 0
fi
if [[ ! -f $EXAMPLE ]]; then
  echo "$EXAMPLE не найден" >&2
  exit 1
fi

declare -A DEFAULTS=(
  [BOT_TOKEN]="$(openssl rand -hex 16)"
  [CHAT_ID]="$(shuf -i 100000000-999999999 -n 1)"
  [JWT_SECRET]="$(openssl rand -hex 32)"
  [SESSION_SECRET]="$(openssl rand -hex 64)"
  [APP_URL]="https://localhost:3000"
  [MONGO_DATABASE_URL]="mongodb://admin:admin@localhost:27017/ermdb?authSource=admin"
)

while IFS= read -r line; do
  [[ -z $line || $line == \#* ]] && continue
  key=${line%%=*}
  def=${line#*=}
  val="${!key:-${DEFAULTS[$key]:-$def}}"
  printf '%s=%q\n' "$key" "$val"
done < "$EXAMPLE" > "$ENV_FILE"
echo "$ENV_FILE обновлён"
