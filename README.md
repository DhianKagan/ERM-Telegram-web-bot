<!-- Назначение файла: краткое описание возможностей проекта. Основные модули: api, web. -->

# Telegram Task Manager Bot + Mini App

Проект предоставляет Telegram‑бота и веб‑клиент для учёта задач. Сервер находится в `apps/api`, клиент — в `apps/web`.

Номер задачи и дата создания отображаются отдельными полями, все изменения сохраняются в истории.
Форма задачи позволяет прикреплять файлы с миниатюрами после загрузки.
Вложения сохраняются в подкаталоге пользователя внутри каталога `STORAGE_DIR` (по умолчанию `apps/api/public`) и содержат метаданные: автор, дата загрузки, тип и размер.
Панель администратора содержит раздел «Файлы» для просмотра и удаления вложений.
Таблица задач поддерживает фильтрацию по значениям через чекбоксы и поиск.
Веб‑клиент использует Tailwind с плагином `@tailwindcss/forms`, базовые компоненты `Button` и `Input` соблюдают контраст и 8‑pt ритм.
Шрифты скачиваются локально скриптом `scripts/download-fonts.sh`.

## Менеджер пакетов

Проект использует `pnpm`; lock‑файлы `package-lock.json` удалены, зависимости фиксируются в `pnpm-lock.yaml`.

## Быстрый старт

```bash
pnpm install
./scripts/setup_and_test.sh
pnpm --dir apps/api dev
```

## Сборка клиента

```bash
npm run prepare-client
```

Сборка очищает каталог вывода благодаря параметру `emptyOutDir` в `apps/web/vite.config.ts`.

## Контроль размера бандла

```bash
pnpm size
```

Команда убеждается, что файлы `apps/api/public/assets` остаются меньше 900 KB.

## Проверка доступности

После выполнения `./scripts/setup_and_test.sh` можно проверить контрастность главной страницы:

```bash
pnpm a11y
```

Команда собирает клиент, поднимает `vite preview` на `http://localhost:4173` и проверяет страницу через `@axe-core/cli` по правилу `color-contrast`.

## Deploy на Railway

```bash
pnpm build
```

`Procfile` выполняет эту команду перед запуском `pm2-runtime`,
после чего `./scripts/set_bot_commands.sh` синхронизирует команды.
Если в логах появляется сообщение `Script not found: apps/api/dist/server.js`,
значит сборка не выполнена.

## Структура пакетов

- `bot` — Telegram‑бот, REST API и мини‑приложение React.
- `api` — серверные обработчики в каталоге `apps/api/src/api`.
- `shared` — общие утилиты и типы в `packages/shared`.

## Пример локального запуска

```bash
# API и бот вместе в режиме разработки
pnpm --dir bot dev

# Отдельный бот после сборки
pnpm --dir bot build
node apps/api/dist/bot/bot.js
```

## Пример шаблона задачи

```bash
curl -X POST http://localhost:3000/api/v1/task-templates \
  -H 'Content-Type: application/json' \
  -d '{"name":"Звонок","data":{"title":"Позвонить"}}'
```

## R2

## Секреты и ключи

Секреты загружаются из HashiCorp Vault или AWS Secrets Manager.
Ключи пересоздаются по CRON из переменной `KEY_ROTATION_CRON`.

## R2

Маршрут `/r2/sign-upload` выдаёт подпись для загрузки в R2 и
сохраняет метаданные файла в коллекции `uploads` (key, mime, размер, владелец).
`key` проверяется по регулярному выражению, размер файла ограничен заголовком `Content-Length`.
Маршрут `/r2/sign-get` возвращает подпись скачивания только для владельца файла.
Разрешённые источники задаются переменной `R2_CORS_ORIGIN`.
Публичный адрес бакета задаётся переменной `R2_ENDPOINT`.

Форма `TaskFormModern` по адресу `/tasks/new?template=<id>` заполнит поля из шаблона.
Все формы отправляют поле `formVersion`; сервер отклоняет неизвестные версии.

## Возможности

