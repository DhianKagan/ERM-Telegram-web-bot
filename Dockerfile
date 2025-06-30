# Назначение файла: контейнер телеграм-бота с мини-приложением
# Модули: bot, запускается npm-скриптом с concurrently
FROM node:20 AS build
WORKDIR /app/bot

# Установка зависимостей
COPY bot/package*.json ./
COPY bot/web/package*.json ./web/
RUN npm ci && npm --prefix web ci

# Копирование исходников и сборка клиента
COPY bot .
RUN npm run build-client && npm prune --omit=dev

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/bot ./bot
EXPOSE 3000
CMD ["npm", "--prefix", "bot", "start"]
