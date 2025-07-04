<!-- Назначение файла: краткая документация по проекту. -->

# Telegram Task Manager Bot + Mini App

Код бота и веб-интерфейса находится в каталоге `bot`.

## Возможности
- Управление задачами через чат и мини‑приложение
- REST API с описанием на `/api-docs`
- Напоминания и уведомления
- Команда `/whoami` показывает ID и статус
- Авторизация через одноразовый код
- Пагинация списка задач через параметры `page` и `limit`
- Поле `slug` формируется автоматически из названия задачи
- Улучшенная доступность и SEO: `robots.txt`, `aria-label` и meta description
- Универсальная модель заявок `UniversalTask`
- В неё добавлены поля c enum: `transport_type`, `payment_method`, `priority`,
  `status`

## Быстрый старт
1. Клонируйте репозиторий и создайте `.env` на основе `.env.example`:
   ```bash
   git clone https://github.com/AgroxOD/agrmcs.git
   ./scripts/create_env_from_exports.sh
   ```
2. Установите зависимости и запустите Docker Compose:
   ```bash
   npm ci --prefix bot
   docker compose up -d
   ```
3. При необходимости запустите локальный telegram-bot-api и укажите `BOT_API_URL` в `.env`.

Для проверки подключения к MongoDB выполните:
```bash
npm --prefix bot run check:mongo
```

## Тесты
```bash
./scripts/setup_and_test.sh
```
Скрипт выполняет Jest с флагом `--detectOpenHandles`, чтобы выявлять незавершённые асинхронные операции.

## CI/CD
GitHub Actions используют тот же скрипт; workflow `docker.yml` поднимает MongoDB для проверки.

## Создание администратора
```bash
NODE_PATH=./bot/node_modules node scripts/create_admin_user.js <id> [username]
```

## Дополнительные материалы
Подробности смотрите в каталоге `docs/`, историю изменений — в `CHANGELOG.md`, планы — в `ROADMAP.md`.
