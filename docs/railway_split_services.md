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
     - Укажите переменную сервиса `APP_ROLE` в разделе Variables **только как роль**: `api`, `bot` или `worker`.
     - Не записывайте в `APP_ROLE` полную команду вроде `api node apps/api/dist/server.js`: такой формат случайно «работает» только потому, что `start-by-role.sh` берёт первый токен, но это считается некорректной конфигурацией и усложняет аудит.
     - В `Start Command` оставьте только бинарь Node:
       - `erm-api`: `node apps/api/dist/server.js`
       - `erm-bot`: `node apps/api/dist/bot/runtime.js`
       - `erm-worker`: `node apps/worker/dist/index.js`
     - Либо очистите `Start Command`: Docker image сам запустит нужный процесс через `/app/scripts/railway/start-by-role.sh` по `APP_ROLE`.

   > Для split-режима не используйте в Start Command `./scripts/set_bot_commands.sh`: в Dockerfile runtime каталога `scripts/` может не быть.
   > Для фронта/внутренних вызовов внутри Railway private network используйте актуальный internal hostname API: `erm-api.railway.internal` (вместо старого `agrmcs.railway.internal`).

3. Отключите ненужные переменные (см. матрицу ниже), чтобы сервисы не тянули лишнюю конфигурацию.

### 2.1 Рекомендуемая схема heap-лимитов Node.js

Для split-режима удобно держать лимиты памяти отдельно от Start Command:

- shared / environment variables:
  - `API_NODE_OPTIONS=--max-old-space-size=384`
  - `BOT_NODE_OPTIONS=--max-old-space-size=256`
  - `WORKER_NODE_OPTIONS=--max-old-space-size=256`
- service variables:
  - `erm-api`: `NODE_OPTIONS=${{shared.API_NODE_OPTIONS}}`
  - `erm-bot`: `NODE_OPTIONS=${{shared.BOT_NODE_OPTIONS}}`
  - `erm-worker`: `NODE_OPTIONS=${{shared.WORKER_NODE_OPTIONS}}`

Это даёт два плюса:

1. лимит меняется без переписывания Start Command;
2. audit/runbook сразу показывает, какой heap выделен каждому сервису.

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

## 4) Целевые runtime-профили и безопасные prod-defaults

Ниже — профили, которые стоит считать целевыми для production split-режима, пока нет нового baseline за окно наблюдения 7–14 дней. Эти значения согласованы с текущими heap-лимитами из репозитория, требованиями runbook по логам и незакрытыми ops-пунктами из task board.

| Сервис       | Профиль нагрузки                                                                     | Безопасный baseline Railway                                                        | Node heap                  | Concurrency                                                                                                     | Нормальный restart-паттерн                                | Когда пересматривать первым делом                                                                  |
| ------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `erm-api`    | latency-sensitive HTTP, короткие запросы, health/metrics, публикация задач в очередь | `0.5 vCPU`, `512 MB RAM` (допустимо до `1024 MB`, если memory headroom исчезает)   | `--max-old-space-size=384` | отдельный worker pool не вводить; держать один runtime instance на сервис до явной необходимости                | `0` вне redeploy; alert при `>3` рестартах за `15 min`    | memory `>85%` sustained, p95 API хуже baseline более чем на `10%`, bind/OOM/restart loop           |
| `erm-bot`    | Telegram webhook/polling, в основном I/O-bound, низкий steady CPU                    | `0.25 vCPU`, `256 MB RAM` (следующий шаг — `0.5 vCPU` / `384–512 MB`)              | `--max-old-space-size=256` | не вводить `QUEUE_*`; один runtime процесса достаточно                                                          | `0` вне redeploy; любой burst рестартов считать аномалией | пропуски webhook/update ack, memory `>80–85%`, burst рестартов, задержка команд пользователя       |
| `erm-worker` | BullMQ background jobs, CPU/network mixed, чувствителен к queue lag и внешним API    | `0.5 vCPU`, `512 MB RAM` (допустимо до `1 vCPU` / `1024 MB` только после baseline) | `--max-old-space-size=256` | `QUEUE_CONCURRENCY=1` по умолчанию; поднимать до `2` только после подтверждённого queue lag без memory pressure | `0` вне redeploy; alert при `>3` рестартах за `15 min`    | `bullmq_queue_oldest_wait_seconds > 180`, `failed jobs > 0`, CPU saturation, OSRM/geocoder latency |

### 4.1 Что уже подтверждено фактической нагрузкой, а что ещё нет

На 22 Mar 2026 (Europe/Kyiv) из доступных артефактов подтверждено следующее:

