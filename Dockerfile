# Назначение файла: контейнер телеграм-бота с мини-приложением
# Модули: bot
FROM node:18
WORKDIR /app

# Установка зависимостей
COPY bot/package*.json ./bot/
RUN cd bot && npm install && cd ..

# Копирование исходников
COPY bot ./bot

EXPOSE 3000
CMD ["npm", "--prefix", "bot", "start"]
