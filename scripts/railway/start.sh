#!/usr/bin/env sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

PM2_RUNTIME_PATH="apps/api/node_modules/.bin/pm2-runtime"

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

if [ -x "./scripts/set_bot_commands.sh" ]; then
  ./scripts/set_bot_commands.sh
fi

if [ -f "dist/scripts/db/ensureDefaults.js" ]; then
  node dist/scripts/db/ensureDefaults.js
fi

exec pnpm --filter apps/api exec pm2-runtime apps/api/ecosystem.config.cjs
