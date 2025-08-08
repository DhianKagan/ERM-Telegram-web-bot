<!-- Назначение файла: объединённое техническое руководство для проекта. Основные модули: bot, web, scripts. -->

# Технический мануал

Этот документ собирает в одном месте всю информацию по настройке и запуску проекта. Предыдущие файлы `docs/*.md` оставлены для истории, но все основные сведения сведены здесь.

## Архитектура

Проект состоит из сервера и мини‑приложения React внутри каталога `bot`.

- `src/api` — Express API с подключением Swagger и лимитом запросов.
- `src/bot` — Telegram‑бот на Telegraf и планировщик напоминаний.
- `src/routes` — REST‑маршруты. Маршруты `users`, `roles` и `logs` используют default‑импорт `rolesGuard`.
- `src/services` — работа с Telegram API и MongoDB.
- `src/models`, `src/db` — схемы Mongoose и подключение к базе.
- Файлы `connection.ts`, `model.ts` и `queries.ts` написаны на TypeScript.
- `web` — клиентская часть React с собственными контекстами.
- Контейнер собирается через `Dockerfile` в корне репозитория.
  Отдельный `bot/Dockerfile` удалён за ненадобностью.
- В образ копируется `tsconfig.json`, чтобы `npm run build` нашёл конфигурацию

### Инъекция зависимостей

Сервисы регистрируются через библиотеку `tsyringe` в файле `bot/src/container.ts`.
Точка входа `src/server.js` подключает контейнер перед запуском API.

### Сборка TypeScript

Перед запуском сервер компилируется командой `npm --prefix bot run build`.
Файлы из `bot/src` собираются в каталог `dist` в корне проекта, затем
переносятся в образ Docker и запускаются через `pm2`.

Сборка выполнена в строгом режиме TypeScript (`strict`),
опция `noImplicitAny` включена для строгой типизации.
Подробный план миграции из JavaScript описан в `docs/typescript_migration_plan.md`.
На TypeScript уже перенесены утилиты `userLink`, `formatTask`, `validate`, `haversine`, `verifyInitData`, `accessMask`, `formatUser`, `setTokenCookie`, `rateLimiter`, `parseJwt`, `csrfToken`, `extractCoords` и `parseGoogleAddress`.
Сервисы веб-клиента `logs`, `maps`, `optimizer`, `roles`, `route`, `routes`, `tasks`, `osrm` и утилита `authFetch` также переписаны на TypeScript.
Сервисы `LogsService` и `UsersService` используют интерфейсы репозитория и не содержат `any`.
Переписаны на TypeScript модуль `config`, контроллеры `routes` и `optimizer`,
модель `AuthUser` и кастомный бекенд админки; дублирующие JS‑роуты удалены.
Удалены остаточные CommonJS-экспорты и явные `any`, `asyncHandler` допускает обработчики без `next`.
Тип `RequestWithUser` вынесен в `src/types/request.ts` и подключён во всех контроллерах и middleware.
Конфигурации ESLint, Prettier и Babel написаны на TypeScript, скрипт `scripts/check_no_js.sh` гарантирует отсутствие JavaScript.
Утилита `verifyInitData` выбрасывает ошибку при отсутствии переменной `BOT_TOKEN`.

### Защита от инъекций

Функция `updateUser` фильтрует ключи с операторами и использует `$eq` при
поиске по `telegram_id`, чтобы исключить NoSQL-инъекции.

### Схема модулей

Диаграмма зависимостей и связи компонентов приведены в файле
`docs/architecture.md`. Она демонстрирует роль сервисов между API, ботом и
клиентом.

## Настройка Telegram-бота

Основной файл бота `bot/src/bot/bot.ts` использует библиотеку Telegraf и
обрабатывает обновления методом polling (`getUpdates`). Вебхуки не требуются.

### Получение токена

