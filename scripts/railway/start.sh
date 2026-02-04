#!/usr/bin/env sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

if [ ! -x "apps/api/node_modules/.bin/pm2-runtime" ]; then
  echo "pm2-runtime не найден, устанавливаем production-зависимости..."
  corepack enable
  pnpm -w -s install --frozen-lockfile --prod
fi

if [ -x "./scripts/set_bot_commands.sh" ]; then
  ./scripts/set_bot_commands.sh
fi

if [ -f "dist/scripts/db/ensureDefaults.js" ]; then
  node dist/scripts/db/ensureDefaults.js
fi

exec ./apps/api/node_modules/.bin/pm2-runtime apps/api/ecosystem.config.cjs
