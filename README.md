<!-- Назначение файла: краткое описание возможностей проекта. Основные модули: bot, web. -->

# Telegram Task Manager Bot + Mini App

Проект предоставляет Telegram‑бота и веб‑клиент для учёта задач. Весь код находится в каталоге `bot`.

## Возможности

- Создание и редактирование задач через чат и мини‑приложение.
- Веб‑панель администратора на базе TailAdmin.
- REST API с документацией Swagger по пути `/api-docs`.
- Поддержка расчёта маршрутов через сервис OSRM.
- Примеры конфигурации Prometheus лежат в каталоге `prometheus`.
- Метрики Prometheus по пути `/metrics`, middleware `metrics.ts` считает общее количество запросов и длительность.
- Проверка подписи initData веб‑приложения на сервере.
- Инъекция зависимостей через библиотеку `tsyringe`.
- Валидация запросов через DTO и `class-validator`.
- Защита от CSRF через токен из `/api/v1/csrf`.
  Токен сохраняется в `localStorage`, а при недоступности хранилища
  запоминается в памяти и подставляется в заголовок `X-XSRF-TOKEN`.
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
- Функция `authFetch` повторяет запрос при ответе 403,
  автоматически запрашивая новый CSRF‑токен и выводя детали в консоль.
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
- Маршрут `/api/v1/optimizer` не требует CSRF-токена.
- Тест `routeCsrf.test.js` проверяет CSRF при расчёте маршрута и использует самоподписанный сертификат,
  `taskFields.test.js` контролирует состав полей формы.

## Быстрый старт

```bash
git clone https://github.com/AgroxOD/agrmcs.git
cd agrmcs
./scripts/create_env_from_exports.sh
./scripts/install_bot_deps.sh # устанавливает зависимости сервера и клиента
npm --prefix bot run dev
```

Скрипт `setup_and_test.sh` запускает тесты, а `audit_deps.sh` проверяет зависимости.
Тест `loginFlow.test.js` проверяет полный цикл логина и ограничивает `/api/protected` ста запросами за 15 минут.
Тест `loginRouteFlow.test.js` получает CSRF-токен и успешно вызывает `/api/v1/route`.
Тест `loginTasksFlow.test.js` выполняет логин и создание задачи через `/api/v1/tasks`.
Тесты `authService.test.js` и `tasksService.test.js` проверяют логику сервисов авторизации и задач.
Для профилирования запустите `python profiling/profile.py`,
нагрузочное тестирование выполняет `locust -f loadtest/locustfile.py`.
Подробный план и инструкции по отказоустойчивости описаны в `docs/stress_plan.md`.

Приложение слушает `process.env.PORT` на `0.0.0.0`. Railway завершает TLS на Edge и автоматически перенаправляет HTTP на HTTPS.

Переменная `NODE_ENV` управляет флагом `secure` у cookie: в продакшене они передаются только по HTTPS.
Перечень переменных окружения для Railway приведён в `docs/railway_full_setup.md`.

Полную техническую документацию смотрите в файле `docs/technical_manual.md`.
За стилем интерфейса следите по `docs/extended_tailadmin_guide.md`.
План внедрения рекомендаций из анализа описан в `docs/apply_analysis_plan.md`.

Для локального развёртывания можно собрать контейнер через Docker Compose:

```bash
docker compose build
docker compose up
```

Dockerfile используется из корня проекта, поэтому `.dockerignore` не исключает
его из контекста.

- Добавлено описание модулей в ModuleCore.md и docs/architecture.md
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

### Ротация токенов

В июле 2025 года все секреты Telegram‑бота были перевыпущены. Значения
обновлены в файлах `.env.example` и `.env`, а также в переменных Railway.
Подробная запись приведена в `INCIDENT_RESPONSE.md`.

### Обновления зависимостей

Удалены неиспользуемые пакеты bcrypt и mongodb-memory-server.
