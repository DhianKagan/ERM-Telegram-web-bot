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
# wait for 27017 to open (node-based, portable)
for i in {1..30}; do
  node -e "const net=require('net');
  const s = net.createConnection({port:27017, host:'127.0.0.1'});
  let timed=false;
  s.on('connect', ()=>{ console.log('port open'); s.end(); process.exit(0); });
  s.on('error', ()=>{ if(!timed){ process.exit(1); }});
  setTimeout(()=>{ timed=true; process.exit(1); }, 800);
  " && break
  echo "waiting for mongodb... ($i/30)"
  sleep 1
done

./scripts/create_env_from_exports.sh >/dev/null || true

pnpm --dir apps/api run start
