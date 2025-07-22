<!-- Назначение файла: краткое описание возможностей проекта. Основные модули: bot, web. -->

# Telegram Task Manager Bot + Mini App

Проект предоставляет Telegram‑бота и веб‑клиент для учёта задач. Весь код находится в каталоге `bot`.

## Возможности

- Создание и редактирование задач через чат и мини‑приложение.
- Веб‑панель администратора на базе TailAdmin.
- REST API с документацией Swagger по пути `/api-docs`.
- Поддержка расчёта маршрутов через сервис OSRM.
- Кеширование задач в Redis и метрики Prometheus по пути `/metrics`.

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

Переменная `NODE_ENV` управляет флагом `secure` у cookie: в продакшене они передаются только по HTTPS.

Полную техническую документацию смотрите в файле `docs/technical_manual.md`.
