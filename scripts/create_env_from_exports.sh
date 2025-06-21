#!/bin/bash
# Назначение: генерация файла .env из переменных окружения.
# Модули: стандартные средства bash.
set -e
DIR=$(dirname "$0")/..
ENV_FILE="$DIR/.env"
EXAMPLE="$DIR/.env.example"
if [ -f "$ENV_FILE" ]; then
  echo "$ENV_FILE уже существует" >&2
  exit 0
fi
while IFS= read -r line; do
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  key=${line%%=*}
  def=${line#*=}
  val=${!key-}
  [ -z "$val" ] && val=$def
  printf '%s=%s\n' "$key" "$val"
done < "$EXAMPLE" > "$ENV_FILE"
echo ".env создан"
