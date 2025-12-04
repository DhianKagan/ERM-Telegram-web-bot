<!-- Назначение файла: пошаговая инструкция по развертыванию всего проекта на Railway. -->

# Полный запуск проекта на Railway

Ниже описаны шаги по настройке сервиса на Railway так, чтобы бот, веб‑клиент и API работали вместе с сервисом **OSRM**.

## 1. Создание проекта

1. Зарегистрируйтесь на Railway и создайте новый проект.
2. Добавьте плагин **MongoDB**. После создания Railway выдаст переменную `DATABASE_URL`.

## 2. Развёртывание основного приложения

1. Нажмите **New Service → Deploy from GitHub** и выберите этот репозиторий.
2. В разделе **Variables** задайте:
   - `BOT_TOKEN` — токен от BotFather.
   - `MONGO_DATABASE_URL` — строка подключения к MongoDB. На Railway используйте значение из `DATABASE_URL` плагина MongoDB; в локальной проверке `scripts/pre_pr_check.sh` запускает MongoDB в памяти, а в CI проверка пропускается.
   - `APP_URL` — домен проекта вида `https://<имя>.up.railway.app`.
   - `ROUTING_URL` — адрес сервиса маршрутов из следующего шага (например, `https://router.project-osrm.org`).
   - `VITE_ROUTING_URL` — конечная точка маршрутов `https://router.project-osrm.org/route/v1/driving` для клиентской части.
3. Railway автоматически использует `Procfile`, который собирает клиент и запускает pm2.
4. Приложение должно слушать `process.env.PORT` на `0.0.0.0`. Railway завершает TLS на Edge и автоматически перенаправляет HTTP на HTTPS.

## 3. Добавление OSRM

1. Создайте ещё один сервис через **Deploy from GitHub** и выберите репозиторий `AgroxOD/OSRM-Odessa-Region`.
2. Railway установит зависимости и запустит приложение автоматически.
3. После запуска сервис будет доступен по выданному Railway домену, например `https://osrm-yourapp.up.railway.app`.
4. Укажите адрес сервиса, например `https://osrm-yourapp.up.railway.app` в переменной `ROUTING_URL` и конечный endpoint
   `https://router.project-osrm.org/route/v1/driving` (или маршрут вашего сервиса) в `VITE_ROUTING_URL` основного приложения.
5. При необходимости задайте переменную `OSRM_ALGORITHM` со значением `ch` или `mld`.

## 4. BullMQ воркер

1. Добавьте плагин **Redis** или подключите внешний инстанс, сохраните строку подключения в переменную `QUEUE_REDIS_URL` (поддерживаются схемы `redis://` и `rediss://`).
2. При деплое основного приложения Procfile автоматически стартует `api`, `bot` и `worker` внутри одного сервиса через pm2 — отдельный билд не требуется, достаточно прокинуть переменные окружения очередей.
3. Если хотите вынести очереди в отдельный процесс Railway, создайте дополнительный сервис из этого же репозитория и выберите команду `worker` из `Procfile.railway` (или задайте вручную `pnpm --filter worker run start`).
4. Установите переменные окружения для воркера: `QUEUE_REDIS_URL`, `QUEUE_PREFIX` (опционально), `GEOCODER_URL`/`GEOCODER_USER_AGENT`/`GEOCODER_EMAIL`/`GEOCODER_API_KEY`, `ROUTING_URL` и при необходимости `QUEUE_CONCURRENCY`. Для OpenRouteService Proxy используйте `GEOCODER_URL=https://api.openrouteservice.org/geocode/search` и ключ в `GEOCODER_API_KEY` или `ORS_API_KEY`.
5. После деплоя убедитесь, что на эндпоинте `/metrics` основного API появились метрики `bullmq_jobs_total` с состояниями `waiting`, `active`, `delayed`, `failed`, `completed`.

## 5. Запуск и проверка

1. Нажмите **Deploy** для всех сервисов (основного приложения, OSRM и воркера).
2. Откройте адрес из переменной `APP_URL` и убедитесь, что мини‑приложение загружается.
3. В Telegram отправьте `/start` боту и создайте тестовую задачу.
4. Эндпойнт `/api/v1/route` должен возвращать маршрут с использованием OSRM.

## 6. Дополнительные рекомендации

- Используйте Railway CLI для локальных тестов (`railway up`).
- При обновлении репозитория Railway автоматически перезапустит сервис.
- Для минимальной ручной настройки и автоматизации логов используйте [railway_minimal_setup.md](./railway_minimal_setup.md) и конвейер из [railway_logs.md](./railway_logs.md).

## Переменные окружения

Для корректной работы авторизации задайте:

- `NODE_ENV=production`
- `COOKIE_DOMAIN=<домен приложения>`

Подробности о переменной `COOKIE_DOMAIN` смотрите в разделе [«Защита от CSRF»](./technical_manual.md#защита-от-csrf).