- Создание и редактирование задач через чат и мини‑приложение.
- Современная форма создания задач `TaskFormModern` на React и Tailwind.
- API шаблонов задач `/api/v1/task-templates`, форма поддерживает `?template=`.
- Поддержка произвольных полей задач через объект `custom`.
- Веб‑панель администратора на базе TailAdmin.
- Таблицы админки используют AG Grid с сервисом `useGrid` и модульными колонками.
- REST API с документацией Swagger по пути `/api-docs`.
- Поддержка расчёта маршрутов через сервис OSRM.
- Массовая смена статусов задач с выбором любого статуса.
- Поиск задач с нечетким соответствием и сохранением пользовательских видов фильтрации.
- Переменная `ROUTING_URL` проверяется на использование протокола HTTPS.
- Канбан-доска задач с перетаскиванием и обновлением статуса доступна только администраторам в разделе `cp`.
- Обычные пользователи видят только свои задачи и могут менять статус на «В работе» или «Выполнена» через специальные кнопки в таблице и чате бота.
- Запросы к OSRM кешируются в памяти или Redis на 10 минут и очищаются при
  изменении задач, матрица `/table` ограничена по размеру и частоте
  переменными `ROUTE_TABLE_GUARD`, `ROUTE_TABLE_MAX_POINTS` и
  `ROUTE_TABLE_MIN_INTERVAL_MS`.
- Заголовки безопасности формируются через Helmet и Content Security Policy,
  по умолчанию разрешающие Google Fonts; списки источников стилей и шрифтов
  расширяются через `CSP_STYLE_SRC_ALLOWLIST` и `CSP_FONT_SRC_ALLOWLIST`.
- В строгом режиме CSP добавляет `upgrade-insecure-requests` и отправляет отчёты
  на адрес из `CSP_REPORT_URI`.
- Общие функции Google Maps находятся в `packages/shared/src/mapUtils.ts`.
- Веб‑клиент импортирует их как `import { generateRouteLink } from 'shared'`.
- Текстовые ответы бота собраны в `apps/api/src/messages.ts`.
- Сервис и контроллер карт переведены на TypeScript.
- Контроллеры маршрутов и оптимизации, модуль `config.ts`, модель `AuthUser`
  и кастомный бекенд админки переписаны на TypeScript, дублирующие JS‑роуты
  удалены.
- Идемпотентный скрипт `scripts/db/ensureIndexes.ts` создаёт индексы MongoDB для задач.
- Подключение к MongoDB, модели и запросы (`connection.ts`, `model.ts`,
  `queries.ts`) используют строгие типы TypeScript.
- Развёртывание коротких ссылок Google Maps проверяет домен, протокол https, отсутствие userinfo и нестандартного порта.
- Скрипт заполнения базы `scripts/db/seed.ts` написан на TypeScript.
- Конфигурация TypeScript исключает `dist` для корректной сборки.
- Исключение `apps/api/src/api/*.js` удалено, весь серверный код на TypeScript.
- Сборка выполняется в строгом режиме TypeScript; включён флаг `noImplicitAny`; план миграции из JavaScript находится в `docs/typescript_migration_plan.md`.
- Конфигурации Vite, Tailwind и PostCSS написаны на TypeScript, скрипт темы перенесён в исходники.
- ESLint проверяет серверные файлы TypeScript; правило `no-explicit-any` включено,
  `ban-ts-comment` остаётся отключено.
