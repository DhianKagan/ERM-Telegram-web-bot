# Telegram Task Manager Bot + AdminJS

Файл описывает проект и способы его развертывания.

Каталог `bot` содержит код бота, `admin` — интерфейс AdminJS.

Дополнительная информация о плане разработки представлена в файле `ROADMAP.md`, а история изменений ведется в `CHANGELOG.md`.

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
2. Скопируйте `.env.example` в `.env` и при необходимости измените значения.
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

### Развертывание на DigitalOcean App Platform
1. Соберите образы и загрузите их в DigitalOcean Container Registry:
   ```bash
   doctl registry login
   docker build -t registry.digitalocean.com/<REGISTRY_NAME>/bot ./bot
   docker build -t registry.digitalocean.com/<REGISTRY_NAME>/admin ./admin
   docker push registry.digitalocean.com/<REGISTRY_NAME>/bot
   docker push registry.digitalocean.com/<REGISTRY_NAME>/admin
   ```
2. Создайте приложение с двумя сервисами: бот в роли Worker и панель как Web Service.
3. В настройках обоих сервисов укажите переменные окружения:
   `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `MONGODB_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
4. Подробности описаны в [официальном руководстве DigitalOcean](https://docs.digitalocean.com/products/app-platform/).


### Развертывание на Back4App
1. Зарегистрируйтесь на [Back4App](https://www.back4app.com/) и создайте новое приложение в разделе *Containers*.
2. Подключите этот репозиторий через GitHub или укажите Docker-образы для сервисов `bot` и `admin`.
3. В параметрах контейнеров задайте переменные окружения: `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `MONGODB_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
4. Запустите деплой и дождитесь статуса *Running* для обоих контейнеров.

## Структура проекта
```
project-root/
├── ROADMAP.md          # план разработки
├── CHANGELOG.md        # история версий
├── bot/                # исходный код Telegram-бота
├── admin/              # приложение AdminJS
├── .env.example        # пример переменных
├── .env                # переменные окружения
├── Dockerfile          # сборка контейнера
├── docker-compose.yml  # локальное развертывание
└── README.md           # документация
```

## Лицензия
Проект распространяется под лицензией MIT.
