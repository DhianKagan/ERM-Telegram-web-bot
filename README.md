# Telegram Task Manager Bot + AdminJS

Каталог `bot` содержит код бота, `admin` — интерфейс AdminJS.

## Быстрый старт

### Требования
- Docker и Docker Compose
- Учетная запись Google Cloud
- MongoDB Atlas для хранения данных

### Локальный запуск
1. Клонируйте репозитории исходных проектов в соответствующие каталоги:
   ```bash
   git clone https://github.com/a-kashif-ahmed/Telegram-Task-Manager-Bot.git bot
   git clone https://github.com/SoftwareBrothers/adminjs-example-app.git admin
   ```
2. Создайте файл `.env` в корне с переменными окружения:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   JWT_SECRET=secret_key
   MONGODB_URI=mongodb_connection_string
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=strong_password
   ```
3. Запустите контейнеры:
   ```bash
   docker-compose up --build
   ```
   Бот будет работать в Telegram, а интерфейс AdminJS откроется на `http://localhost:3000/admin`.

### Развертывание на Google Cloud Run
1. Авторизуйтесь в Google Cloud:
   ```bash
   gcloud auth login
   gcloud config set project <PROJECT_ID>
   gcloud config set run/region <REGION>
   ```
2. Разверните сервисы:
   ```bash
   gcloud run deploy bot-service \
     --source ./bot \
     --set-env-vars TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN,JWT_SECRET=$JWT_SECRET,MONGODB_URI=$MONGODB_URI \
     --allow-unauthenticated

   gcloud run deploy admin-service \
     --source ./admin \
     --set-env-vars ADMIN_EMAIL=$ADMIN_EMAIL,ADMIN_PASSWORD=$ADMIN_PASSWORD,MONGODB_URI=$MONGODB_URI \
     --allow-unauthenticated
   ```

## Структура проекта
```
project-root/
├── bot/                # исходный код Telegram-бота
├── admin/              # приложение AdminJS
├── .env                # переменные окружения
├── Dockerfile          # сборка контейнера
├── docker-compose.yml  # локальное развертывание
└── README.md           # документация
```

## Лицензия
Проект распространяется под лицензией MIT.
