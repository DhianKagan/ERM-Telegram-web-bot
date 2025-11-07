# Назначение файла: контейнер телеграм-бота с мини-приложением
# Модули: api, запуск через pm2
FROM node:20 AS build
WORKDIR /app

# Инструменты для сборки нативных модулей (ttf2woff2 и др.)
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

# Установка зависимостей
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN corepack enable \
  && pnpm config set network-concurrency 1 \
  && pnpm config set fetch-retries 5 \
  && pnpm fetch

# Копирование исходников, сборка сервера и клиента, перенос фронтенда в public API при наличии dist
COPY . .
RUN pnpm install --offline --frozen-lockfile || pnpm install --no-frozen-lockfile \
  && pnpm --filter shared build \
  && pnpm -r --filter '!shared' build \
  && npx tsc scripts/db/ensureDefaults.ts --module commonjs --target ES2020 --outDir dist --rootDir . --types node \
  && if [ -d apps/web/dist ]; then cp -r apps/web/dist/* apps/api/public/; fi \
  && CI=true pnpm prune --prod \
  && CI=true pnpm store prune

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app .
EXPOSE 3000
CMD ["sh", "-c", "node dist/scripts/db/ensureDefaults.js && cd apps/api && npx pm2-runtime ecosystem.config.cjs"]
