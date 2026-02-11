<!-- Назначение файла: итоговый аудит готовности запуска API/Bot/Worker в отдельных Railway-сервисах. -->

# Аудит готовности к split-деплою в Railway

Дата проверки: 11 Feb 2026 (Europe/Kyiv)

## Вывод

Базовая техническая готовность **в целом есть**: репозиторий собирается, тесты и линт проходят, есть раздельные start-команды и runbook под три сервиса.

При этом остаются два практических условия запуска:

1. В Railway нужно вручную создать **три отдельных сервиса** (`erm-api`, `erm-bot`, `erm-worker`) и задать каждому свой Start Command.
2. Для локальной проверки через `docker-compose.services.yml` нужен файл `.env` в корне (в репозитории есть пример `Railway/.env`).

## Что проверено

### 1) Скрипты и конфигурация split-запуска

- В `package.json` есть:
  - `railway:start:api`
  - `railway:start:bot`
  - `railway:start:worker`
- В `Procfile.railway` есть отдельные команды `web`, `bot`, `worker`.
- В `docs/railway_split_services.md` есть runbook для разнесения на отдельные Railway services.

### 2) Сборка и качество

Успешно выполнены обязательные проверки:

- `pnpm -w -s install`
- `pnpm --filter shared build`
- `pnpm -r --filter '!shared' build`
- `pnpm --filter apps/api exec tsc -b`
- `pnpm -w test`
- `pnpm -w lint`

### 3) Локальная проверка split-контейнеров

- `docker compose -f docker-compose.services.yml config` без `.env` падает (ожидаемо).
- После временного подстановочного `.env` (из `Railway/.env`) compose-конфиг валиден.

## Рекомендованный preflight перед релизом

1. Создать/проверить три Railway services: `erm-api`, `erm-bot`, `erm-worker`.
2. Для каждого выставить Start Command:
   - `pnpm run railway:start:api`
   - `pnpm run railway:start:bot`
   - `pnpm run railway:start:worker`
3. Убедиться, что `QUEUE_PREFIX` одинаковый у `api` и `worker`.
4. Для `api` не фиксировать `PORT` вручную (Railway подставляет порт сам).
5. Проверить health endpoints после деплоя: `/` и `/health`.

## Статус готовности

**Ready with setup actions**: кодовая база готова, требуется корректная настройка Railway-сервисов и окружения.
