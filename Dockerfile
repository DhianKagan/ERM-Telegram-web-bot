# Базовый образ
FROM node:18-alpine

# Рабочая директория
WORKDIR /app

# Копирование файлов
COPY . .

# Установка зависимостей
RUN npm install --production

# Запуск приложения
CMD ["npm", "start"]