- ESLint запрещает файлы `.js` вне конфигурации.
- Корневой `package.json` содержит зависимости `eslint`, `jiti` и `reflect-metadata`, поэтому `pnpm lint` запускает линтер во всех пакетах.
- Конфигурационные файлы переведены на TypeScript, скрипт `scripts/check_no_js.sh` предотвращает возврат к JavaScript.
- Автотесты бота написаны на TypeScript и выполняются через Jest.
- Утилиты `userLink`, `formatTask`, `validate`, `haversine`, `verifyInitData`, `accessMask`, `formatUser`, `setTokenCookie`, `rateLimiter`, `parseJwt`, `csrfToken`, `extractCoords` и `parseGoogleAddress` переписаны на TypeScript.
- `verifyInitData` использует библиотеку `@telegram-apps/init-data-node` и возвращает распарсенные данные.
- Утилита `authFetch` и сервисы веб‑клиента `logs`, `maps`, `optimizer`, `roles`, `route`, `routes`, `tasks` и `osrm` переписаны на TypeScript.
- Модуль авторизации `auth` переписан на TypeScript.
- Middleware `checkRole` и `taskAccess`, сервис `auth` веб-клиента и файл бота `bot` переписаны на TypeScript.
- Типизация сервиса `auth` веб-клиента исправлена: вместо `RequestInit` используется локальный интерфейс `FetchOptions`.
- Исправлена ошибка линтера: `authFetch` типизирует параметры без глобального `RequestInit`.
- Все сервисы переписаны на TypeScript и снабжены интерфейсами.
- Удалены остаточные CommonJS-экспорты и явные `any`, `asyncHandler` работает без параметра `next`.
- Сервисы `LogsService` и `UsersService` используют интерфейсы репозитория, исключая `any`.
- Общий тип `RequestWithUser` используется во всех контроллерах и middleware без `any`.
- Поле `query` в `RequestWithUser` типизировано как `ParsedQs` для совместимости с Express 5.
- Значение `username` в токене по умолчанию пустое, что устраняет ошибку сборки.
- Dockerfile копирует каталог `dist` в образ, чтобы pm2 нашёл собранный сервер.
- Исправлены ошибки TypeScript, мешавшие сборке Docker.
- Dockerfile кеширует зависимости через `pnpm fetch` и раздельно собирает пакеты `web` и `api`.
- Примеры конфигурации Prometheus лежат в каталоге `prometheus`.
- Метрики Prometheus по пути `/metrics`, middleware `metrics.ts` считает общее количество запросов и длительность.
- Гистограммы HTTP (method, route, status) и отдельные метрики OSRM с таймерами и счётчиком ошибок.
- Поддержка W3C Trace Context: заголовок `traceparent`, trace-id в логах и ответах проблем.
- Лимиты запросов на `/api/v1/auth` и `/api/v1/route`, лимитер отправляет `X-RateLimit-*`, превышения фиксирует метрика `rate_limit_drops_total` с метками `name` и `key`.
- Лимитер учитывает `telegram_id` пользователя и допускает обход по капче через заголовок `X-Captcha-Token`.
- Подключение middleware логирования и метрик исправлено для корректного запуска API.
- Исправлен маршрут `/api/v1/users`: убраны лишние аргументы обработчиков.
- Исправлен импорт `rolesGuard` в маршрутах `users`, `roles` и `logs`.
- Исправлена типизация профиля пользователя: `formatUser` допускает пустой `telegram_id`.
- Исправлена типизация контроллеров и сервисов, Docker-сборка проходит без ошибок.
- Проверка подписи initData веб‑приложения на сервере.
- При отсутствии `BOT_TOKEN` проверка подписи прерывается ошибкой.
- Инъекция зависимостей через библиотеку `tsyringe`.
- Валидация запросов через DTO и `class-validator`.
- Защита от CSRF через токен из `/api/v1/csrf`.
  Админка использует защищённые cookie (`HttpOnly`, `Secure`, `SameSite=None`),
  флаг `Secure` всегда активен и отключается только переменной `COOKIE_SECURE=false`.
  Токен сохраняется в `localStorage` и подставляется в заголовок `X-XSRF-TOKEN`.
  Маршруты Mini App (`/api/tma`) и запросы с заголовком `Authorization`
  обходят проверку CSRF. При ошибке сервер возвращает 403 в формате
  `application/problem+json`. Переменная `DISABLE_CSRF=1` полностью
  отключает middleware (для тестов).
- Логи выводятся на странице `/cp/logs`, используется движок WG Log Engine.
- Система логирования фиксирует только изменения задач, профиля и вход; запросы к `/api/v1/logs` не записываются.
- Интерфейс логов показывает таблицу с методом, статусом и endpoint, поддерживает live режим,
  экспорт в CSV/JSON, фильтрацию, сортировку и постраничный просмотр.