- `erm-api`: `/health` и `/api/monitor/health` отвечают `200`, в runbook нет признаков циклических runtime-рестартов.
- `erm-bot`: предыдущий active deployment работает штатно (`Webhook Telegram настроен`, `runtime: Бот успешно запущен.`); новый deployment, зависший в `BUILDING`, считается проблемой delivery-пайплайна, а не доказанной runtime-перегрузкой.
- `erm-worker`: worker стартует стабильно (`BullMQ workers started`), а split-runbook уже требует подтверждать, что задания переходят в `completed` и не застревают в `failed`/`stalled`.
- По task board всё ещё **не закрыты** пункты baseline/after (`T4.1`, `T4.3`) и runtime-валидация раздельной concurrency (`T2.2`). Это значит, что CPU avg/p95, RSS avg/p95 и restart-rate пока не собраны в полноценный production-baseline.

Итог: текущие лимиты памяти выглядят безопасно-консервативными, но единственное значение, которое нельзя агрессивно повышать без фактов, — `QUEUE_CONCURRENCY`. Для production его безопасно зафиксировать на `1`, пока не будет 7–14 дней наблюдения по queue lag, failed jobs и memory headroom.

### 4.2 Сопоставление конфигурации и фактической нагрузки

| Сервис       | Что зафиксировано сейчас                                                          | Что видно по фактической нагрузке                                             | Практический вывод                                                                           |
| ------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `erm-api`    | heap `384 MB`; Railway restart контролирует сама платформа; healthcheck `/health` | сервис отвечает `200`, признаков restart loop в runbook нет                   | оставляем `0.5 vCPU / 512 MB`, не повышаем CPU/RAM до появления sustained saturation         |
| `erm-bot`    | heap `256 MB`; отдельный runtime без очередей                                     | активный deployment стабилен, проблем CPU/RAM не зафиксировано                | минимальный профиль `0.25 vCPU / 256 MB` остаётся целевым default                            |
| `erm-worker` | heap `256 MB`; concurrency должна управляться env; сервис критичен к Redis/OSRM   | worker запускается стабильно, но baseline по queue lag/restarts ещё не собран | фиксируем `QUEUE_CONCURRENCY=1`, а масштабирование начинаем с метрик очереди, а не «на глаз» |

### 4.3 Порядок пересмотра лимитов при росте нагрузки

Пересмотр выполнять только по одной ручке за раз, чтобы причина эффекта оставалась проверяемой:

1. **Сначала подтвердить деградацию**: собрать `24h` логов + `7–14` дней метрик (`CPU`, `memory`, `restarts`, `p95`, `bullmq_queue_oldest_wait_seconds`, `failed jobs`).
2. **Проверить внешние зависимости**, прежде чем масштабировать сервис: Redis, Mongo, OSRM/geocoder, Telegram webhook, ошибки сети и rate limits.
3. **Для worker сначала менять concurrency**, но только если `queue lag` устойчиво выше порога, а `memory` остаётся < `75%`: `1 → 2`, затем наблюдение минимум `24h`.
4. **Дальше увеличивать RAM**, если есть memory pressure/OOM: `api 512 → 768/1024`, `bot 256 → 384/512`, `worker 512 → 768/1024`.
5. **CPU повышать последним**, когда memory headroom нормальный, но CPU saturation подтверждён и latency/queue lag не укладываются в baseline.
6. **Каждый шаг сопровождать rollback-окном**: если через `24h` после изменения p95/restarts/errors ухудшились, вернуть предыдущее значение и задокументировать результат.

## 5) Проверка после деплоя (обязательный чек-лист)

1. `erm-api`: `GET /health` возвращает `200`.
2. `erm-api`: в логах нет циклических рестартов и ошибок bind порта.
3. `erm-bot`: в логах есть успешная инициализация webhook (или polling, если так настроено).
4. `erm-worker`: задания очереди переходят в `completed`, нет постоянных `failed`/`stalled`.
5. В split-режиме каждый сервис рестартится независимо, без влияния на остальные.
6. `QUEUE_CONCURRENCY` в production зафиксирован явным значением и совпадает с выбранным профилем (`1`, если отдельное решение о росте не принято).

## 6) Признаки деградации и rollback по сервисам

### 6.1 `erm-api`

**Признаки деградации**

- `GET /health` перестаёт возвращать `200`;
- в логах появляются `bind`/`EADDRINUSE`/OOM ошибки;
- `>3` рестартов за `15 min`;
- p95 HTTP ухудшается более чем на `10%` против последнего baseline;
- растёт error rate или перестаёт проходить `quick_stack_validation`.

**Rollback**

1. Вернуть предыдущее значение `NODE_OPTIONS`/ресурсов Railway только для `erm-api`.
2. Перезапустить или redeploy **только** `erm-api`, не трогая bot/worker.
3. Если деградация началась после релиза — откатить `erm-api` на предыдущий успешный deployment.
4. Если сервис остаётся нестабильным, временно переключить HTTP-трафик на fallback single-container.

