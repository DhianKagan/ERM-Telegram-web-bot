<!-- Назначение файла: краткий release/runbook-чеклист перед каждым инфраструктурным релизом Railway split-окружения. -->

# Railway split release preflight

> Internal-only: preflight содержит infra/admin checks и должен использоваться только в trusted maintainer/SRE scope. Evidence храните во внутреннем тикете/архиве, а не в active docs.

Используйте этот preflight **перед каждым инфраструктурным релизом** Railway split-окружения (`erm-api`, `erm-bot`, `erm-worker`), а не эпизодически.

Под инфраструктурным релизом здесь понимается любой change set, который меняет хотя бы одно из следующего:

- Railway service / environment / variables / Start Command;
- private-network host или service-to-service URL;
- queue-настройки (`QUEUE_*`, Redis wiring, concurrency, attempts, backoff);
- RAM/CPU лимиты или `NODE_OPTIONS`;
- healthcheck path / health endpoints / routing публичного API;
- builder/runtime-профиль (`Dockerfile`, Nixpacks, Build Command, release behavior).

## 1) Когда preflight обязателен в release workflow

Preflight должен быть отдельным обязательным шагом release workflow:

1. **До infra-release approval** — пройти весь чек-лист ниже и приложить evidence.
2. **До нажатия Deploy / Redeploy в Railway** — подтвердить, что конфигурация в UI совпадает с ожидаемым runbook-состоянием.
3. **Сразу после релиза** — повторить runtime-проверки health/logs/metrics и обновить окно наблюдения.
4. **Без completed preflight инфраструктурный релиз не считается готовым к выполнению**.

## 2) Краткий preflight checklist

### 2.1 Сервисы и команды запуска

Подтвердить, что в Railway project существуют и правильно настроены все три сервиса:

- `erm-api`
- `erm-bot`
- `erm-worker`

Для каждого сервиса проверить:

1. сервис создан в нужном Railway project/environment;
2. **Start Command** соответствует builder/runtime-профилю;
3. `APP_ROLE` задан только как `api`, `bot` или `worker`, а не как полная shell-команда;
4. Root Directory / Build Command / runtime не расходятся с актуальным runbook.

Допустимые Start Command:

- Nixpacks/runtime с `pnpm`:
  - `pnpm run railway:start:api`
  - `pnpm run railway:start:bot`
  - `pnpm run railway:start:worker`
- Docker runtime без `pnpm`:
  - `node apps/api/dist/server.js`
  - `node apps/api/dist/bot/runtime.js`
  - `node apps/worker/dist/index.js`

### 2.2 Private network и service-to-service host

Подтвердить, что:

- для внутренних HTTP-вызовов используется placeholder вида `http://<internal-api-host>`;
- legacy internal hostname не используется в активных Railway variables, secrets или release notes;
- Redis/Mongo/S3 private-network endpoints указывают на актуальные internal hostnames, но реальные адреса не фиксируются в active docs.

### 2.3 Queue settings

Подтвердить, что:

- `QUEUE_PREFIX` одинаковый у `erm-api` и `erm-worker`;
- `QUEUE_REDIS_URL` ведёт в Railway private network;
- `QUEUE_CONCURRENCY` зафиксирован явным значением и соответствует утверждённому runtime-профилю;
- `QUEUE_ATTEMPTS` и `QUEUE_BACKOFF_MS` не менялись неявно вместе с релизом.

### 2.4 RAM limits и runtime memory policy

Подтвердить, что service-level memory policy согласована между Railway и env-конфигурацией:

- `erm-api`: `NODE_OPTIONS=${{shared.API_NODE_OPTIONS}}`
- `erm-bot`: `NODE_OPTIONS=${{shared.BOT_NODE_OPTIONS}}`
- `erm-worker`: `NODE_OPTIONS=${{shared.WORKER_NODE_OPTIONS}}`

И что текущие baseline-лимиты не разъехались:

- `API_NODE_OPTIONS=--max-old-space-size=384`
- `BOT_NODE_OPTIONS=--max-old-space-size=256`
- `WORKER_NODE_OPTIONS=--max-old-space-size=256`
- Railway RAM limits соответствуют выбранному split-профилю и change request.

### 2.5 Health endpoints и post-deploy runtime checks

Подтвердить, что:

- у `erm-api` задан `healthcheckPath=/health`;
- `PORT` у `erm-api` не зафиксирован вручную;
- `GET /health` возвращает `200`;
- `GET /api/monitor/health` возвращает `200`;
- в логах `erm-api` нет bind-ошибок и restart loop;
- `erm-bot` показывает успешный старт webhook/polling runtime;
- `erm-worker` показывает запуск worker-процессов и обработку очереди без постоянных `failed`/`stalled`.

## 3) Обязательный evidence package

Каждый infra-release должен иметь приложенный evidence package. Минимум:

1. **Railway config links**
   - ссылки на страницы `Settings` / `Variables` / `Deployments` для `erm-api`, `erm-bot`, `erm-worker`;
2. **Логи**
   - build/release/runtime логи по каждому затронутому сервису;
3. **Метрики**
   - CPU, memory, restarts и, для `erm-worker`, queue lag / failed jobs;
4. **Health evidence**
   - результаты `GET /health` и `GET /api/monitor/health`;
5. **Окно наблюдения**
   - явные даты и время наблюдения, например `22 Mar 2026 10:00–14:00 Europe/Kyiv`.

Если релиз меняет лимиты, concurrency или private-network wiring, окно наблюдения должно покрывать:

- минимум post-deploy smoke сразу после релиза;
- и отдельную фиксацию состояния после окна наблюдения, достаточного для вывода о стабильности.

## 4) Как прикладывать preflight к релизу

В PR / release ticket / deploy note добавить короткий блок:

- **Preflight status:** `completed` / `blocked`
- **Railway services checked:** `erm-api`, `erm-bot`, `erm-worker`
- **Observation window:** `<дата и время>`
- **Evidence links:** `<Railway UI / logs / metrics / health outputs>`
- **Deviations / follow-ups:** `<если есть>`

Если хотя бы один пункт checklist не подтверждён evidence, статус должен оставаться `blocked`, а релиз — не переходить в infra deploy.

## 5) Связанные документы

- Детальная схема split-окружения: [`railway_split_services.md`](./railway_split_services.md)
- Точечный production audit / факт-проверка (archive/internal evidence): [`archive/railway_split_readiness_audit.md`](./archive/railway_split_readiness_audit.md)
- Сбор логов и attach артефактов: [`railway_logs.md`](./railway_logs.md)
