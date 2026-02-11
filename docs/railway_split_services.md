<!-- Назначение файла: практическая инструкция по разнесению API, бота и воркера на отдельные Railway-сервисы. -->

# Railway: отдельные сервисы API / Bot / Worker из монорепозитория

Этот runbook описывает, как разнести `api`, `bot` и `worker` по разным Railway services, сохранив один репозиторий и один pipeline.

## 1) Что уже подготовлено в репозитории

- В `Procfile.railway` есть отдельные service commands: `web`, `bot`, `worker`.
- В корневом `package.json` есть явные стартовые скрипты:
  - `railway:start:api`
  - `railway:start:bot`
  - `railway:start:worker`

Это означает, что каждый сервис Railway можно запустить как отдельный процесс из одного и того же кода.

## 2) Создание сервисов в Railway

Создайте три сервиса **в одном проекте** Railway (из одного GitHub-репозитория):

1. `erm-api`
2. `erm-bot`
3. `erm-worker`

Для каждого сервиса укажите Start Command:

- `erm-api`: `pnpm run railway:start:api`
- `erm-bot`: `pnpm run railway:start:bot`
- `erm-worker`: `pnpm run railway:start:worker`

Если нужен release step, используйте команду из `Procfile.railway`:

```bash
pnpm build && node dist/scripts/cleanup/cleanupDetachedFiles.js
```

## 3) Разделение переменных окружения

Ниже минимальный практический профиль переменных по сервисам.

### Общие для всех трёх

- `NODE_ENV=production`
- `MONGO_DATABASE_URL`
- `QUEUE_REDIS_URL`
- `QUEUE_PREFIX`
- `ROUTING_URL`
- `OSRM_ALGORITHM` (опционально)

### Только `erm-api`

- `APP_URL`
- `APP_ORIGIN`
- `CORS_ORIGINS`
- `COOKIE_DOMAIN`
- `VITE_ROUTING_URL`
- `QUEUE_METRICS_INTERVAL_MS` (если используете метрики очередей)

### Только `erm-bot`

- `BOT_TOKEN`
- `BOT_USERNAME` (опционально)
- `CHAT_ID` (опционально)

### Только `erm-worker`

- `QUEUE_CONCURRENCY`
- `GEOCODER_ENABLED`
- `GEOCODER_URL`
- `GEOCODER_USER_AGENT`
- `GEOCODER_EMAIL`
- `GEOCODER_API_KEY` / `ORS_API_KEY` / `GEOCODER_PROXY_TOKEN` (по выбранной схеме)

## 4) Проверка после деплоя

1. `erm-api` отвечает `GET /` со статусом 200.
2. `erm-api` отвечает `GET /health`.
3. В `/metrics` есть `bullmq_jobs_total`.
4. `erm-bot` отвечает на `/start` в Telegram.
5. `erm-worker` не падает и обрабатывает задания из очереди.

## 5) Локальный прогон перед Railway

Для локальной проверки split-подхода используйте готовый файл:

```bash
docker compose -f docker-compose.services.yml up --build
```

В нём `api`, `bot` и `worker` запускаются как отдельные контейнеры из одного монорепозитория.

## 6) Частые ошибки

1. **Оставили `PORT`/`HOST_PORT` в Railway вручную.**
   Для Railway это обычно лишнее: платформа сама передаёт порт для веб-сервиса.
2. **Разные `QUEUE_PREFIX` у API и worker.**
   Воркеры не видят задания API.
3. **`QUEUE_REDIS_URL` указывает на внешний Redis без доступа из Railway.**
   В логах будут ошибки подключения и ретраи BullMQ.
4. **Не задали `BOT_TOKEN` только для сервиса бота.**
   Процесс бота завершится с ошибкой и будет в рестартах.
