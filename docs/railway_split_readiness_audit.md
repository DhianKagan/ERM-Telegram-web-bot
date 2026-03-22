<!-- Назначение файла: актуальный аудит готовности и факт-проверка production-настроек Railway split-деплоя. -->

# Аудит готовности и факт-проверка Railway split-деплоя

Дата проверки: 22 Mar 2026 (Europe/Kyiv)

## Вывод

Split-конфигурация в Railway **настроена и частично перепроверена на production**:

1. Отдельные сервисы `erm-api`, `erm-bot`, `erm-worker` существуют в project `ERM AM`.
2. Для каждого сервиса выставлен явный `Start Command` под Docker runtime.
3. Для `api` включён healthcheck path `/health`.
4. `QUEUE_PREFIX` общий для `api` и `worker` (`erm`), а `PORT` у `api` вручную не зафиксирован.
5. Введены per-service heap-лимиты через `API_NODE_OPTIONS`, `BOT_NODE_OPTIONS`, `WORKER_NODE_OPTIONS` + service-level `NODE_OPTIONS`.
6. `erm-api` и `erm-worker` успешно задеплоились и прошли runtime-проверку.
7. У `erm-bot` новый деплой `77a3a757-9720-4952-a366-9518de71d830` после запуска остался в статусе `BUILDING`, но предыдущий active deployment `7f011e42-db7f-4dea-b2d5-62d421b8f516` остаётся `SUCCESS` и продолжает обслуживать runtime.

## Что именно подтверждено в Railway

### 1) Наличие трёх отдельных сервисов

В production environment присутствуют:

- `erm-api`
- `erm-bot`
- `erm-worker`

Дополнительно в проекте есть инфраструктурные сервисы (`MongoDB`, `Redis`, `erm-s3` и др.), но они не влияют на split-проверку API/Bot/Worker.

### 2) Применённые Start Command

Для production выставлены:

- `erm-api`: `node apps/api/dist/server.js`
- `erm-bot`: `node apps/api/dist/bot/runtime.js`
- `erm-worker`: `node apps/worker/dist/index.js`

Отдельно исправлено значение `APP_ROLE`: теперь это чистая роль (`api` / `bot` / `worker`), а не строка с полной командой запуска.

### 3) Healthcheck и порт API

- `erm-api.healthcheckPath=/health`
- service variable `PORT` у `erm-api` отсутствует

Это соответствует рекомендации Railway: приложение должно слушать runtime-port, который платформа подставляет сама.

### 4) Очередь

Подтверждено:

- shared `QUEUE_PREFIX=erm`
- у `api` и `worker` используется одинаковое значение `QUEUE_PREFIX`
- `QUEUE_REDIS_URL` настроен через Railway private network

### 5) Per-service heap limits

Зафиксированы значения:

- `API_NODE_OPTIONS=--max-old-space-size=384`
- `BOT_NODE_OPTIONS=--max-old-space-size=256`
- `WORKER_NODE_OPTIONS=--max-old-space-size=256`

А также сервисные привязки:

- `erm-api`: `NODE_OPTIONS=${{shared.API_NODE_OPTIONS}}`
- `erm-bot`: `NODE_OPTIONS=${{shared.BOT_NODE_OPTIONS}}`
- `erm-worker`: `NODE_OPTIONS=${{shared.WORKER_NODE_OPTIONS}}`

### 6) Проверка internal host для внутренних вызовов

По фактическим Railway variables на 22 Mar 2026 (Europe/Kyiv):

- internal host уже используется для инфраструктурных сервисов:
  - MongoDB: `erm-mongodb.railway.internal`
  - Redis: `redis.railway.internal`
  - S3/MinIO: `erm-s3.railway.internal`
- отдельной runtime-переменной для внутренних HTTP-вызовов в `erm-api` сейчас **не найдено**
- старый host `agrmcs.railway.internal` в активных Railway variables не найден

Итог:

- критичной активной конфигурации со старым internal hostname сейчас нет;
- если появится отдельный service-to-service HTTP вызов к API, использовать нужно `http://erm-api.railway.internal`.

## Проверка после деплоя

### 1) Public API

Проверено 22 Mar 2026 (Europe/Kyiv):

- `GET https://agromarket.up.railway.app/` → `302` redirect на `/index`
- `GET https://agromarket.up.railway.app/health` → `200`
- `GET https://agromarket.up.railway.app/api/monitor/health` → `200`

Краткий результат:

- `/` отвечает и отдаёт ожидаемый redirect на frontend entrypoint;
- `/health` возвращает `{"status":"ok", ...}`;
- расширенный health endpoint подтверждает готовность основных интеграций, включая `s3`.

### 2) Логи деплоя / runtime

`erm-api` (deployment `15344d2a-fbca-4dd6-9414-a140871b7484`, `SUCCESS`):

- S3 health/log output завершается без ошибки;
- внешний `/health` отвечает `200`.

`erm-worker` (deployment `b86c7245-3e9e-48a4-b139-eb2925240a19`, `SUCCESS`):

- `BullMQ DLQ connection ready`
- `BullMQ workers started`
- `Router worker ready`
- `Geocoder worker ready`

`erm-bot`:

- новый deployment `77a3a757-9720-4952-a366-9518de71d830` остаётся в `BUILDING`
- предыдущий active deployment `7f011e42-db7f-4dea-b2d5-62d421b8f516` показывает нормальный runtime:
  - `Webhook Telegram настроен`
  - `safeStartBot: startBot успешно выполнен`
  - `runtime: Бот успешно запущен.`

## Фатические / критичные значения, которые нужно контролировать дальше

1. `APP_ROLE` должен оставаться только `api|bot|worker`, без подстановки полной команды.
2. `PORT` у `erm-api` не нужно задавать вручную, пока сервис слушает Railway runtime-port.
3. `QUEUE_PREFIX` у `api` и `worker` должен оставаться одинаковым (`erm`).
4. Для внутренних HTTP-вызовов к API нельзя возвращаться к старому hostname `agrmcs.railway.internal`.
5. Нужно отдельно добить новый bot deployment `77a3a757-9720-4952-a366-9518de71d830` до `SUCCESS` или отменить/перезапустить его с разбором build queue / build logs.

## Скриншоты

Скриншоты Railway UI в этот runbook не добавлены: в текущей агентной сессии не был доступен browser/screenshot tool для сохранения артефактов.

## Рекомендуемый следующий шаг

1. В Railway открыть `erm-bot` → latest deployment `77a3a757-9720-4952-a366-9518de71d830`.
2. Проверить build queue / build logs.
3. Если deployment продолжает висеть в `BUILDING`, выполнить cancel + redeploy только для `erm-bot`.
4. После успешного bot redeploy обновить этот runbook отдельной строкой со статусом `SUCCESS` и временем проверки.
