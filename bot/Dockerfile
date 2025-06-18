
# Назначение файла: сборка и запуск контейнера телеграм-бота.
# Используются Node.js и npm для установки зависимостей.
FROM node:14


WORKDIR /app


COPY package*.json ./


RUN npm install


COPY . .


EXPOSE 3000


CMD ["node", "src/bot/bot.js"]
