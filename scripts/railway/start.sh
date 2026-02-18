#!/usr/bin/env sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

PM2_RUNTIME_PATH="apps/api/node_modules/.bin/pm2-runtime"
PM2_PATH="apps/api/node_modules/.bin/pm2"

can_resolve_module() {
  module_name="$1"
  node -e "require.resolve('${module_name}', { paths: ['${ROOT_DIR}/apps/api'] })" >/dev/null 2>&1
}

if [ ! -d "node_modules/.pnpm" ] \
  || [ ! -x "$PM2_RUNTIME_PATH" ] \
  || ! can_resolve_module "pm2/bin/pm2-runtime" \
  || ! can_resolve_module "dotenv" \
  || ! can_resolve_module "mongoose"; then
  echo "Зависимости не найдены или pm2-runtime отсутствует, устанавливаем production-зависимости для apps/api..."
  corepack enable
  pnpm --filter apps/api... -s install --frozen-lockfile --prod
fi

# Preflight: MongoDB must be reachable in Railway runtime.
# NOTE: scripts/check_mongo.mjs skips when CI is set, so we run it with CI unset.
if [ "${RUN_MONGO_CHECK_ON_START:-1}" = "1" ]; then
  echo ">>> [preflight] MongoDB ping..."
  CI= node scripts/check_mongo.mjs
fi

if [ -x "./scripts/set_bot_commands.sh" ]; then
  ./scripts/set_bot_commands.sh
fi

if [ -f "dist/scripts/db/ensureDefaults.js" ]; then
  node dist/scripts/db/ensureDefaults.js
fi

mkdir -p /var/log/pm2
"$PM2_PATH" install pm2-logrotate
"$PM2_PATH" set pm2-logrotate:max_size 10M
"$PM2_PATH" set pm2-logrotate:retain 7
"$PM2_PATH" set pm2-logrotate:compress true

exec pnpm --filter apps/api exec pm2-runtime apps/api/ecosystem.config.cjs
