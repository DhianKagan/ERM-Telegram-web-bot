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
3. Установите зависимости и соберите клиент:
   ```bash
   npm ci --prefix bot || npm --prefix bot install
   ```
4. Запустите Docker Compose:
   ```bash
   docker compose up -d
   ```
   Контейнер `mongo_db` поднимет локальную MongoDB на порту `27017`. В `.env`
   замените `MONGO_DATABASE_URL` на `mongodb://mongo:password@localhost:27017`
   для разработки и тестов.

Файл `.env.example` содержит все переменные окружения и служит шаблоном. Локальный `.env` не хранится в репозитории. `APP_URL` должен быть HTTPS, а `MONGO_DATABASE_URL` начинаться с `mongodb://` или `mongodb+srv://`. В примере указан стандартный порт Railway `43551`.

### Проверка соединения с MongoDB

Перед запуском сервера убедитесь, что переменная `MONGO_DATABASE_URL` указывает на доступный хост. Для диагностики выполните скрипт:

```bash
node scripts/check_mongo.cjs
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
указывает на доступную базу. Для локального CI можно запустить `docker compose
up -d mongo_db` и заменить адрес базы на `localhost`. Для деплоя в Railway
используйте отдельную базу или команду `railway up` перед workflow.


## Дополнительные материалы

Подробные инструкции по настройке бота смотрите в `docs/telegram_bot_manual.md`.
Изменения по версиям описаны в `CHANGELOG.md`, планы развития — в `ROADMAP.md`.
