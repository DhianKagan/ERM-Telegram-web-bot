# Назначение файла: контейнер телеграм-бота с мини-приложением
# Модули: bot, запуск через pm2
FROM node:20 AS build
WORKDIR /app/bot

# Установка зависимостей
COPY bot/package.json bot/pnpm-lock.yaml ./
COPY bot/web/package.json bot/web/pnpm-lock.yaml ./web/
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --dir web install --frozen-lockfile

# Копирование исходников, сборка сервера и клиента
COPY bot/ ./
COPY tsconfig.json ../
RUN pnpm run build && pnpm run build-client && pnpm prune --prod

FROM node:20-slim
WORKDIR /app/bot
ENV NODE_ENV=production
COPY --from=build /app/bot .
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["npx", "pm2-runtime", "ecosystem.config.cjs"]
