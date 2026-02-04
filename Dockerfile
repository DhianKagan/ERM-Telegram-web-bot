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
  && (pnpm install --prod --offline --frozen-lockfile --force || pnpm install --prod --force --no-frozen-lockfile) \
  && pnpm store prune

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/public /app/apps/api/public
COPY --from=build /app/apps/api/ecosystem.config.cjs /app/apps/api/ecosystem.config.cjs
COPY --from=build /app/apps/api/package.json /app/apps/api/package.json
COPY --from=build /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/apps/worker/dist /app/apps/worker/dist
COPY --from=build /app/apps/worker/package.json /app/apps/worker/package.json
COPY --from=build /app/apps/worker/node_modules /app/apps/worker/node_modules
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=build /app/dist/scripts/db /app/dist/scripts/db
COPY --from=build /app/package.json /app/package.json
# Ensure root workspace node_modules (hoisted by pnpm) are available in final image.
# pnpm workspaces install places many packages in root node_modules; pm2 and other shared
# deps can be hoisted there. Copy it so binaries like pm2-runtime are present.
COPY --from=build /app/node_modules /app/node_modules
RUN mkdir -p /var/log/pm2
EXPOSE 3000
CMD ["sh", "-c", "node dist/scripts/db/ensureDefaults.js && mkdir -p /var/log/pm2 && cd apps/api && ./node_modules/.bin/pm2 install pm2-logrotate && ./node_modules/.bin/pm2 set pm2-logrotate:max_size 10M && ./node_modules/.bin/pm2 set pm2-logrotate:retain 7 && ./node_modules/.bin/pm2 set pm2-logrotate:compress true && ./node_modules/.bin/pm2-runtime ecosystem.config.cjs"]
