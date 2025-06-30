# Назначение файла: сборка и запуск контейнера телеграм-бота.
# Используются Node.js и npm; запускается скрипт с concurrently.
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
COPY web/package*.json ./web/
RUN npm ci && npm --prefix web ci

COPY . .
RUN npm --prefix web run build && npm prune --omit=dev

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app .
EXPOSE 3000
CMD ["npm", "start"]
