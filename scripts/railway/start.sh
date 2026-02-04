#!/usr/bin/env sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

PM2_RUNTIME_PATH="apps/api/node_modules/pm2/bin/pm2-runtime"
PM2_RUNTIME_BIN="apps/api/node_modules/.bin/pm2-runtime"
PM2_PACKAGE_JSON="apps/api/node_modules/pm2/package.json"
DOTENV_PACKAGE_JSON="apps/api/node_modules/dotenv/package.json"
MONGOOSE_PACKAGE_JSON="apps/api/node_modules/mongoose/package.json"

if [ ! -d "node_modules/.pnpm" ] \
  || [ ! -x "$PM2_RUNTIME_PATH" ] \
  || [ ! -x "$PM2_RUNTIME_BIN" ] \
  || [ ! -f "$PM2_PACKAGE_JSON" ] \
  || [ ! -f "$DOTENV_PACKAGE_JSON" ] \
  || [ ! -f "$MONGOOSE_PACKAGE_JSON" ]; then
  echo "Зависимости не найдены или pm2-runtime отсутствует, устанавливаем production-зависимости..."
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
