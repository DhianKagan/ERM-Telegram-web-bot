<!-- Назначение файла: краткое описание возможностей проекта. Основные модули: bot, web. -->

# Telegram Task Manager Bot + Mini App

Проект предоставляет Telegram‑бота и веб‑клиент для учёта задач. Весь код находится в каталоге `bot`.

## Возможности

- Создание и редактирование задач через чат и мини‑приложение.
- Веб‑панель администратора на базе TailAdmin.
- REST API с документацией Swagger по пути `/api-docs`.
- Поддержка расчёта маршрутов через сервис OSRM.
- Кеширование задач в Redis и метрики Prometheus по пути `/metrics`.
- Проверка подписи initData веб‑приложения на сервере.
- Защита от CSRF через cookie `XSRF-TOKEN` и заголовок `X-XSRF-TOKEN`.
- Логи выводятся на странице `/cp/logs`, используется движок WG Log Engine.
- Клиент при запуске обращается к `/api/v1/csrf` для установки токена.
- Функция `authFetch` повторяет запрос при ошибке CSRF и выводит детали в консоль.
- AuthProvider отслеживает загрузку профиля и предотвращает ложный редирект на `/login`.

Перед запуском необходимо поднять сервер Redis. По умолчанию используется `redis://localhost:6379`. Быстрый вариант — выполнить:

```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

## Быстрый старт

```bash
git clone https://github.com/AgroxOD/agrmcs.git
cd agrmcs
./scripts/create_env_from_exports.sh
./scripts/install_bot_deps.sh
npm --prefix bot run dev
```

Скрипт `setup_and_test.sh` запускает тесты, а `audit_deps.sh` проверяет зависимости.
Для профилирования запустите `python profiling/profile.py`,
нагрузочное тестирование выполняет `locust -f loadtest/locustfile.py`.
Подробный план описан в `docs/stress_plan.md`.

Переменная `NODE_ENV` управляет флагом `secure` у cookie: в продакшене они передаются только по HTTPS.

Полную техническую документацию смотрите в файле `docs/technical_manual.md`.
