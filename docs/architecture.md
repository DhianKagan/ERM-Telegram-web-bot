<!-- Назначение файла: канонический обзор фактической архитектуры монорепозитория. -->

# Архитектура

## Назначение документа

`docs/architecture.md` — канонический обзор верхнеуровневой архитектуры монорепозитория. Документ описывает только те слои и связи, которые подтверждаются текущей структурой репозитория и реальными точками входа.

## 1. Монорепозиторий как источник истины

Проект организован как pnpm workspace + Turbo monorepo. Верхний уровень важен не меньше, чем отдельные `src/` внутри приложений: именно здесь задаются сборка, запуск и границы ответственности между сервисами.

### Канонические каталоги

- `apps/api` — HTTP API, Telegram-bot runtime, серверная бизнес-логика и интеграции с MongoDB/Redis/BullMQ.
- `apps/web` — отдельное React/Vite SPA-приложение для браузерного интерфейса и Telegram WebApp.
- `apps/worker` — отдельный BullMQ worker-процесс для фонового геокодирования и расчёта маршрутов.
- `packages/shared` — общий пакет типов, гео-утилит, map/link helper'ов и имён очередей.
- `scripts` — служебные сценарии для CI, миграций, локальной диагностики, bootstrap и эксплуатационных задач.

Историческая древовидная схема вида `src/common`, `decorators`, `modules/*` больше **не является каноническим описанием** текущей архитектуры. Реальная архитектура определяется каталогами monorepo выше и связями между ними.

## 2. Runtime-модель

### 2.1 API (`apps/api`)

`apps/api/src/server.ts` поднимает HTTP-сервер, собирает Express-приложение через `apps/api/src/api/server.ts`, подключает MongoDB, инициализирует graceful shutdown и закрывает очереди/метрики/кэши при остановке процесса. Основная регистрация HTTP-маршрутов выполняется в `apps/api/src/api/routes.ts`.

### 2.2 Web (`apps/web`)

`apps/web/src/main.tsx` выбирает режим запуска: обычный браузерный SPA или Telegram WebApp. `apps/web/src/App.tsx` и `apps/web/src/AuthenticatedApp.tsx` собирают клиентскую маршрутизацию, контексты авторизации/темы/сайдбара и ленивую загрузку страниц.

На практике `apps/web` — это отдельный frontend-источник, а не подпапка API. API затем обслуживает собранные статические файлы из `apps/api/public`, но исходники UI живут именно в `apps/web`.

### 2.3 Worker (`apps/worker`)

`apps/worker/src/index.ts` запускает отдельный процесс BullMQ с двумя рабочими очередями и DLQ:

- `logistics-geocoding`
- `logistics-routing`
- `logistics-dead-letter`

Worker не является «внутренним модулем API»: это отдельный runtime-процесс со своей конфигурацией, обработчиками ошибок, shutdown-логикой и подключением к Redis.

### 2.4 Shared (`packages/shared`)

`packages/shared` используется одновременно API, web и worker. Пакет экспортирует:

- общие типы домена (`src/types.ts`),
- работу с Google Maps/координатами (`src/mapUtils.ts`),
- имена очередей и job payload/result (`src/queues.ts`),
- geo helpers и константы через `src/index.ts`.

## 3. Верхнеуровневая схема взаимодействия

```text
apps/web  ->  apps/api  -> MongoDB
                |
                +-> Redis/BullMQ -> apps/worker
                |
                +-> packages/shared (типы, очереди, map utils)

apps/web -------> packages/shared
apps/worker ----> packages/shared
scripts --------> поддержка сборки, миграций и эксплуатации
```

## 4. Структура `apps/api`

`apps/api` остаётся самым крупным приложением репозитория, но его верхнеуровневая архитектура строится не вокруг гипотетических `modules/*`, а вокруг фактических зон ответственности.

### 4.1 Точки входа и инфраструктура API

- `src/server.ts` — старт процесса и graceful shutdown.
- `src/api/server.ts` — сборка Express-приложения.
- `src/api/routes.ts` — подключение middleware, static assets, CSRF/CORS и mount всех router'ов под `/api/v1`.
- `src/api/middleware.ts` — auth/request middleware для API-слоя.
- `src/api/swagger.ts` — генерация OpenAPI/Swagger.

### 4.2 Реально подключённые HTTP router'ы

`apps/api/src/api/routes.ts` монтирует следующие группы маршрутов под `/api/v1`:

- `users`
- `roles`
- `logs`
- `auth`
- `maps`
- `route` / `osrm`
- `optimizer`
- `route-plans`
- `logistics`
- `analytics`
- `routes`
- `tasks`
- `task-drafts`
- `task-templates`
- `storage`
- `files`
- `fleets`
- `tracking`
- `departments`
- `employees`
- `collections`
- `archives`
- `system`

