# Назначение файла: контейнер телеграм-бота с мини-приложением
# Модули: bot
FROM node:20
WORKDIR /app

# Установка зависимостей
COPY bot/package*.json ./bot/
COPY bot/client/package*.json ./bot/client/
RUN cd bot && npm install && npm --prefix client install && cd ..

# Копирование исходников
COPY bot ./bot

RUN cd bot && npm --prefix client run build && cd ..

EXPOSE 3000
CMD ["npm", "--prefix", "bot", "start"]
