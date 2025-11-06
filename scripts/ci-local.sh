#!/usr/bin/env bash
set -euo pipefail

# --- Конфиг ---
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

step() { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }

step "Проверяем Node/pnpm"
node -v || { echo "Нужен Node 20+"; exit 1; }
corepack enable >/dev/null 2>&1 || true
corepack use pnpm@10 >/dev/null

step "Чистим рабочее дерево (кроме .env*)"
git clean -xfd -e .env -e '.env.*' || true
pnpm store prune || true

step "Настраиваем pnpm fetch для офлайна"
pnpm config set network-concurrency 1
pnpm config set fetch-retries 5
pnpm fetch

step "Точный репро падения: web prebuild"
if ! pnpm -F web prebuild; then
  echo -e "\n\033[31mprebuild упал. Часто причина — отсутствует dev-зависимость ttf2woff2.\033[0m"
  echo "Починка:"
  echo "  pnpm -F web add -D ttf2woff2"
  echo "И повтор:"
  echo "  pnpm -F web prebuild"
  exit 2
fi

step "Собираем shared"
pnpm --filter shared build

step "Собираем всё, кроме shared"
pnpm -r --filter '!shared' build

step "Служебная компиляция ensureDefaults.ts"
npx tsc scripts/db/ensureDefaults.ts --module commonjs --target ES2020 --outDir dist --rootDir . --types node

step "Копируем фронт-статику в API (если есть)"
[ -d apps/web/dist ] && cp -r apps/web/dist/* apps/api/public/ || true

step "Проверяем lock: pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

step "Быстрый Docker-билд только build-стейджа"
docker build --target build --pull --no-cache -t local/agromarket-build:tmp .

step "Полный Docker-образ (опционально)"
docker build --pull --no-cache -t local/agromarket:dev .

step "ГОТОВО ✅"
