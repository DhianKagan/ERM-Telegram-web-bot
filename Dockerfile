# Назначение файла: контейнер телеграм-бота с мини-приложением
# Модули: api, запуск через pm2
FROM node:20 AS build
WORKDIR /app/apps/api

# Установка зависимостей
COPY apps/api/package.json apps/api/pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/pnpm-lock.yaml ./web/
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --dir web install --frozen-lockfile

# Копирование исходников, сборка сервера и клиента
COPY apps/api/ ./
COPY tsconfig.json ../../
RUN pnpm run build && pnpm run build-client && pnpm prune --prod

FROM node:20-slim
WORKDIR /app/apps/api
ENV NODE_ENV=production
COPY --from=build /app/apps/api .
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["npx", "pm2-runtime", "ecosystem.config.cjs"]
