<!-- Назначение файла: краткое описание возможностей проекта. Основные модули: bot, web. -->

# Telegram Task Manager Bot + Mini App

Проект предоставляет Telegram‑бота и веб‑клиент для учёта задач. Весь код находится в каталоге `bot`.

## Возможности

- Создание и редактирование задач через чат и мини‑приложение.
- Веб‑панель администратора на базе TailAdmin.
- REST API с документацией Swagger по пути `/api-docs`.
- Поддержка расчёта маршрутов через сервис OSRM.
- Общие функции Google Maps находятся в `bot/src/shared/mapUtils.ts`.
- Веб‑клиент импортирует их как `import mapUtils from '../../../src/shared/mapUtils.ts'`.
- Текстовые ответы бота собраны в `bot/src/messages.ts`.
- Сервис и контроллер карт переведены на TypeScript.
- Контроллеры маршрутов и оптимизации, модуль `config.ts`, модель `AuthUser`
  и кастомный бекенд админки переписаны на TypeScript, дублирующие JS‑роуты
  удалены.
- Подключение к MongoDB, модели и запросы (`connection.ts`, `model.ts`,
  `queries.ts`) используют строгие типы TypeScript.
- Развёртывание коротких ссылок Google Maps проверяет домен, протокол https, отсутствие userinfo и нестандартного порта.
- Скрипт заполнения базы `scripts/db/seed.ts` написан на TypeScript.
- Конфигурация TypeScript исключает `dist` для корректной сборки.
- Исключение `bot/src/api/*.js` удалено, весь серверный код на TypeScript.
- Сборка выполняется в строгом режиме TypeScript; включён флаг `noImplicitAny`; план миграции из JavaScript находится в `docs/typescript_migration_plan.md`.
- Конфигурации Vite, Tailwind и PostCSS написаны на TypeScript, скрипт темы перенесён в исходники.
- ESLint проверяет серверные файлы TypeScript; правило `no-explicit-any` включено,
  `ban-ts-comment` остаётся отключено.
- ESLint запрещает файлы `.js` вне конфигурации.
- Корневой `package.json` содержит зависимости `eslint` и `jiti`, поэтому `npx eslint bot/src` работает без дополнительных флагов.
- Конфигурационные файлы переведены на TypeScript, скрипт `scripts/check_no_js.sh` предотвращает возврат к JavaScript.
- Автотесты бота написаны на TypeScript и выполняются через Jest.
- Утилиты `userLink`, `formatTask`, `validate`, `haversine`, `verifyInitData`, `accessMask`, `formatUser`, `setTokenCookie`, `rateLimiter`, `parseJwt`, `csrfToken`, `extractCoords` и `parseGoogleAddress` переписаны на TypeScript.
- Утилита `authFetch` и сервисы веб‑клиента `logs`, `maps`, `optimizer`, `roles`, `route`, `routes`, `tasks` и `osrm` переписаны на TypeScript.
- Модуль авторизации `auth` переписан на TypeScript.
- Middleware `checkRole` и `taskAccess`, сервис `auth` веб-клиента и файл бота `bot` переписаны на TypeScript.
- Типизация сервиса `auth` веб-клиента исправлена: вместо `RequestInit` используется локальный интерфейс `FetchOptions`.
- Исправлена ошибка линтера: `authFetch` типизирует параметры без глобального `RequestInit`.
- Все сервисы переписаны на TypeScript и снабжены интерфейсами.
- Удалены остаточные CommonJS-экспорты и явные `any`, `asyncHandler` работает без параметра `next`.
- Сервисы `LogsService` и `UsersService` используют интерфейсы репозитория, исключая `any`.
- Общий тип `RequestWithUser` используется во всех контроллерах и middleware без `any`.
- Значение `username` в токене по умолчанию пустое, что устраняет ошибку сборки.
- Dockerfile копирует каталог `dist` в образ, чтобы pm2 нашёл собранный сервер.
- Исправлены ошибки TypeScript, мешавшие сборке Docker.
- Примеры конфигурации Prometheus лежат в каталоге `prometheus`.
- Метрики Prometheus по пути `/metrics`, middleware `metrics.ts` считает общее количество запросов и длительность.
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
  Токен сохраняется в `localStorage`, а при недоступности хранилища
  запоминается в памяти и подставляется в заголовок `X-XSRF-TOKEN`.
  Запросы с заголовком `Authorization` обходят проверку CSRF.
  Переменная `DISABLE_CSRF=1` полностью отключает middleware (для тестов).