Это и есть фактическая карта API, а не абстрактные «модули» из старой схемы.

### 4.3 Слой роутов

Каталог `apps/api/src/routes/*` содержит реальные Express-router'ы. Несколько характерных примеров:

- `routes/tasks.ts` — CRUD задач, bulk-операции, upload/chunk-upload, проверки доступа к задачам и файловым вложениям.
- `routes/authUser.ts` — вход, refresh, Telegram/TMA verification, профиль.
- `routes/users.ts` и `routes/roles.ts` — админские и manager/admin маршруты по пользователям и ролям.
- `routes/system.ts` — административные system endpoints, защищённые RBAC.
- `routes/files.ts`, `routes/storage.ts`, `routes/archives.ts` — файловый и эксплуатационный API.

## 5. Фактическая валидация входных данных

В проекте нет единого «магического DTO-слоя». Валидация распределена по двум реальным паттернам.

### 5.1 `apps/api/src/utils/validate.ts`

Этот helper строится поверх `express-validator` и добавляет общий обработчик ошибок валидации:

- собирает `validationResult(req)`,
- нормализует имена полей,
- формирует `application/problem+json` через `sendProblem`,
- вызывает `cleanupUploadedFiles(req)` при неуспешной валидации загрузок.

Этот путь полезен там, где router использует набор `ValidationChain[]` напрямую.

### 5.2 `apps/api/src/middleware/validateDto.ts`

`validateDto` принимает DTO-объект с методом `rules()` и превращает его в цепочку `RequestHandler[]`. Фактические использования есть, например, в:

- `routes/authUser.ts`
- `routes/users.ts`
- `routes/roles.ts`
- `routes/departments.ts`
- `routes/employees.ts`
- `routes/fleets.ts`
- `routes/logs.ts`
- `routes/archives.ts`
- `routes/tasks.ts`

То есть «DTO-валидация» в текущей архитектуре — это не отдельный модуль monolith-style, а конкретный middleware-адаптер над `express-validator`, который используется на уровне route definition.

## 6. Фактический RBAC

### 6.1 Базовые точки RBAC

Текущая RBAC-механика опирается на следующие файлы:

- `apps/api/src/auth/roles.decorator.ts` — middleware-фабрика `Roles(mask)`, которая записывает требуемую маску в request.
- `apps/api/src/auth/roles.guard.ts` — проверка `req.user?.access` через `hasAccess(...)` и возврат `403` через `sendProblem(...)` при недостатке прав.
- `apps/api/src/utils/accessMask.ts` — сами битовые маски доступа и проверка `hasAccess`.

### 6.2 Где RBAC применяется реально

RBAC включён непосредственно в router'ах, а не в отдельном «authorization module». Подтверждённые примеры:

- `routes/users.ts` — `ACCESS_MANAGER` на список и `ACCESS_ADMIN` на создание/изменение/удаление.
- `routes/roles.ts` — `ACCESS_ADMIN` на список и обновление ролей.
- `routes/system.ts` — системные административные endpoints под `ACCESS_ADMIN`.
- `routes/tasks.ts` — `ACCESS_MANAGER`, `ACCESS_USER`, `ACCESS_TASK_DELETE` на отдельных операциях.
- `routes/taskDrafts.ts`, `routes/storage.ts`, `routes/archives.ts`, `routes/logs.ts`, `routes/departments.ts`, `routes/employees.ts`, `routes/fleets.ts` — аналогичный паттерн с `Roles(...)` + `rolesGuard`.

Следовательно, каноническое описание RBAC для этого репозитория — это **route-level composition** (`authMiddleware` + `Roles(...)` + `rolesGuard`), а не абстрактные декораторы/guards NestJS-стиля на уровне классов модулей.

## 7. `apps/worker`: фактическая роль и BullMQ/Redis-взаимодействие

`apps/worker` отвечает за фоновую обработку задач, которые API может либо поставить в очередь, либо — при недоступности BullMQ — выполнить через fallback локально.

### 7.1 Что делает worker

`apps/worker/src/index.ts`:

- открывает очереди BullMQ с общими именами из `shared`,
- создаёт `Worker` для геокодирования и маршрутизации,
- отправляет ошибочные задачи в DLQ,
- логирует состояние очередей,
- корректно закрывает queue connections по `SIGINT`/`SIGTERM`.

### 7.2 Геокодирование

`apps/worker/src/tasks/geocoding.ts`:

- принимает job или address string,
- извлекает координаты через shared-утилиты (`extractCoords`) и локальный `parsePointInput`,
- при наличии `MONGO_DATABASE_URL` и `taskId` может обновлять `startCoordinates` / `finishCoordinates` в MongoDB,
- возвращает `GeocodingJobResult`.

