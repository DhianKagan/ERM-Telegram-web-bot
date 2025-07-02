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

while IFS= read -r line; do
  [[ -z $line || $line == \#* ]] && continue
  key=${line%%=*}
  def=${line#*=}
  val="${!key:-$def}"
  printf '%s=%q\n' "$key" "$val"
done < "$EXAMPLE" > "$ENV_FILE"
echo "$ENV_FILE обновлён"