1. Напишите [@BotFather](https://t.me/BotFather) команду `/newbot`.
2. Сохраните выданный токен в переменной `BOT_TOKEN` файла `.env`.

### Установка команд

Скрипт `scripts/set_bot_commands.sh` отправляет список из
`scripts/bot_commands.json` в метод `setMyCommands`:

```bash
BOT_TOKEN=123 scripts/set_bot_commands.sh
```

При отсутствии терминала воспользуйтесь командой `/setcommands` у BotFather.

### Обновление меню

Скрипт `scripts/set_menu_button_url.ts` устанавливает ссылку мини‑приложения из
переменной `APP_URL`. Текущую ссылку выводит
`scripts/get_menu_button_url.ts`.

## Маски доступа

Роль пользователя описывается числовой маской в поле `access`:

- `1` — обычный пользователь.
- `2` — администратор.

Функция `hasAccess` из `bot/src/utils/accessMask.ts` проверяет права. Для маршрутов введены `Roles` и `rolesGuard`,
которые задают и проверяют маску доступа пользователя.

## Основные маршруты API

Полный список маршрутов доступен через Swagger по адресу `/api-docs` после запуска сервера. Ниже перечислены базовые эндпойнты:

| Метод | Путь                     | Назначение                  |
| ----- | ------------------------ | --------------------------- |
| GET   | /health                  | Проверка сервера            |
| POST  | /api/v1/auth/send_code   | Отправить код подтверждения |
| POST  | /api/v1/auth/verify_code | Подтвердить код             |
| POST  | /api/v1/auth/verify_init | Проверить initData          |
| GET   | /api/v1/tasks            | Список задач                |
| POST  | /api/v1/tasks            | Создать задачу              |
| GET   | /api/v1/tasks/:id        | Получить задачу             |
| PATCH | /api/v1/tasks/:id        | Обновить задачу             |
| PATCH | /api/v1/tasks/:id/time   | Добавить время              |
| POST  | /api/v1/tasks/:id/status | Изменить статус             |
| POST  | /api/v1/tasks/bulk       | Массовое обновление         |
| GET   | /api/v1/tasks/report/summary | KPI отчёт                |
| GET   | /api/v1/users            | Список пользователей        |
| POST  | /api/v1/users            | Создать пользователя        |
| GET   | /api/v1/logs             | Последние логи              |
| POST  | /api/v1/logs             | Записать сообщение в лог    |
| DELETE| /api/v1/tasks/:id        | Удалить задачу              |

Подробная карта запросов приведена в разделе «Карта запросов».

### Параметры отчёта KPI

| Параметр | Тип      | Описание               |
|----------|----------|------------------------|
| `from`   | ISO 8601 | Начальная дата периода |
| `to`     | ISO 8601 | Конечная дата периода  |

### Параметры списка задач

| Параметр | Тип | Описание                     |
|----------|-----|------------------------------|
| `page`   | int | Номер страницы, начиная с 1  |
| `limit`  | int | Количество задач на странице |

### Поля задачи

| Поле            | Enum                                                   | По умолчанию    |
|-----------------|-------------------------------------------------------|-----------------|
| `task_type`     | `Доставить`, `Купить`, `Выполнить`, `Построить`, `Починить` | `Доставить`     |
| `transport_type`| `Пешком`, `Авто`, `Дрон`                               | `Авто`          |
| `payment_method`| `Наличные`, `Карта`, `Безнал`, `Без оплаты`           | `Карта`         |
| `priority`      | `Срочно`, `В течение дня`, `Бессрочно`                | `В течение дня` |
| `status`        | `Новая`, `В работе`, `Выполнена`, `Отменена`          | `Новая`         |

## Карта запросов

Ниже перечислены основные операции с MongoDB и соответствующие маршруты API.

| Операция            | Функция            | Маршрут                                    |
|---------------------|-------------------|--------------------------------------------|
| Создать задачу      | `createTask()`    | `POST /api/v1/tasks`                       |
| Получить список задач | `getTasks()`    | `GET /api/v1/tasks`                        |
| Обновить задачу     | `updateTask()`    | `PATCH /api/v1/tasks/:id`                  |
| Изменить статус     | `updateTaskStatus()` | `POST /api/v1/tasks/:id/status`        |
| Добавить время      | `addTime()`       | `PATCH /api/v1/tasks/:id/time`             |
| Массовое обновление | `bulkUpdate()`    | `POST /api/v1/tasks/bulk`                  |
| Сводка по задачам   | `summary()`       | `GET /api/v1/tasks/report/summary`         |
| Пользователи        | `createUser()`, `listUsers()` | `POST /api/v1/users`, `GET /api/v1/users` |
| Логи                | `writeLog()`, `listLogs()` | `POST /api/v1/logs`, `GET /api/v1/logs` |
| Удалить задачу      | `deleteTask()`    | `DELETE /api/v1/tasks/:id`                 |

Команды бота вызывают те же функции через `services/service.ts`:

- `/create_task <текст>` — `createTask()`
- `/list_users` — `listUsers()`
- `/add_user <id> <username>` — `createUser()`
- `/update_task_status <taskId> <status>` — `updateTaskStatus()`
- `/send_photo <url>` — `call('sendPhoto')`
- `/edit_last <id> <текст>` — `call('editMessageText')`
- `/app` — выдаёт ссылку на мини‑приложение

Валидация входных данных выполняется через классы DTO в каталоге `src/dto`.
Middleware `validateDto` подключает правила из метода `rules` и возвращает
ошибку 400 при несоответствии.
Для простых роутов создана функция `utils/validate.ts`,
которая собирает правила `express-validator` и отправляет ошибку при неуспехе.
Она экспортирует `handleValidation` для повторного использования в контроллерах,
избавляя от дублирования кода.

## Защита от CSRF

API использует middleware `lusca.csrf`. Токен сохраняется в `localStorage`
и передаётся в заголовке `X-XSRF-TOKEN`. Маршрут `GET /api/v1/csrf`
устанавливает защищённые cookie (`HttpOnly`, `Secure`, `SameSite=None`) и
возвращает значение в поле `csrfToken`. Мини‑приложение вызывает его при
запуске и при фокусе вкладки, что обеспечивает ротацию токена.
Сессионная cookie и токен авторизации также помечены `HttpOnly`. В
продакшене флаг `Secure` включён автоматически; домен берётся из
`COOKIE_DOMAIN` либо `APP_URL`. В разработке домен не задаётся. Срок жизни
сессии и JWT — семь дней.

Маршруты Mini App с префиксом `/api/tma` и запросы с заголовком
`Authorization` исключены из проверки CSRF. Без токена сервер возвращает
403 с `application/problem+json`. Для скриптов токен не требуется на
`/api/v1/optimizer` и `/api/v1/maps/expand`. Переменная `DISABLE_CSRF=1`
полностью отключает middleware.

Ошибки увеличивают счётчик `csrf_errors_total` и логируются с заголовком и
cookie. Логи доступны на `/cp/logs` и содержат IP клиента и User-Agent.
Метрику `csrf_errors_total` стоит подключить к Prometheus; пример правила в
`prometheus/alert.rules.yml`. Дополнительно счётчик `api_errors_total`
фиксирует ответы с кодами 4xx и 5xx.
Логи содержат IP клиента и заголовок User-Agent для поиска проблем.
Middleware `logging.ts` выводит IP и User-Agent в логах.
Middleware `checkRole` и `checkTaskAccess` записывают отказ доступа с указанием пользователя и IP.
Фильтр по уровню допускает только перечисленные значения.
Каждый успешный вход пользователя фиксируется в логах движком WG Log Engine.

Тест `routeCsrf.test.js` использует secure cookie и проверяет CSRF,
`taskFields.test.js` помогает контролировать валидность полей формы.

## Получение и обновление токенов

1. Клиент при открытии приложения запрашивает `/api/v1/csrf`, чтобы
   получить токен и установить cookie `XSRF-TOKEN`.
2. Затем выполняется `/api/v1/auth/send_code` и `/api/v1/auth/verify_code`,
   после чего сервер выставляет cookie `token` и возвращает JWT в теле
   ответа.
3. При истечении срока жизни или ошибке 401/403 функция `authFetch`
   повторно запрашивает `/api/v1/csrf` и по умолчанию перенаправляет на `/login`.
   Опция `noRedirect` отключает этот переход и возвращает ответ вызывающему коду.
4. Для защиты от XSS cookie `token` имеет флаги `HttpOnly` и `SameSite=Lax`. В продакшене добавляется `Secure` и используется домен из `COOKIE_DOMAIN` либо `APP_URL`. В режиме разработки cookie передаётся и по HTTP без явного домена. Токен живёт семь дней.
5. Middleware `verifyToken` продлевает cookie `token` при каждом запросе,
6. Отдельная функция `setTokenCookie` устанавливает cookie `token` во всех контроллерах
   обеспечивая бесшумное обновление.

### Смешанное хранение CSRF-токена

Токен авторизации `token` передаётся в cookie HttpOnly, а CSRF-токен
хранится на клиенте. В обычной ситуации значение записывается в
`localStorage`, но при недоступности хранилища используется переменная в
памяти, что позволяет продолжить работу до перезагрузки. Утилита
`authFetch` подставляет токен в заголовок `X-XSRF-TOKEN` и при ответе 401/403
получает новый через `/api/v1/csrf`.

## Карта запросов

Базовые функции взаимодействуют с MongoDB и API следующим образом:

| Операция            | Функция              | Маршрут                         |
| ------------------- | -------------------- | ------------------------------- |
| Создать задачу      | `createTask()`       | POST `/api/v1/tasks`            |
| Получить задачи     | `getTasks()`         | GET `/api/v1/tasks`             |
| Обновить задачу     | `updateTask()`       | PATCH `/api/v1/tasks/:id`       |
| Изменить статус     | `updateTaskStatus()` | POST `/api/v1/tasks/:id/status` |
| Массовое обновление | `bulkUpdate()`       | POST `/api/v1/tasks/bulk`       |

Команды бота вызывают те же функции через сервисы в `src/services`.
Функция `updateTask()` фильтрует поля обновления и игнорирует ключи, начинающиеся с `$`.
Контроллеры задач проверяют, что пользователь может изменять только созданные им или назначенные задачи.

## Настройка Telegram‑бота

1. Получите токен у [@BotFather](https://t.me/BotFather) и сохраните в `.env` как `BOT_TOKEN`.
2. Запустите `./scripts/set_bot_commands.sh`, чтобы зарегистрировать команды бота.
3. Для установки текстов сообщений выполните `./scripts/set_bot_messages.sh`.
4. Мини‑приложение можно открыть по команде `/task_form_app`.

Бот разворачивает короткие ссылки Google Maps, проверяя домен, протокол https, отсутствие userinfo и нестандартного порта, и сохраняет координаты задачи. После создания задачи из мини‑приложения отправляется событие `task_created` через `Telegram.WebApp.sendData`.
Общие функции формирования ссылок и извлечения координат находятся в `bot/src/shared/mapUtils.ts` и используются сервером и клиентом. Веб‑клиент импортирует модуль как `import mapUtils from '../../../src/shared/mapUtils'`.

## Проверка initData WebApp

Перед выдачей токена сервер проверяет строку `initData`, полученную от Telegram. Подпись рассчитывается алгоритмом HMAC‑SHA256 с ключом `BOT_TOKEN`. Если подпись не совпадает, запрос отклоняется.

## Развёртывание и запуск

- Локальная разработка начинается с создания `.env` через `./scripts/create_env_from_exports.sh`.
- Корневые, серверные и клиентские зависимости устанавливаются скриптом `./scripts/install_bot_deps.sh`.
- Тесты и статический анализ запускаются `./scripts/setup_and_test.sh`.
- Типовые проверки выполняются `npm --prefix bot run test:types` через `tsd`.
- Стресс-тест запускается скриптом `./scripts/stress_test.sh` (см. `docs/stress_plan.md`).
- Перед коммитом Husky запускает `lint-staged`, используйте файл `.husky/_/husky.sh`.
- В тесты входит сценарий `loginFlow.test.js`, эмулирующий полный цикл логина и запрос к защищённому маршруту.
- Тест `loginRouteFlow.test.js` проверяет получение CSRF-токена и вызов `/api/v1/route`.
- Тесты `authService.test.js` и `tasksService.test.js` покрывают логику модулей авторизации и задач.
- Для проверки зависимостей выполните `./scripts/audit_deps.sh`.

### Быстрый старт

```bash
./scripts/create_env_from_exports.sh
./scripts/install_bot_deps.sh # устанавливает корневые, серверные и клиентские зависимости
npm --prefix bot run dev
```

Пошаговое развертывание на Railway:

1. Создайте проект и подключите плагин **MongoDB**.
2. Задайте переменные `BOT_TOKEN`, `MONGO_DATABASE_URL`, `APP_URL`, `ROUTING_URL` и `VITE_ROUTING_URL`. Переменные `LOG_LEVEL`, `LOG_TELEGRAM_TOKEN` и `LOG_TELEGRAM_CHAT` можно не задавать. Значения `GATEWAY_API_KEY` и `GATEWAY_SENDER` более не требуются.
3. Railway использует `Procfile`, который собирает клиент и запускает pm2.
4. Убедитесь, что приложение слушает `process.env.PORT` на адресе `0.0.0.0`.

### Сервис маршрутов OSRM

Для расчёта маршрутов может использоваться собственный сервис OSRM.

```bash
docker build -t osrm-odessa .
docker run -d -p 5000:5000 osrm-odessa
```

Переменные `ROUTING_URL` и `VITE_ROUTING_URL` должны указывать на адрес сервиса.

## Профилирование и нагрузка

Скрипт `profiling/profile.py` запускает cProfile и делает серию запросов к API:

```bash
python profiling/profile.py
```

Для стресс‑тестов используется Locust:

```bash
locust -f loadtest/locustfile.py --host http://localhost:3000
```

## Метрики Prometheus и Chaos testing

Эндпойнт `/metrics` отдаёт данные prom-client. Отдельный middleware
`metrics.ts` считает `http_requests_total` и `http_request_duration_ms`.
Для сбора метрик используется Prometheus. Конфигурация хранится в
`prometheus/prometheus.yml`, правила оповещений — в `prometheus/alert.rules.yml`.

Запуск Prometheus локально:

```bash
docker run -d -p 9090:9090 \
  -v $(pwd)/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

После старта откройте <http://localhost:9090> и добавьте правила из
`prometheus/alert.rules.yml`.

Для испытаний устойчивости можно запустить `npm --prefix bot run chaos`.

## Безопасность

Флаги cookie и защита от CSRF описаны в `docs/security/cookies_csrf.md`.
Content Security Policy и расширение списков разрешённых доменов — в `docs/security/csp.md`.

## Интерфейс админки

Веб‑интерфейс построен на TailAdmin. Советы по стилизации собраны в `extended_tailadmin_guide.md`. Цветовые палитры определены в Tailwind, компонентные примеры приведены в файлах `bot/web`.
Для неавторизованных пользователей админки используется статичная заглушка `admin-placeholder.html`; устаревший компонент `AdminPlaceholder.tsx` удалён.

## Ответы бота

Типовые сообщения собраны в `bot/src/messages.ts` и перечислены в `docs/bot_responses.md`. При необходимости их можно обновить скриптом `set_bot_messages.sh`.

---

Дополнительный план внедрения рекомендаций после аудита хранится в файле `docs/apply_analysis_plan.md`.
Для подробностей обратитесь к исходным файлам в каталоге `docs/` или истории изменений в `CHANGELOG.md`.

- Лишняя зависимость bcrypt удалена
- Дублирование расчёта маршрутов устранено: добавлена функция applyRouteInfo
- Удалён пакет @aws-sdk/client-s3
- API сжимает ответы через middleware `compression`
- Фильтры логов имеют атрибуты `aria-label`