- Логи выводятся на странице `/cp/logs`, используется движок WG Log Engine.
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
- Запуск `npm --prefix bot run test:types` проверяет типы через `tsd`,
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
- Middleware `logging.ts` выводит IP и User-Agent в логах.
- Middleware `checkRole` и `checkTaskAccess` фиксируют отказ доступа в логах.
- Логи включают IP и User-Agent для каждого запроса.
- Превышение лимитов запросов также записывается с IP и путём запроса.
- AuthProvider отслеживает загрузку профиля и предотвращает ложный редирект на `/login`.
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
  Значения enum хранятся в `bot/src/shared/taskFields.ts` и используются сервером и клиентом.

### Auth Mini App

Мини-приложение авторизуется через заголовок `Authorization: tma <initDataRaw>`
или `x-telegram-init-data`. Сервер проверяет подпись и поле `auth_date`
(не старше 5 минут) и выдаёт краткоживущий JWT. Cookie в этом потоке не
используются.

## Быстрый старт

```bash
git clone https://github.com/AgroxOD/agrmcs.git
cd agrmcs
./scripts/create_env_from_exports.sh
./scripts/install_bot_deps.sh # устанавливает корневые, серверные и клиентские зависимости
npm --prefix bot run build
npm --prefix bot start
```

Скрипт `setup_and_test.sh` запускает тесты, а `audit_deps.sh` проверяет зависимости.
Перед каждым коммитом Husky выполняет `lint-staged`, инициализация происходит через файл `.husky/_/husky.sh`.
Тест `loginFlow.test.ts` проверяет полный цикл логина и ограничивает `/api/protected` ста запросами за 15 минут.
Тест `loginRouteFlow.test.ts` подтверждает вызов `/api/v1/route` без CSRF при наличии заголовка `Authorization`.
Тест `loginTasksFlow.test.ts` выполняет логин и создание задачи через `/api/v1/tasks` без CSRF-заголовка.
Тесты `authService.test.ts` и `tasksService.test.ts` проверяют логику сервисов авторизации и задач.
Для профилирования запустите `python profiling/profile.py`,
нагрузочное тестирование выполняет `locust -f loadtest/locustfile.py`.
Подробный план и инструкции по отказоустойчивости описаны в `docs/stress_plan.md`.

Приложение слушает `process.env.PORT` на `0.0.0.0`. Railway завершает TLS на Edge и автоматически перенаправляет HTTP на HTTPS.

Переменная `NODE_ENV` управляет флагом `secure` у cookie: в продакшене они передаются только по HTTPS.
Перечень переменных окружения для Railway приведён в `docs/railway_full_setup.md`.

Полную техническую документацию смотрите в файле `docs/technical_manual.md`.
Разделы API и карта запросов перенесены туда, файлы `docs/api_reference.md` и `docs/db_request_map.md` удалены.
Руководство по настройке Telegram-бота также включено в этот документ, отдельный файл удалён.
За стилем интерфейса следите по `docs/extended_tailadmin_guide.md`.
План внедрения рекомендаций из анализа описан в `docs/apply_analysis_plan.md`.

Для локального развёртывания можно собрать контейнер через Docker Compose:

```bash
docker compose build
docker compose up
```

Dockerfile используется из корня проекта, поэтому `.dockerignore` не исключает
его из контекста.

- Перед сборкой сервера в контейнер копируется `tsconfig.json`,
  иначе `npm run build` не находит конфигурацию TypeScript.
- Перед сборкой клиента выполняется `npm run build`, чтобы скомпилировать сервер

- Описание модулей собрано в docs/architecture.md
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
