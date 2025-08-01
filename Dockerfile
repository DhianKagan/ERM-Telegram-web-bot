# Назначение файла: контейнер телеграм-бота с мини-приложением
# Модули: bot, запуск через pm2
FROM node:20 AS build
WORKDIR /app/bot

# Установка зависимостей
COPY bot/package*.json ./
COPY bot/web/package*.json ./web/
RUN npm ci && npm --prefix web ci

# Копирование исходников, сборка сервера и клиента
COPY bot/ ./
RUN npm run build && npm run build-client && npm prune --omit=dev

FROM node:20-slim
WORKDIR /app/bot
ENV NODE_ENV=production
COPY --from=build /app/bot .
EXPOSE 3000
CMD ["npx", "pm2-runtime", "ecosystem.config.cjs"]
