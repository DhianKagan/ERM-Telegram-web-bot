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
   Скрипт поддерживает специальные символы в значениях переменных.
3. Установите зависимости:
   ```bash
   npm ci --prefix bot || npm --prefix bot install
   ```
4. Запустите Docker Compose:
   ```bash
   docker compose up -d
   ```
   Этот запуск поднимет и локальный MongoDB на порту 27017 с логином `admin` и паролем `admin`.
    Сервис БД содержит `healthcheck`, который выполняет `mongosh -u admin -p admin --authenticationDatabase admin --eval 'db.adminCommand("ping")'`, поэтому бот начнёт работу только после готовности MongoDB.

5. При желании запустите локальный сервер telegram-bot-api и пропишите его адрес:
   ```bash
   docker run -p 8081:8081 ghcr.io/telegram-bot-api/server:latest
   ```
   В файле `.env` задайте `BOT_API_URL=http://localhost:8081`. Без этой переменной
   бот использует официальный API Telegram.

6. После завершения работы остановите контейнеры и очистите ресурсы:
   ```bash
   docker compose down
   ```
   Команда останавливает сервисы и удаляет созданные сети и тома.

Переменная `BOT_API_URL` задаёт адрес для взаимодействия бота с API.
Указав URL локального сервера telegram-bot-api, вы сократите задержку
и избежите ограничений официального хоста.

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
`scripts/setup_and_test.sh`. В workflow `docker.yml` дополнительно поднимается
локальный контейнер MongoDB, чтобы скрипт `check_mongo.cjs` смог проверить
соединение. Убедитесь, что секрет `MONGO_DATABASE_URL` указывает на доступную
базу или заранее выполните `railway up`.

## Подготовка TDWeb перед сборкой клиента

TDWeb нужна для страницы мини‑приложения `/chats`. Скрипт устанавливает пакет и
копирует файлы WebAssembly:

```bash
./scripts/setup_tdweb.sh
```

После этого запустите сборку клиента:

```bash
npm --prefix bot run build-client
```

### Создание администратора

Для выдачи прав администратора по Telegram ID выполните:

```bash
node scripts/create_admin_user.js <id> [username]
```

Скрипт создаст пользователя с ролью `admin` либо обновит существующего.

## Дополнительные материалы

Подробные инструкции по настройке бота смотрите в `docs/telegram_bot_manual.md`.
Изменения по версиям описаны в `CHANGELOG.md`, планы развития — в `ROADMAP.md`.
Для локальной отладки задайте `BOT_API_URL` в `.env` и запустите контейнер telegram-bot-api, как показано в разделе «Быстрый старт».