- Эндпойнт `/api/v1/logs` принимает `page` и `limit`, параметры валидируются.
- Фильтр по уровню принимает только значения `debug`, `info`, `warn`, `error`, `log`.
- Движок поддерживает цветные уровни, защиту PII и отправку ошибок в Telegram.
- Уровень логирования по умолчанию `debug`; схема MongoDB принимает уровни `debug`, `info`, `warn`, `error` и `log`.
- Переменные `LOG_LEVEL`, `LOG_TELEGRAM_TOKEN` и `LOG_TELEGRAM_CHAT` задаются при необходимости.
- Каждый успешный вход пользователя записывается в логи.
- Клиент при запуске обращается к `/api/v1/csrf` и сохраняет токен в `localStorage`.
- Если `localStorage` недоступен, значение хранится в памяти до перезагрузки.
- При возврате на страницу AuthProvider заново запрашивает `/api/v1/csrf`.
- Запуск `pnpm --dir bot test:types` проверяет типы через `tsd`,
  `./scripts/stress_test.sh` выполняет стресс-тест из `docs/stress_plan.md`.
- Каталог `bot` содержит собственный `tsconfig.json` для тестов типов.
- Функция `authFetch` повторяет запрос при ответе 403,
  автоматически запрашивая новый CSRF‑токен и выводя детали в консоль.
  Опция `noRedirect` отключает переход на `/login` при кодах 401/403.
- При ошибке CSRF данные запроса сохраняются в `localStorage`.
- Логи ошибок CSRF показывают значения заголовка и cookie для упрощения поиска причин.
- При отсутствии токена `authFetch` запрашивает его и сохраняет в `localStorage`,
  либо временно в памяти.
- Метрика `csrf_errors_total` отслеживается в Prometheus.
- Метрика `api_errors_total` считает ответы с кодами 4xx и 5xx.
- Middleware `pinoLogger.ts` выводит IP и User-Agent в логах и генерирует reqId из traceparent.
- Middleware `checkRole` и `checkTaskAccess` фиксируют отказ доступа в логах.
- Логи включают IP и User-Agent для каждого запроса.
- Превышение лимитов запросов также записывается с IP и путём запроса.
- Глобальный лимитер применяется только к маршрутам `/api`; статические файлы и `/api/v1/csrf` не ограничиваются и кешируются на год.
- AuthProvider отслеживает загрузку профиля и предотвращает ложный редирект на `/login`.
- Express отдаёт `index.html` для любых путей, включая `/login`, обеспечивая корректный переход при ответах 401/403.
- Cookie `token` использует `SameSite=Lax`. В продакшене домен берётся из переменной `COOKIE_DOMAIN` либо из `APP_URL`. В режиме разработки домен не задаётся, что исключает ошибку с localhost.
- Значение `COOKIE_DOMAIN` может быть полным URL, при загрузке конфигурации берётся только его hostname. Неверный формат вызывает ошибку при запуске.
- Сессия и cookie живут семь дней, совпадая со временем действия JWT.
- При каждом запросе middleware `verifyToken` продлевает cookie `token`,
  обеспечивая silent refresh.
- Cookie `XSRF-TOKEN` устанавливается с тем же доменом и `SameSite=None`,
  токен также возвращается в теле `/api/v1/csrf` и сохраняется в `localStorage`, при ошибке запись идёт в память.
- Система ролей использует маски доступа: `ACCESS_USER`, `ACCESS_ADMIN` и
  `ACCESS_MANAGER`. Тесты проверяют комбинированные права.
- Для маршрутов создан guard `rolesGuard`, маску задаёт декоратор `Roles`.
- Контроллеры задач запрещают изменять чужие задачи.
- Страница задач корректно обрабатывает пустой ответ fetchTasks.
- Исполнители на странице задач отображаются по имени при наличии `telegram_username`.
- Маршрут `/api/v1/optimizer` не требует CSRF-токена.
- Тест `routeCsrf.test.ts` проверяет CSRF при расчёте маршрута и использует самоподписанный сертификат,
  `taskFields.test.ts` контролирует состав полей формы.
  Значения enum хранятся в `packages/shared/src/taskFields.ts` и используются сервером и клиентом.

