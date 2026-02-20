<!-- Назначение файла: точная инструкция по разнесению API, бота и воркера на отдельные Railway-сервисы с сохранением резервного single-container запуска через pm2. -->

# Railway: точный переход на 3 сервиса (API / Bot / Worker) + резервный single-container

Этот runbook фиксирует рабочую схему, в которой:

- **основной режим** — три отдельных Railway-сервиса (`erm-api`, `erm-bot`, `erm-worker`);
- **резервный режим** — старый single-container запуск через `pm2-runtime` остаётся в репозитории как rollback-вариант.

> Важно: для split-режима `pm2-runtime` **не нужен**. Railway сам перезапускает контейнер каждого сервиса.

## 1) Что уже готово в репозитории

- Раздельные команды запуска в `package.json`:
  - `railway:start:api`
  - `railway:start:bot`
  - `railway:start:worker`
- В командах запуска проставляется `APP_ROLE` (`api`/`bot`/`worker`), чтобы каждый сервис проверял только нужные env-переменные.
- Раздельные process-команды в `Procfile.railway`: `web`, `bot`, `worker`.
- Резервный single-container запуск через `Dockerfile` + `apps/api/ecosystem.config.cjs` (pm2).

Это позволяет безопасно перейти на split и в любой момент откатиться к монолитному контейнеру.

## 2) Создание трёх Railway-сервисов (из одного репозитория)

Создайте в одном Railway project три сервиса:

1. `erm-api`
2. `erm-bot`
3. `erm-worker`

Для **каждого** сервиса:

1. `New Service` → `GitHub Repo` → выберите этот же репозиторий.
2. В `Settings` задайте:
   - **Root Directory**: `.` (корень репозитория).
   - **Build Command**:

     ```bash
     pnpm install --frozen-lockfile && pnpm -r build
     ```

   - **Start Command** (выберите вариант под тип builder):

     **Если service использует Nixpacks/Build Command и в runtime доступен `pnpm`:**
     - `erm-api`: `pnpm run railway:start:api`
     - `erm-bot`: `pnpm run railway:start:bot`
     - `erm-worker`: `pnpm run railway:start:worker`

     **Если service использует Dockerfile runtime (частый случай) и `pnpm` в финальном слое недоступен:**
     - Не добавляйте инлайн-назначение переменных (`APP_ROLE=...`) в `Start Command`: в Railway Docker runtime команда может запускаться без shell и падать с ошибкой `The executable "app_role=..." could not be found`.
     - Укажите переменную сервиса `APP_ROLE` в разделе Variables (`api`/`bot`/`worker`).
     - В `Start Command` оставьте только бинарь Node:
       - `erm-api`: `node apps/api/dist/server.js`
       - `erm-bot`: `node apps/api/dist/bot/runtime.js`
       - `erm-worker`: `node apps/worker/dist/index.js`
     - Либо очистите `Start Command`: Docker image сам запустит нужный процесс через `/app/scripts/railway/start-by-role.sh` по `APP_ROLE`.

   > Для split-режима не используйте в Start Command `./scripts/set_bot_commands.sh`: в Dockerfile runtime каталога `scripts/` может не быть.
   > Для фронта/внутренних вызовов внутри Railway private network используйте актуальный internal hostname API: `erm-api.railway.internal` (вместо старого `agrmcs.railway.internal`).

3. Отключите ненужные переменные (см. матрицу ниже), чтобы сервисы не тянули лишнюю конфигурацию.

## 3) Точная матрица переменных окружения

Ниже — рекомендованный минимум без лишних пересечений.

### 3.1 `erm-api` (HTTP API)

Обязательно:

- `NODE_ENV=production`
- `MONGO_DATABASE_URL`
- `JWT_SECRET`
- `SESSION_SECRET`
- `APP_URL`
- `CORS_ORIGINS`

Часто нужны дополнительно (если включены соответствующие функции):

