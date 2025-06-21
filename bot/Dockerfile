# Назначение файла: сборка и запуск контейнера телеграм-бота.
# Используются Node.js и npm для установки зависимостей.
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci && npm --prefix client ci

COPY . .
RUN npm --prefix client run build && npm prune --omit=dev

FROM node:20-slim
WORKDIR /app
COPY --from=build /app .
EXPOSE 3000
CMD ["npm", "start"]
