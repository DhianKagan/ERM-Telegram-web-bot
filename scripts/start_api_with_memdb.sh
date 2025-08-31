#!/usr/bin/env bash
# Назначение: запуск API с MongoDB в памяти.
# Модули: bash, pnpm, MongoMemoryServer.
set -euo pipefail
cd "$(dirname "$0")/.."

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

pnpm --dir apps/api run start
