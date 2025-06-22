# Назначение файла: контейнер телеграм-бота с мини-приложением
# Модули: bot, запускается npm-скриптом с concurrently
FROM node:20 AS build
WORKDIR /app

# Установка зависимостей и сборка клиента
COPY bot/package*.json ./bot/
COPY bot/web/package*.json ./bot/web/
RUN cd bot && npm ci && npm --prefix web ci && cd ..
COPY bot ./bot
RUN cd bot && npm run build-client && npm prune --omit=dev && cd ..

FROM node:20-slim
WORKDIR /app
COPY --from=build /app/bot ./bot
EXPOSE 3000
CMD ["npm", "--prefix", "bot", "start"]
