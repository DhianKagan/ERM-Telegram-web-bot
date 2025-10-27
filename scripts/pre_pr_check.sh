#!/usr/bin/env bash
# Назначение: проверка сборки и запуска бота перед пулл-реквестом.
# Модули: bash, npm.
set -euo pipefail
cd "$(dirname "$0")/.."

# Запускаем MongoDB в памяти
pnpm --dir apps/api exec node <<'NODE' &
import { MongoMemoryServer } from 'mongodb-memory-server';
MongoMemoryServer.create({ instance: { port: 27017 } }).then(() => console.log('MongoDB в памяти запущена'));
setInterval(() => {}, 1000);
NODE
MONGO_PID=$!
trap 'kill $MONGO_PID' EXIT
export MONGO_DATABASE_URL="mongodb://127.0.0.1:27017/ermdb"
for i in {1..30}; do
  nc -z 127.0.0.1 27017 && break
  sleep 1
done

./scripts/create_env_from_exports.sh >/dev/null || true

# Проверяем наличие SESSION_SECRET и при необходимости генерируем
current_secret=$(grep '^SESSION_SECRET=' .env | cut -d= -f2- || true)
if [ -z "${SESSION_SECRET:-$current_secret}" ]; then
  new_secret=$(openssl rand -hex 64)
  if grep -q '^SESSION_SECRET=' .env; then
    sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$new_secret/" .env
  else
    echo "SESSION_SECRET=$new_secret" >> .env
  fi
  export SESSION_SECRET="$new_secret"
else
  export SESSION_SECRET="${SESSION_SECRET:-$current_secret}"
fi

# Проверяем обязательные переменные окружения
for var in BOT_TOKEN JWT_SECRET SESSION_SECRET MONGO_DATABASE_URL APP_URL; do
  value=$(grep "^${var}=" .env | cut -d= -f2-)
  if [ -z "$value" ]; then
    echo "${var} не задан" >&2
    exit 1
  fi
  if [ "$var" = SESSION_SECRET ] && [ ${#value} -lt 64 ]; then
    echo "SESSION_SECRET короче 64 символов" >&2
    exit 1
  fi
done

cp .env apps/.env

./scripts/audit_deps.sh

./scripts/build_client.sh >/dev/null
if [ ! -f apps/api/public/.vite/manifest.json ] || ! ls apps/api/public/js/index*.js >/dev/null 2>&1; then
  echo "Отсутствует собранный JS-бандл" >&2
  exit 1
fi

until pnpm --dir apps/api run build; do
  echo "Сборка не удалась, устанавливаем зависимости..."
  pnpm --dir apps/api install
done

mkdir -p /tmp/apps
attempt=1
max_attempts=5
while [ $attempt -le $max_attempts ]; do
  if timeout 5s pnpm --dir apps/api run start >/tmp/apps/api_start.log 2>&1; then
    echo "Проверка сборки и запуска завершена."
    exit 0
  fi
  status=$?
  if [ "$status" -eq 124 ] || grep -q "API запущен" /tmp/apps/api_start.log; then
    echo "Проверка сборки и запуска завершена."
    exit 0
  fi
  echo "Запуск не удался, пробуем ещё раз..."
  if ! pnpm --dir apps/api run build; then
    pnpm --dir apps/api install
    pnpm --dir apps/api run build
  fi
  attempt=$((attempt + 1))
done

echo "Не удалось запустить бот" >&2
exit 1
