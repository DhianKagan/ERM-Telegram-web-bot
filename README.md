<!-- Назначение файла: документация проекта и общие инструкции. -->
# Telegram Task Manager Bot + AdminJS

Файл описывает проект и способы его развертывания.

Каталог `bot` содержит код бота, `admin` — интерфейс AdminJS.

Дополнительная информация о плане разработки представлена в файле `ROADMAP.md`, а история изменений ведется в `CHANGELOG.md`.

## Быстрый старт

### Требования
- Docker и Docker Compose
- Учётная запись MongoDB Atlas

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

### Развёртывание на [Pella](https://www.pella.app)
1. Подключите репозиторий к сервису и выберите проект.
2. Для каждого контейнера задайте рабочую директорию `bot` или `admin`.
3. Укажите версию Node `18` и переменные окружения из `.env.example`.
4. Команда запуска бота:
   ```bash
   node src/bot/bot.js
   ```
   Для панели администратора:
   ```bash
   yarn start
   ```
5. Запустите сборку и дождитесь успешного деплоя.

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