- `QUEUE_REDIS_URL`
- `QUEUE_PREFIX`
- `ROUTING_URL` (например `https://router.project-osrm.org`)
- `TELEGRAM_WEBHOOK_SECRET`

Не задавать без необходимости:

- `BOT_TOKEN`

### 3.2 `erm-bot` (Telegram runtime)

Обязательно:

- `NODE_ENV=production`
- `BOT_TOKEN`
- `APP_URL`
- `SESSION_SECRET`

В зависимости от схемы webhook:

- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_WEBHOOK_URL`

Опционально:

- `CHAT_ID`
- `BOT_USERNAME`

Обычно **не нужно** для бота:

- `QUEUE_REDIS_URL` (если бот не публикует задания в очередь)
- `QUEUE_CONCURRENCY`

### 3.3 `erm-worker` (BullMQ worker)

Обязательно:

- `NODE_ENV=production`
- `QUEUE_REDIS_URL`
- `QUEUE_CONCURRENCY`
- `QUEUE_ATTEMPTS`
- `QUEUE_BACKOFF_MS`

Если worker читает/пишет БД:

- `MONGO_DATABASE_URL`

Если включена маршрутизация:

- `ROUTING_URL`

Не задавать в worker:

- `BOT_TOKEN`
- `TELEGRAM_WEBHOOK_URL`

## 4) Ресурсы Railway (стартовые значения)

Рекомендуемый минимальный baseline:

- `erm-api`: `0.5 vCPU`, `512–1024 MB RAM`
- `erm-bot`: `0.25 vCPU`, `256–512 MB RAM`
- `erm-worker`: `0.5 vCPU`, `512–1024 MB RAM`

Увеличивайте только при подтверждённом дефиците по метрикам/логам.

## 5) Проверка после деплоя (обязательный чек-лист)

1. `erm-api`: `GET /health` возвращает `200`.
2. `erm-api`: в логах нет циклических рестартов и ошибок bind порта.
3. `erm-bot`: в логах есть успешная инициализация webhook (или polling, если так настроено).
4. `erm-worker`: задания очереди переходят в `completed`, нет постоянных `failed`/`stalled`.
5. В split-режиме каждый сервис рестартится независимо, без влияния на остальные.

## 6) Резервный rollback на single-container (временный)

Если split-деплой ведёт себя нестабильно, можно временно вернуть запуск «всё в одном контейнере»:

1. Поднять старый service (или отдельный fallback service), который использует `Dockerfile`.
2. Убедиться, что переменные совместимы с pm2-профилем (`api` + `bot` + `worker`).
3. Переключить трафик обратно на fallback service.

Что важно:

- fallback хранится **как страховка**, но не как основной путь масштабирования;
- после 1–2 стабильных недель split-режима fallback лучше архивировать.

## 7) OSRM / ROUTING_URL: не оставлять неопределённым

Если маршрутизация используется, задайте:

```bash
ROUTING_URL=https://router.project-osrm.org
```

Если маршрутизация не нужна, отключите её в коде/конфиге до деплоя, чтобы worker/api не падали на старте из-за пустого URL.

## 8) Частые ошибки при split

1. В `erm-bot` оставили `QUEUE_*`, хотя очередь боту не нужна.
2. В `erm-worker` забыли `QUEUE_REDIS_URL`.
3. Для API вручную выставили фиксированный `PORT`, конфликтующий с Railway runtime-портом.
4. `QUEUE_PREFIX` отличается между API и worker.
5. Сохранили старый монолитный сервис активным и получили дублирование обработки.

## 9) Минимальный порядок миграции без даунтайма

1. Развернуть `erm-api` и проверить `GET /health`.
2. Развернуть `erm-worker` и дождаться стабильной обработки очередей.
3. Развернуть `erm-bot` и проверить webhook/команды.
4. Оставить fallback single-container в standby.
5. Через период наблюдения отключить старый монолитный сервис.
