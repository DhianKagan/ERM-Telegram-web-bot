<!-- Назначение файла: краткое описание возможностей проекта. Основные модули: api, web. -->

# Task Manager Bot + Web App

Telegram‑бот и веб‑клиент для учёта задач, работающий как в Telegram Mini App, так и в обычном браузере. Сервер расположен в `apps/api`, клиент — в `apps/web`.

## Возможности

- Создание и редактирование задач.
- Прикрепление файлов с миниатюрами и метаданными.
- Drag-and-drop загрузка нескольких файлов с chunk-upload.
- Антивирусная проверка и журналирование загрузок и скачиваний, лимиты вложений по пользователю.
- Фильтрация задач по значениям через чекбоксы и поиск.
- Админ‑панель с разделом «Файлы».
- Администратор наследует права менеджера (`ACCESS_ADMIN | ACCESS_MANAGER = 6`).
- Управление департаментами, отделами, должностями, сотрудниками и автопарком на странице «Настройки» с поиском и пагинацией.
- Таблицы на React Table: скрытие и перестановка колонок, экспорт CSV/XLSX/PDF, серверная пагинация.
- Поиск элементов коллекций с фильтрами и пагинацией.
- Безопасность: JWT хранится в cookie, контекст аутентификации содержит только профиль.
- Неавторизованные пользователи автоматически перенаправляются на страницу входа.

## Быстрый старт

```bash
pnpm install
./scripts/create_env_from_exports.sh
./scripts/setup_and_test.sh
pnpm run dev # запуск api и web без таймаута PNPM
./scripts/start_api_with_memdb.sh # только api с MongoDB в памяти
```

## Локальный запуск API с MongoDB в памяти

```bash
./scripts/start_api_with_memdb.sh
```

Скрипт поднимает MongoDB в памяти через MongoMemoryServer и устанавливает переменную `MONGO_DATABASE_URL`, после чего запускает API.

Сгенерированные значения запишите в `.env` и не коммитьте этот файл.

## Сборка и проверки

```bash
pnpm build       # сборка проекта
pnpm size        # контроль размера бандла
pnpm a11y        # проверка контрастности
pnpm approve-builds  # контроль скриптов зависимостей
./scripts/pre_pr_check.sh  # проверка сборки и запуска перед PR
./scripts/install_bot_deps.sh  # установка зависимостей; при сбоях скачивает pnpm из GitHub
```

Команда `pnpm size` ищет файлы `index-*.js` в `apps/api/public/js`.

Статусы Lighthouse CI добавляет установленный GitHub App, его токен хранится в секрете `LHCI_GITHUB_APP_TOKEN`, отчёты публикуются во временном публичном хранилище.

## Миграции

Скрипты для обновления базы находятся в `scripts/db`. Для добавления роли
менеджера в существующую базу выполните:

```bash
pnpm ts-node scripts/db/addManagerRole.ts
```

Для синхронизации ролей пользователей выполните:

```bash
pnpm ts-node scripts/db/syncUserRoles.ts
```

## Hero-изображения

Скрипт `scripts/generate_hero_images.mjs` создаёт изображения `apps/web/public/hero/index.png`
и `routes.png` для meta‑тегов. Скрипт запускается автоматически перед `pnpm build`.

Файл `.npmrc` перенаправляет scope `@jsr` на `https://registry.npmjs.org/`,
чтобы установка зависимостей не требовала токена.

Dockerfile копирует каталог `patches` перед установкой зависимостей для применения патчей.

Подробные инструкции см. в [docs/technical_manual.md](docs/technical_manual.md).
Описание масок доступа и ролей: [docs/permissions.md](docs/permissions.md).
FAQ для саппорта: [docs/support_faq.md](docs/support_faq.md).
Архив устаревших материалов: [docs/archive](docs/archive).