### 7.3 Маршрутизация

`apps/worker/src/tasks/routing.ts`:

- нормализует точки старта/финиша,
- валидирует координаты,
- строит запрос к `ROUTING_URL`,
- вызывает внешний routing backend,
- возвращает `RouteDistanceJobResult` c `distanceKm`.

### 7.4 Как API взаимодействует с worker

`apps/api/src/queues/taskQueue.ts`:

- ставит job'ы в `logistics-geocoding` и `logistics-routing`,
- ждёт результата через `QueueEvents`,
- использует retry/backoff из `apps/api/src/config/queue.ts`,
- при отсутствии Redis/worker'а уходит в fallback на локальные вызовы `geocodeAddress(...)` и `getOsrmDistance(...)`.

`apps/api/src/queues/queueMetrics.ts` дополнительно публикует Prometheus-метрики состояния очередей (`waiting`, `active`, `delayed`, `failed`, `completed`) и возраст старейшей waiting-job.

## 8. Shared-слой (`packages/shared`)

### 8.1 `packages/shared/src/mapUtils.ts`

Этот файл — фактический общий слой для работы с координатами и Google Maps ссылками:

- `extractCoords(...)` извлекает координаты из URL, hash/query параметров и текстовых координат,
- `generateRouteLink(...)` строит ссылку на маршрут между двумя точками,
- `generateMultiRouteLink(...)` строит multi-stop route link.

Эти helpers используются как общая межсервисная основа для web/api/worker сценариев, где требуется единая логика работы с картами.

### 8.2 `packages/shared/src/types.ts`

Файл содержит общие доменные типы, в том числе:

- `Task`, `TaskPoint`, `User`,
- транспортные и tracking-события,
- `RoutePlan*` структуры,
- logistics event-типы.

Это важный слой контракта между frontend, API и worker: архитектурно он ближе к «shared contract package», чем к библиотеке второстепенных helper'ов.

### 8.3 Очереди и публичный API пакета

`packages/shared/src/queues.ts` хранит канонические имена очередей и типы job payload/result.
`packages/shared/src/index.ts` делает этот слой единым публичным API для остальных пакетов workspace.

## 9. Роль `apps/web`

`apps/web` — самостоятельное frontend-приложение, а не «статический хвост» API.

### Что подтверждается текущими файлами

- `src/main.tsx` выбирает browser/Telegram режим.
- `src/App.tsx` управляет авторизационным shell и входом.
- `src/AuthenticatedApp.tsx` задаёт маршруты `/tasks`, `/requests`, `/events`, `/mg/*`, `/cp/*`, `/theme`, `/profile` и lazy pages.
- `src/services/*` содержит клиентский слой обращений к backend.
- `src/context/*`, `src/components/*`, `src/pages/*` образуют отдельный UI/application слой.

Следовательно, верхнеуровневая архитектура проекта — это не «API с подпапкой web», а два отдельных приложения (`apps/api` и `apps/web`) плюс worker.

## 10. Роль `scripts`

Каталог `scripts` не участвует в runtime как приложение, но является важным операционным слоем монорепозитория:

- локальные/CI проверки (`scripts/pre_pr_check.sh`, `scripts/ci/*`),
- bootstrap и build support (`scripts/ensure-fonts.mjs`, `scripts/build_client.sh`),
- миграции и DB-утилиты (`scripts/db/*`),
- Railway/ops сценарии (`scripts/railway/*`),
- диагностика и аудит (`scripts/check_*`, `scripts/security_scan.sh`, `scripts/audit_deps.sh`).

Для описания архитектуры достаточно считать `scripts` служебным operational layer, поддерживающим сборку, миграции и эксплуатацию, но не частью runtime-domain модели.

## 11. Что считать историческим

Следующие формулировки больше нельзя использовать как основное описание архитектуры:

- древовидная схема `src/common`, `decorators`, `modules/*`;
- описание системы как NestJS-подобного монолита с модульной иерархией как главным уровнем абстракции;
- RBAC и валидация как «абстрактные слои» без привязки к `apps/api/src/routes/*`, `validate.ts`, `validateDto.ts`, `roles.guard.ts`.

Если такие формулировки встречаются в старых заметках, их следует считать историческими reference-материалами, а не актуальной архитектурой.

## 12. Краткий вывод

Каноническая архитектура проекта на текущем состоянии — это:

1. **`apps/api`** как основной backend и Telegram runtime.
2. **`apps/web`** как самостоятельный frontend.
3. **`apps/worker`** как отдельный BullMQ worker поверх Redis.
4. **`packages/shared`** как контрактный shared-слой типов, map utils и очередей.
5. **`scripts`** как operational/tooling слой монорепозитория.

Именно эта схема должна использоваться в документации, ревью и дальнейших архитектурных изменениях.
