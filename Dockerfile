# Назначение файла: контейнер телеграм-бота с мини-приложением
# Модули: api, запуск через pm2
FROM node:20 AS build
WORKDIR /app

# Установка зависимостей
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN corepack enable && (pnpm install --frozen-lockfile || pnpm install)

# Копирование исходников, сборка сервера и клиента
COPY . .
RUN pnpm -r build && pnpm --dir apps/api run build-client && pnpm prune --prod

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app .
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["npx", "pm2-runtime", "ecosystem.config.cjs"]
