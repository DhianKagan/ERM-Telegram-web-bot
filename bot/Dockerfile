# Назначение файла: сборка и запуск контейнера телеграм-бота.
# Используются Node.js и npm для установки зависимостей.
FROM node:18
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm install && npm --prefix client install

COPY . .
RUN npm --prefix client run build
EXPOSE 3000
CMD ["npm", "start"]
