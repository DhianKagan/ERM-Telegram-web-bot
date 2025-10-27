<!-- Назначение файла: краткое описание возможностей проекта. Основные модули: api, web. -->

# Task Manager Bot + Web App

«О проекте»:

Проект представляет собой модульную систему для управления задачами и маршрутами с интеграцией Telegram. Серверная часть построена на Express‑API (папка apps/api) и содержит Telegram‑бот на основе Telegraf, REST‑маршруты для работы с задачами, пользователями и ролями, а также сервисы для взаимодействия с Telegram API и базой MongoDB
Клиент — это мини‑приложение на React в папке apps/web
Архитектура разделена на модули: AuthModule выполняет авторизацию через Telegram и выдаёт JWT/CSRF‑токен, TasksModule реализует CRUD задач и вычисление маршрутов, UsersModule, RolesModule и LogsModule отвечают за управление пользователями, ролями и журналирование действий соответственно
Проект переведен на TypeScript и использует DI‑контейнер tsyringe, DTO‑валидацию и декораторы RBAC; цель — перейти от монолитного JavaScript к модульной архитектуре


## Возможности

- Создание и редактирование задач.
- Прикрепление файлов с миниатюрами и метаданными.
- Drag-and-drop загрузка нескольких файлов с chunk-upload.
- Антивирусная проверка и журналирование загрузок и скачиваний, лимиты вложений по пользователю.
- Фильтрация задач по значениям через чекбоксы и поиск.
- Админ‑панель с разделом «Файлы».
- Раздел «Архив» показывает удалённые задачи в режиме только чтение (маска 6), а администратор с маской 8 может запустить полное удаление.
- Администратор наследует права менеджера (`ACCESS_ADMIN | ACCESS_MANAGER = 6`),
  удаление задач доступно только при маске `ACCESS_TASK_DELETE = 8`, которую
  выставляют вручную.
- Управление департаментами, отделами, должностями, сотрудниками и автопарком на странице «Настройки» с поиском и пагинацией.
- `/api/v1/collections` объединяет новые элементы `CollectionItem` и записи устаревших коллекций Department/Employee; такие элементы отображаются только для чтения.
- Таблицы на React Table: скрытие и перестановка колонок, экспорт CSV/XLSX/PDF, серверная пагинация.
- Поиск элементов коллекций с фильтрами и пагинацией.
- Аналитическая панель по маршрутным планам (`/mg/analytics`, `/cp/analytics`) с фильтрами периода/статуса и графиками пробега, загрузки и SLA.
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

## Прототип маршрутизации OR-Tools

- Включите флаг `VRP_ORTOOLS_ENABLED=1` в `.env`, чтобы активировать экспериментальный вызов Python-решателя.
- Убедитесь, что в окружении доступен `python3` и установлен пакет `ortools`. Без него скрипт вернёт маршрут по порядку с предупреждением.
- Для запуска примера выполните `pnpm ts-node apps/api/src/services/vrp/runSample.ts`. На выходе будет JSON с результатом и предупреждениями.
- Подробности и сравнение подходов описаны в `docs/routing_research.md` и разделе «Экспериментальный адаптер OR-Tools» технического руководства.

## Локальный запуск API с MongoDB в памяти

```bash
./scripts/start_api_with_memdb.sh
```

Скрипт поднимает MongoDB в памяти через MongoMemoryServer и устанавливает переменную `MONGO_DATABASE_URL`, после чего запускает API.

Сгенерированные значения запишите в `.env` и не коммитьте этот файл.

## Антивирусная проверка файлов

- По умолчанию активирован сигнатурный сканер (`ANTIVIRUS_VENDOR=signature`). Он не требует внешних служб, использует
  встроенную сигнатуру EICAR и позволяет расширить список через `ANTIVIRUS_SIGNATURES`.
- Максимальный размер файла для проверки задаётся переменной `ANTIVIRUS_SIGNATURE_MAX_SIZE` (значение в байтах).
- Для интеграции с ClamAV укажите `ANTIVIRUS_VENDOR=clamav` и запустите демон, например через Docker:

```bash
docker run --rm -p 3310:3310 clamav/clamav:latest
```

  Затем настройте `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT` и `CLAMAV_CHUNK_SIZE` при необходимости.
- Все события о состоянии сканера фиксируются в `wgLogEngine`.

## Сборка и проверки

```bash
pnpm build       # сборка проекта и компиляция ensureDefaults
pnpm size        # контроль размера бандла
pnpm a11y        # проверка контрастности
pnpm approve-builds  # контроль скриптов зависимостей
./scripts/pre_pr_check.sh  # проверка сборки и запуска перед PR
./scripts/install_bot_deps.sh  # установка зависимостей; при сбоях скачивает pnpm из GitHub
pnpm pretest:e2e  # установка Firefox и Chromium, диагностика playwright doctor/--list и сборка перед e2e
```

Команда `pnpm size` ищет файлы `index-*.js` в `apps/api/public/js`.

Статусы Lighthouse CI добавляет установленный GitHub App, его токен хранится в секрете `LHCI_GITHUB_APP_TOKEN`, отчёты публикуются во временном публичном хранилище.

## Ветвление и CI

- Основная ветка — `main`. История поддерживается линейной: приливочные ветки мержатся через rebase/squash без веток `staging` и `production`.

- Любой pull request (включая ветки, временно нацеленные не на `main`) автоматически запускает workflows `CI`, `Lighthouse`, `Docker` и CodeQL‑проверку.

- Push в `main` дополнительно активирует workflow `Release`, который собирает проект и деплоит его на Railway через `pnpm dlx @railway/cli up`.
- Для ручного релиза по тегу сохранена поддержка схемы `v*.*.*`; тег запускает тот же pipeline деплоя.

## Секреты CI/CD и переменные окружения Railway

- В настройках GitHub Actions добавьте секреты `RAILWAY_TOKEN` (токен доступа Railway для `release.yml`) и `LHCI_GITHUB_APP_TOKEN` (токен установленного Lighthouse CI App).
- На Railway задайте обязательные переменные `BOT_TOKEN`, `CHAT_ID`, `JWT_SECRET`, `SESSION_SECRET`, `APP_URL`, `MONGO_DATABASE_URL`, `ROUTING_URL`, `VITE_ROUTING_URL`, `NODE_ENV=production`, а также дополнительные токены (например, `LHCI_GITHUB_APP_TOKEN`) при необходимости отчётности.
- Файл `railway.json` фиксирует использование Nixpacks (`nixpacks.toml`) и запуск через `pm2`. При автосборке Railway выполнит `pnpm build`, после чего `Procfile` или CLI из `release.yml` развернёт свежую версию.

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
и `logistics.png` для meta‑тегов. Скрипт запускается автоматически перед `pnpm build`.

Файл `.npmrc` перенаправляет scope `@jsr` на `https://registry.npmjs.org/`,
чтобы установка зависимостей не требовала токена.

Dockerfile копирует каталог `patches` перед установкой зависимостей для применения патчей.
Файл `nixpacks.toml` настраивает сборку на Railway через Nixpacks и выполняет установку зависимостей без режима offline.

## Docker

```bash
docker build -t erm-bot .
docker run -e BOT_TOKEN=123 erm-bot
```

Токен бота передаётся контейнеру через переменную окружения `BOT_TOKEN`.

Подробные инструкции см. в [docs/technical_manual.md](docs/technical_manual.md).
Описание масок доступа и ролей: [docs/permissions.md](docs/permissions.md).
FAQ для саппорта: [docs/support_faq.md](docs/support_faq.md).
Архив устаревших материалов: [docs/archive](docs/archive).
