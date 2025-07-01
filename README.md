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

Файл `.env.example` содержит все переменные окружения и служит шаблоном. Локальный `.env` не хранится в репозитории. `APP_URL` должен быть HTTPS, а `MONGO_DATABASE_URL` начинаться с `mongodb://` или `mongodb+srv://`. В примере указан стандартный порт Railway `43551`.

## Тесты

Перед коммитом проверяйте проект:
```bash
npm test --prefix bot
npx eslint bot/src
npm run lint --prefix bot/web
```

## CI/CD и GitHub Actions

При использовании GitHub Actions необходим отдельный хост MongoDB. Вы можете
предоставить свой облачный кластер или запустить деплой через Railway CLI
командой `railway up`, что создаст доступную базу перед тестами.

## Дополнительные материалы

Подробные инструкции по настройке бота смотрите в `docs/telegram_bot_manual.md`.
Изменения по версиям описаны в `CHANGELOG.md`, планы развития — в `ROADMAP.md`.