### Auth Mini App

Мини-приложение авторизуется через заголовок `Authorization: tma <initDataRaw>`
или `x-telegram-init-data`. Сервер проверяет подпись и поле `auth_date`
(не старше 5 минут) и выдаёт краткоживущий JWT. Cookie в этом потоке не
используются.

## Примеры ошибок API

Запрос без токена возвращает JSON в формате [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457):

```
HTTP/1.1 403
Content-Type: application/problem+json

{
  "type": "about:blank",
  "title": "Ошибка авторизации",
  "status": 403,
  "detail": "Токен авторизации отсутствует. Выполните вход заново.",
  "instance": "<trace-id>"
}
```

## Быстрый старт

```bash
git clone https://github.com/AgroxOD/agrmcs.git
cd agrmcs
./scripts/create_env_from_exports.sh
./scripts/install_bot_deps.sh # устанавливает корневые, серверные и клиентские зависимости
pnpm --dir bot build
pnpm --dir bot dev # запуск в режиме разработки
# или
pnpm --dir bot start
```

Скрипт `setup_and_test.sh` запускает тесты, а `audit_deps.sh` проверяет зависимости; `pre_pr_check.sh` вызывает его автоматически.
Ложные срабатывания `audit-ci` фиксируйте в `audit-ci.json` (см. `docs/security/audit_ci_false_positives.md`).
Перед каждым коммитом Husky выполняет `lint-staged`, инициализация происходит через файл `.husky/_/husky.sh`.
Тест `loginFlow.test.ts` проверяет полный цикл логина и ограничивает `/api/protected` ста запросами за 15 минут.
Тест `loginRouteFlow.test.ts` подтверждает вызов `/api/v1/route` без CSRF при наличии заголовка `Authorization`.
Тест `loginTasksFlow.test.ts` выполняет логин и создание задачи через `/api/v1/tasks` без CSRF-заголовка.
Тесты `authService.test.ts` и `tasksService.test.ts` проверяют логику сервисов авторизации и задач.
Для профилирования запустите `python profiling/profile.py`,
нагрузочное тестирование выполняет `locust -f loadtest/locustfile.py`.
Подробный план и инструкции по отказоустойчивости описаны в `docs/stress_plan.md`.

## Тестирование

- `pnpm test:e2e` запускает сценарии Playwright.
- `pnpm test:api` проверяет API через Supertest.

Приложение слушает `process.env.PORT` на `0.0.0.0`. Railway завершает TLS на Edge и автоматически перенаправляет HTTP на HTTPS.

Переменная `NODE_ENV` управляет флагом `secure` у cookie: в продакшене они передаются только по HTTPS.
Перечень переменных окружения для Railway приведён в `docs/railway_full_setup.md`.

Полную техническую документацию смотрите в файле `docs/technical_manual.md`.
Разделы API и карта запросов перенесены туда, файлы `docs/api_reference.md` и `docs/db_request_map.md` удалены.
Руководство по настройке Telegram-бота также включено в этот документ, отдельный файл удалён.
За стилем интерфейса следите по `docs/extended_tailadmin_guide.md`.
План внедрения рекомендаций из анализа описан в `docs/apply_analysis_plan.md`.

Мудборд интерфейса приведён в `docs/moodboard.md`.
Схема экранов и маршрутов описана в `docs/ui-skeleton.md`.

Для локального развёртывания можно собрать контейнер через Docker Compose:

```bash
docker compose build
docker compose up
```

Dockerfile используется из корня проекта, поэтому `.dockerignore` не исключает
его из контекста.

- Перед сборкой сервера в контейнер копируется `tsconfig.json`,
  иначе `pnpm --dir bot build` не находит конфигурацию TypeScript.
- Перед сборкой клиента выполняется `pnpm --dir bot build`, чтобы скомпилировать сервер

- Описание модулей собрано в docs/architecture.md
- Текущая lazy-загрузка компонентов описана в docs/lazy_loading.md
- Реализованы UsersModule, RolesModule и LogsModule с отдельными контроллерами
  и сервисами

## Модули проекта

