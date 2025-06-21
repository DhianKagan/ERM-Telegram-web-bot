#!/bin/bash
# Назначение: резервное копирование MongoDB в облачное хранилище R2.
# Модули: mongodump, gzip, aws cli. Используется set -a для экспорта
# переменных из .env без явного перечисления.
set -e
DIR=$(dirname "$0")/..
if [ ! -f "$DIR/.env" ]; then
  echo ".env не найден" >&2
  exit 1
fi
set -a
. "$DIR/.env"
set +a
TS=$(date +%Y-%m-%d_%H-%M-%S)
FILE="mongo_$TS.archive.gz"
mongodump --uri "$MONGO_DATABASE_URL" --archive | gzip > "$FILE"
aws --endpoint-url "$R2_ENDPOINT" s3 cp "$FILE" "s3://$R2_BUCKET_NAME/$FILE"
rm "$FILE"
