#!/usr/bin/env sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d "node_modules/.pnpm" ] || [ ! -d "apps/api/node_modules/pm2" ]; then
  echo "Зависимости не найдены, устанавливаем production-зависимости..."
  corepack enable
  pnpm -w -s install --frozen-lockfile --prod
fi

if [ -x "./scripts/set_bot_commands.sh" ]; then
  ./scripts/set_bot_commands.sh
fi

if [ -f "dist/scripts/db/ensureDefaults.js" ]; then
  node dist/scripts/db/ensureDefaults.js
fi

exec pnpm --filter apps/api exec pm2-runtime apps/api/ecosystem.config.cjs