- **AuthModule** — проверка кода и выдача JWT
- **TasksModule** — CRUD задач с расчётом маршрутов
- **UsersModule** — управление пользователями
- **RolesModule** — права и маски доступа
- **LogsModule** — журналирование действий

## CI/CD и деплой

Workflow `release.yml` в GitHub Actions собирает Docker-образ и запускает
`railway up` для обновления сервиса. Локально развёртывание выполняется через
`docker compose`.

Dependabot еженедельно обновляет npm-зависимости и помечает PR меткой `security`; отдельный job CI с `audit-ci` падает при уязвимостях уровня high.

### Railway: образ и два процесса

1. Соберите Docker-образ с API и ботом:

   ```bash
   docker build -t erm-bot .
   ```

2. Разместите репозиторий на Railway и используйте `Procfile.railway`:

   ```Procfile
   api: node apps/api/dist/server.js
   bot: ./scripts/set_bot_commands.sh && node apps/api/dist/bot/bot.js
   ```

   Railway запустит оба процесса в одном сервисе.

3. В разделе **Variables** укажите:
   - `BOT_TOKEN` — токен BotFather.
   - `JWT_SECRET` — секрет подписи JWT.
   - `MONGO_DATABASE_URL` — строка подключения к MongoDB.
   - `APP_URL` — домен приложения.

### Пример создания задачи через API

```bash
curl -X POST "$APP_URL/api/v1/tasks" \
  -H "Content-Type: application/json" \
  -H "X-XSRF-TOKEN: $CSRF" \
  --cookie "XSRF-TOKEN=$CSRF" \
  --cookie "$SESSION" \
  -d '{
    "title": "ERM_000123 Починить ворота",
    "task_description": "Не закрывается",
    "status": "Новая"
  }'
```

Переменная `SESSION` должна содержать cookie `connect.sid`, полученную вместе
с токеном через `/api/v1/csrf`. Токен берётся из поля `csrfToken` ответа.
Без этой cookie проверка CSRF не пройдёт.

Поля соответствуют `CreateTaskDto` в `src/dto/tasks.dto.ts`.

- Исправлен путь к auth.service для стабильного запуска
- Указано расширение `.ts` при импорте roles.decorator
- Установка cookie `token` логируется с указанием домена
- Добавлена функция `setTokenCookie` для единой установки cookie `token`

### Ротация токенов

В июле 2025 года все секреты Telegram‑бота были перевыпущены. Значения
обновлены в файлах `.env.example` и `.env`, а также в переменных Railway.
Подробная запись приведена в `INCIDENT_RESPONSE.md`.

### Ревизия кода

Июль 2025 года: проведена полная проверка репозитория на дубли и неиспользуемый код. В результате удалена зависимость `bcrypt`, так как она нигде не применялась.

Июль 2025 года: повторный аудит выявил повторяющиеся блоки расчёта маршрутов в `tasks.service.ts` и `tasks.js`. Логика вынесена в отдельную функцию.

Август 2025 года: из конфигурации убран модуль отправки SMS через GatewayAPI, переменные `GATEWAY_API_KEY` и `GATEWAY_SENDER` удалены.

Сентябрь 2025 года: API и связанные middleware переписаны на TypeScript, исходные `.js` файлы удалены.

Октябрь 2025 года: скрипты `get_menu_button_url`, `set_menu_button_url`, `set_attachment_menu_url` и `chaos` переписаны на TypeScript и запускаются через `ts-node`.

Ноябрь 2025 года: скрипт проверки MongoDB выводит понятное сообщение при недоступности базы.

### Обновления зависимостей

Удалены неиспользуемые пакеты bcrypt и mongodb-memory-server.

- Функция `handleValidation` переиспользуется в контроллерах и заменяет локальные проверки
- Удалён неиспользуемый пакет @aws-sdk/client-s3
- Ответы сервера сжимаются middleware `compression`
- Фильтры логов получили атрибуты `aria-label`
- Обновление пользователя фильтрует ключи обновления и использует `$eq` для telegram_id
- Удалены неиспользуемые интерфейсы в нескольких роутерах для прохождения ESLint