### 6.2 `erm-bot`

**Признаки деградации**

- исчезает строка успешной инициализации webhook/polling;
- Telegram начинает повторно слать update-ы или пользователи видят задержки ответов;
- `>3` рестартов за `15 min`;
- новый deployment зависает уже после старта runtime, а не только в `BUILDING`;
- memory pressure/OOM фиксируется в runtime-логах.

**Rollback**

1. Вернуть предыдущий успешный deployment `erm-bot`.
2. Откатить последние изменения `NODE_OPTIONS`/ресурсов только для `erm-bot`.
3. Проверить и при необходимости заново выставить `TELEGRAM_WEBHOOK_URL`/`TELEGRAM_WEBHOOK_SECRET`.
4. Если split-runtime бота нестабилен системно, временно вернуть bot-процесс в single-container fallback через pm2.

### 6.3 `erm-worker`

**Признаки деградации**

- `bullmq_queue_oldest_wait_seconds > 180` секунд дольше `10–15 min`;
- `bullmq_jobs_total{state="failed"}` перестаёт быть `0`;
- растёт `stalled`/DLQ backlog или job-ы не доходят до `completed`;
- `osrm_precheck_failures_total` или ошибки geocoder/Redis/Mongo растут сериями;
- `>3` рестартов за `15 min` или OOM после повышения `QUEUE_CONCURRENCY`.

**Rollback**

1. Сначала вернуть `QUEUE_CONCURRENCY` к предыдущему значению (безопасный default — `1`).
2. Затем откатить RAM/CPU worker до предыдущего профиля, если деградация появилась после tuning ресурсов.
3. Если проблема возникла после кода/релиза — откатить `erm-worker` на предыдущий успешный deployment.
4. При переполнении очереди временно остановить генерацию новых задач со стороны API или выполнить recovery по отдельному queue runbook.

## 6.4 Обязательный release preflight перед каждым инфраструктурным релизом

Перед **каждым** infra-release Railway split-окружения нужно пройти отдельный preflight runbook: [`railway_split_release_preflight.md`](./railway_split_release_preflight.md).

Это относится не только к первичному split-rollout, но и к любому изменению:

- Railway services / Variables / Start Command;
- private-network host и service-to-service wiring;
- `QUEUE_*`, Redis wiring, concurrency, attempts, backoff;
- RAM/CPU лимитов и `NODE_OPTIONS`;
- healthcheck path, health endpoints или runtime builder-профиля.

Release workflow должен выглядеть так:

1. Обновить change set и runbook-ссылки.
2. Пройти preflight checklist и приложить evidence.
3. Выполнить deploy / redeploy в Railway.
4. Повторить post-deploy health/log/metrics checks.
5. Зафиксировать observation window и итог `completed` / `blocked`.

Если preflight не завершён или не приложен evidence package, инфраструктурный релиз считается **blocked**.

## 7) Резервный rollback на single-container (временный)

Если split-деплой ведёт себя нестабильно, можно временно вернуть запуск «всё в одном контейнере»:

1. Поднять старый service (или отдельный fallback service), который использует `Dockerfile`.
2. Убедиться, что переменные совместимы с pm2-профилем (`api` + `bot` + `worker`).
3. Переключить трафик обратно на fallback service.

Что важно:

- fallback хранится **как страховка**, но не как основной путь масштабирования;
- после 1–2 стабильных недель split-режима fallback лучше архивировать.

## 8) OSRM / ROUTING_URL: не оставлять неопределённым

Если маршрутизация используется, задайте:

```bash
ROUTING_URL=https://router.project-osrm.org
```

Если маршрутизация не нужна, отключите её в коде/конфиге до деплоя, чтобы worker/api не падали на старте из-за пустого URL.

## 9) Частые ошибки при split

1. В `erm-bot` оставили `QUEUE_*`, хотя очередь боту не нужна.
2. В `erm-worker` забыли `QUEUE_REDIS_URL`.
3. Для API вручную выставили фиксированный `PORT`, конфликтующий с Railway runtime-портом.
4. `QUEUE_PREFIX` отличается между API и worker.
5. Сохранили старый монолитный сервис активным и получили дублирование обработки.

## 10) Минимальный порядок миграции без даунтайма

1. Развернуть `erm-api` и проверить `GET /health`.
2. Развернуть `erm-worker` и дождаться стабильной обработки очередей.
3. Развернуть `erm-bot` и проверить webhook/команды.
4. Оставить fallback single-container в standby.
5. Через период наблюдения отключить старый монолитный сервис.
