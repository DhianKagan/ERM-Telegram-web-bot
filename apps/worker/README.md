<!-- Назначение: инструкции по запуску и настройке воркера BullMQ -->

# Воркеры BullMQ

Сервис `apps/worker` обрабатывает фоновые задачи геокодирования и расчёта маршрутов, которые создаёт API. Воркеры используют Redis через BullMQ, поэтому переменные окружения должны совпадать с настройками `apps/api` и клиента.

## Требования

- Node.js и pnpm, установленные в корне монорепозитория.
- Redis, доступный по `QUEUE_REDIS_URL` (поддерживаются `redis://` и `rediss://`).
- Общий префикс очередей `QUEUE_PREFIX`, чтобы API и воркер работали с одинаковыми задачами.

## Переменные окружения

Полный пример находится в [`apps/worker/env.example`](./env.example). Ключевые параметры:

- `QUEUE_REDIS_URL` — обязательная строка подключения к Redis.
- `QUEUE_PREFIX` — общий префикс ключей BullMQ.
- `QUEUE_ATTEMPTS`, `QUEUE_BACKOFF_MS`, `QUEUE_CONCURRENCY` — параметры повторов и параллелизма воркеров.
- `GEOCODER_ENABLED`, `GEOCODER_URL`, `GEOCODER_USER_AGENT`, `GEOCODER_EMAIL`, `GEOCODER_API_KEY`, `GEOCODER_PROXY_TOKEN` — управление вызовами геокодера (поддерживаются Nominatim и OpenRouteService `/geocode/search`, в том числе через наш прокси с токеном).
- `ROUTING_URL`, `OSRM_ALGORITHM` — настройки OSRM для расчёта расстояний.
- `LOG_LEVEL` — уровень логирования Pino.

## Локальный запуск только воркера

1. Скопируйте пример окружения: `cp apps/worker/env.example apps/worker/.env` и укажите корректный `QUEUE_REDIS_URL`.
2. Соберите зависимости из корня: `pnpm install`.
3. Запустите воркер: `pnpm --filter worker dev` для режима разработки или `pnpm --filter worker run start` после сборки (`pnpm --filter worker build`).

## Запуск вместе с API и вебом

1. Используйте общий `.env` в корне (`cp .env.example .env`) и заполните блок «Воркеры BullMQ» — эти же переменные подхватят API и воркер.
2. Поднимите API и клиент обычными командами (например, `pnpm dev` или через `docker-compose`), дополнительно стартуйте воркер: `pnpm --filter worker dev`.
3. Убедитесь, что API и воркер смотрят на один и тот же `QUEUE_REDIS_URL` и одинаковый `QUEUE_PREFIX`; иначе задачи не будут попадать в обработку.

## Эксплуатационные заметки

- Геокодер можно временно отключить через `GEOCODER_ENABLED=0`, тогда маршрутизация продолжит работать.
- Для OpenRouteService укажите `GEOCODER_URL=https://api.openrouteservice.org/geocode/search` и ключ `GEOCODER_API_KEY` (или `ORS_API_KEY`).
- Для работы через наш ORS Proxy задайте `GEOCODER_URL=http://<private_host_proxy>:5000/search` и `GEOCODER_PROXY_TOKEN=<PROXY_TOKEN>`, ключ `GEOCODER_API_KEY` не нужен: прокси сам ходит в ORS по `ORS_API_KEY`.
- Для продакшна используйте собственный Nominatim и OSRM, либо OpenRouteService Proxy с ключом, чтобы избежать лимитов публичных сервисов.
- При развёртывании на Railway Procfile уже включает процесс `worker`, достаточно передать переменные окружения очередей.
