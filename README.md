<!-- Назначение файла: краткое описание возможностей проекта. Основные модули: bot, web. -->

# Telegram Task Manager Bot + Mini App

Проект предоставляет Telegram‑бота и веб‑клиент для учёта задач. Весь код находится в каталоге `bot`.

## Возможности

- Создание и редактирование задач через чат и мини‑приложение.
- Веб‑панель администратора на базе TailAdmin.
- REST API с документацией Swagger по пути `/api-docs`.
- Поддержка расчёта маршрутов через сервис OSRM.
- Кеширование задач в Redis и метрики Prometheus по пути `/metrics`.
- Примеры конфигурации Prometheus лежат в каталоге `prometheus`.
- Проверка подписи initData веб‑приложения на сервере.
- Защита от CSRF через cookie `XSRF-TOKEN` и заголовок `X-XSRF-TOKEN`.
- Логи выводятся на странице `/cp/logs`, используется движок WG Log Engine.
- Интерфейс логов поддерживает фильтры и сортировку.
- Фильтр по уровню принимает только значения `debug`, `info`, `warn`, `error`, `log`.
- Движок поддерживает цветные уровни, защиту PII и отправку ошибок в Telegram.
- Уровень логирования по умолчанию `debug`; схема MongoDB принимает уровни `debug`, `info`, `warn`, `error` и `log`.
- Переменные `LOG_LEVEL`, `LOG_TELEGRAM_TOKEN` и `LOG_TELEGRAM_CHAT` задаются при необходимости.
- Клиент при запуске обращается к `/api/v1/csrf` для установки токена.
- При возврате на страницу AuthProvider заново запрашивает `/api/v1/csrf`.
- Функция `authFetch` повторяет запрос при ошибке CSRF и выводит детали в консоль.
- При ошибке CSRF данные запроса сохраняются в `localStorage`.
- При отсутствии токена `authFetch` получает его перед первым запросом.
- Метрика `csrf_errors_total` отслеживается в Prometheus.
- AuthProvider отслеживает загрузку профиля и предотвращает ложный редирект на `/login`.
- Cookie `token` использует параметр `SameSite=Lax`, чтобы сессия не терялась при возврате с внешних сайтов.
- Маршрут `/api/v1/optimizer` не требует CSRF-токена.

Перед запуском необходимо поднять сервер Redis. По умолчанию используется `redis://localhost:6379`. Быстрый вариант — выполнить:

```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

Если используете Redis на Railway, добавьте `?family=0` в `REDIS_URL`,
например:

```bash
REDIS_URL=redis://user:pass@redis.railway.internal:6379?family=0
```

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
Для профилирования запустите `python profiling/profile.py`,
нагрузочное тестирование выполняет `locust -f loadtest/locustfile.py`.
Подробный план и инструкции по отказоустойчивости описаны в `docs/stress_plan.md`.

Приложение слушает `process.env.PORT` на `0.0.0.0`. Railway завершает TLS на Edge и автоматически перенаправляет HTTP на HTTPS.

Переменная `NODE_ENV` управляет флагом `secure` у cookie: в продакшене они передаются только по HTTPS.

Полную техническую документацию смотрите в файле `docs/technical_manual.md`.
За стилем интерфейса следите по `docs/extended_tailadmin_guide.md`.

## Сборка контейнера

Для локального развёртывания можно собрать контейнер через Docker Compose:

```bash
docker compose build
docker compose up
```

Dockerfile используется из корня проекта, поэтому `.dockerignore` не исключает
его из контекста.
