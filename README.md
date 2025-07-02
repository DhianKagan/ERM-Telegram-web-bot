<!-- Назначение файла: краткая документация по проекту. -->

# Telegram Task Manager Bot + Mini App

Проект объединяет Telegram‑бота и веб‑интерфейс для управления задачами. Код расположен в каталоге `bot`.

## Возможности

- Создание и управление задачами через чат или мини‑приложение
- Аутентификация через Telegram Login
- REST API с документацией на `/api-docs`
- Уведомления и напоминания по расписанию

## Быстрый старт

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/AgroxOD/agrmcs.git
   ```
2. Сформируйте локальный `.env` из `.env.example`:
   ```bash
   ./scripts/create_env_from_exports.sh
   ```
3. Установите зависимости:
   ```bash
   npm ci --prefix bot || npm --prefix bot install
   ```
4. Запустите Docker Compose:
   ```bash
   docker compose up -d
   ```
   Этот запуск поднимет и локальный MongoDB на порту 27017 с логином `admin` и паролем `admin`.

5. При желании запустите локальный сервер telegram-bot-api и пропишите его адрес:
   ```bash
   docker run -p 8081:8081 ghcr.io/telegram-bot-api/server:latest
   ```
   В файле `.env` задайте `BOT_API_URL=http://localhost:8081`. Без этой переменной
   бот использует официальный API Telegram.


Файл `.env.example` содержит все переменные окружения и служит шаблоном. Локальный `.env` не хранится в репозитории. `APP_URL` должен быть HTTPS, а `MONGO_DATABASE_URL` начинаться с `mongodb://` или `mongodb+srv://`. В примере указан адрес локальной базы `mongodb://admin:admin@localhost:27017/agrmcs?authSource=admin`. Для Railway подставьте собственный URL с реальными учётными данными.


### Проверка соединения с MongoDB

Перед запуском сервера убедитесь, что переменная `MONGO_DATABASE_URL` указывает на доступный хост. Для диагностики выполните отдельный скрипт:

```bash
npm --prefix bot run check:mongo
```

Если выводит ошибку `ENETUNREACH` или `connection closed`, проверьте правильность адреса и откройте порт на стороне провайдера.

## Тесты

Перед коммитом достаточно запустить скрипт:
```bash
./scripts/setup_and_test.sh
```
Он установит зависимости, при необходимости создаст `.env` и выполнит те же
команды `npm test`, `eslint` и `docker compose config`.

## CI/CD и GitHub Actions

Автоматические тесты на GitHub запускают этот же скрипт
`scripts/setup_and_test.sh`. Проверьте, что секрет `MONGO_DATABASE_URL`
указывает на доступную базу либо запустите `railway up` перед выполнением
workflow.


## Дополнительные материалы

Подробные инструкции по настройке бота смотрите в `docs/telegram_bot_manual.md`.
Изменения по версиям описаны в `CHANGELOG.md`, планы развития — в `ROADMAP.md`.
Для локальной отладки можно указать `BOT_API_URL` и запустить контейнер telegram-bot-api,
как показано в разделе «Быстрый старт».
