<!-- Назначение файла: краткое описание возможностей проекта. Основные модули: api, web. -->

# Task Manager Bot + Web App ![Quality checks](https://img.shields.io/badge/Codex-Quality%20Gate-blue)

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

## Проверки качества

- Автоматическая конфигурация Codex хранится в `codex/config.yml` и запускается workflow `Codex Quality Gate` в GitHub Actions.
- Локально используйте `pnpm codex:check`, команда включает `pnpm format:check`, `pnpm lint`, `pnpm lint:security`, `pnpm typecheck` и `pnpm audit`.
- Любое нарушение форматирования, правил безопасности (JWT, CSRF, маски ролей) или уязвимость уровня High/ Critical в зависимостях приводит к падению проверки и блокирует слияние pull request.
- Для код-ревью используйте памятку [`CODE_REVIEW_GUIDE.md`](CODE_REVIEW_GUIDE.md), чтобы не пропустить требования и инварианты.

## Прототип маршрутизации OR-Tools

- Включите флаг `VRP_ORTOOLS_ENABLED=1` в `.env`, чтобы активировать экспериментальный вызов Python-решателя.
- Убедитесь, что в окружении доступен `python3` и установлен пакет `ortools`. Без него скрипт вернёт маршрут по порядку с предупреждением.
- Для запуска примера выполните `pnpm ts-node apps/api/src/services/vrp/runSample.ts`. На выходе будет JSON с результатом и предупреждениями.
- Подробности и сравнение подходов описаны в `docs/routing_research.md` и разделе «Экспериментальный адаптер OR-Tools» технического руководства.
- Для расчёта матриц через GraphHopper задайте `GRAPHHOPPER_MATRIX_URL` (только HTTPS), при необходимости `GRAPHHOPPER_API_KEY` и профиль `GRAPHHOPPER_PROFILE`; если переменные не заданы, адаптер использует Haversine.

## Локальный запуск API с MongoDB в памяти

```bash
./scripts/start_api_with_memdb.sh
```

Скрипт поднимает MongoDB в памяти через MongoMemoryServer и устанавливает переменную `MONGO_DATABASE_URL`, после чего запускает API.

Сгенерированные значения запишите в `.env` и не коммитьте этот файл.

## Настройки cookie

- Переменная `COOKIE_SECURE` по умолчанию считается равной `true` и включает передачу cookie только по HTTPS с атрибутами `Secure` и `SameSite=None`.
- Значение `COOKIE_SECURE=false` предназначено для локальной отладки на HTTP: флаг `Secure` отключается, а атрибут `SameSite` переключается в режим `Lax`, чтобы браузеры принимали cookie без HTTPS.
- При работе через обратный прокси и HTTPS оставляйте значение по умолчанию, чтобы сохранялись защищённые cookie и корректный обмен CSRF‑токенами.

## Антивирусная проверка файлов

- По умолчанию активирован сигнатурный сканер (`ANTIVIRUS_VENDOR=signature`). Он не требует внешних служб, использует
  встроенную сигнатуру EICAR и позволяет расширить список через `ANTIVIRUS_SIGNATURES`.
- Максимальный размер файла для проверки задаётся переменной `ANTIVIRUS_SIGNATURE_MAX_SIZE` (значение в байтах).
- Для интеграции с ClamAV укажите `ANTIVIRUS_VENDOR=clamav` и запустите демон, например через Docker:

```bash
docker run --rm -p 3310:3310 clamav/clamav:latest
```

- Затем настройте `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT` и `CLAMAV_CHUNK_SIZE` при необходимости.

- Все события о состоянии сканера фиксируются в `wgLogEngine`.

## Сборка и проверки

```bash
pnpm build       # сборка проекта и компиляция ensureDefaults
pnpm size        # контроль размера бандла
pnpm a11y        # проверка контрастности
pnpm approve-builds  # контроль скриптов зависимостей
pnpm security:scan   # статический анализ кода на уязвимости
./scripts/pre_pr_check.sh  # проверка сборки и запуска перед PR
./scripts/install_bot_deps.sh  # установка зависимостей; при сбоях скачивает pnpm из GitHub
pnpm pretest:e2e  # установка Firefox и Chromium, диагностика playwright doctor/--list и сборка перед e2e
```

Команда `pnpm size` проверяет файлы `apps/web/dist/*.js` (лимит 200 KB); перед запуском соберите фронтенд командой `pnpm --filter web run build:dist`.

Внутренние проверки Lighthouse CI (секрет `LHCI_GITHUB_APP_TOKEN` доступен) запускают `npx lhci autorun` и публикуют статусы через GitHub App. Для внешних вкладов из форков, где секрет недоступен, workflow выполняет `npx lhci collect && npx lhci assert` с `LHCI_UPLOAD__TARGET=filesystem`, отчёт сохраняется локально на раннере и проверка завершается успешно без публикации статусов.

## GitHub Actions и секреты

- Workflow `Docker` автоматически создаёт `.env` в CI и подставляет безопасные значения по умолчанию, если секреты не заданы в публичных ветках.
- Подстановки используют маркеры `__DUMMY_BOT_TOKEN__`, `000000000`, `__DUMMY_JWT_SECRET__` и сервисный MongoDB `mongodb://admin:admin@mongo:27017/ermdb?authSource=admin`.
- Для проверки приватных веток или staging окружений задайте реальные значения в `Repository secrets`.

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
Восстановление проверок Codex: [docs/codex_integration.md](docs/codex_integration.md).
