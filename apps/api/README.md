<!-- Назначение файла: актуальное описание API-приложения и runtime Telegram-бота. -->

# apps/api

`apps/api` — серверное приложение монорепозитория.

Содержит:

- REST API;
- аутентификацию и RBAC;
- runtime Telegram-бота (`src/bot/runtime.ts`);
- интеграции с MongoDB/Redis и файловым хранилищем.

## Локальный запуск

Из корня репозитория:

```bash
pnpm --filter apps/api dev
```

Для production-сборки:

```bash
pnpm --filter apps/api build
pnpm railway:start:api
```

## Переменные окружения

Базовые переменные берутся из корневого `.env` (см. `.env.example`).

Критичные блоки:

- MongoDB (`MONGO_*`, `MONGODB_*`)
- JWT/авторизация
- Redis/BullMQ (`QUEUE_*`)
- Telegram (`BOT_TOKEN`, связанные настройки)

## Связанные документы

- Общий проект: [`../../README.md`](../../README.md)
- Техмануал: [`../../docs/technical_manual.md`](../../docs/technical_manual.md)
- Права и роли: [`../../docs/permissions.md`](../../docs/permissions.md)
- Railway: [`../../docs/railway_full_setup.md`](../../docs/railway_full_setup.md)
