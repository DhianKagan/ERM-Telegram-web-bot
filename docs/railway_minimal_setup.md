<!-- Назначение файла: краткий чек-лист по настройке Railway для автоматического сбора логов. -->

# Минимальная настройка Railway для автоконвейера логов

Документ описывает единственные шаги, которые нужно выполнить вручную, чтобы все дальнейшие операции (выгрузка логов, анализ, улучшения кода) выполнялись скриптом `scripts/railway_log_pipeline.sh`.

## 1. Подготовка проекта на Railway

1. Создайте проект в Railway или откройте существующий.
2. Подключите GitHub-репозиторий `ERM-Telegram-web-bot` через **New Service → Deploy from GitHub**.
3. В разделе **Variables** задайте значения:
   - `BOT_TOKEN` — токен вашего Telegram-бота от BotFather.
   - `MONGO_DATABASE_URL` — строка подключения к MongoDB (можно взять из плагина Railway MongoDB или собственного кластера).
   - `APP_URL` — домен Railway вида `https://<имя>.up.railway.app`.
   - `ROUTING_URL` — базовый адрес сервиса OSRM (например, `https://router.project-osrm.org`).
   - `VITE_ROUTING_URL` — конечная точка маршрутов `https://router.project-osrm.org/route/v1/driving` для клиентской части.
   - `NODE_ENV=production`.
4. Если используете отдельный сервис OSRM, разверните его аналогично и возьмите URL для переменных `ROUTING_URL` и `VITE_ROUTING_URL`.

## 2. Выпуск токена и настройка CLI

1. На странице профиля Railway откройте **Account → Generate Token** и сохраните значение.
2. Установите Railway CLI: `npm install -g @railway/cli`.
3. Выполните авторизацию одной командой:
   ```bash
   railway login --token <скопированный_токен>
   ```
4. В корне репозитория выполните `railway link` и выберите нужный проект.
5. При необходимости переключите окружение командой `railway environment switch <environment-id>`.

## 3. Подготовка конфигурации конвейера логов

1. Скопируйте пример файла: `cp Railway/config/pipeline.example.env Railway/config/pipeline.env`.
2. Укажите значения переменных:
   - `RAILWAY_SERVICE` — имя сервиса (как в CLI, например `erm-api`).
   - `RAILWAY_ENVIRONMENT` — имя окружения (обычно `production`).
   - `RAILWAY_DEPLOY=latest` — оставьте `latest`, если нужен последний деплой.
   - `RAILWAY_TAIL=400` — при необходимости измените количество строк.

## 4. Проверка перед автоматизацией

1. Убедитесь, что `railway status` показывает связку с нужным проектом.
2. Выполните пробный запуск без изменений: `./scripts/railway_log_pipeline.sh --dry-run` — в выводе должны появиться шаги без ошибок.
3. После успешной проверки удалите флаг `--dry-run` и запустите конвейер.

На этом настройка завершена. Все дальнейшие выгрузки логов, анализ и запуск тестов выполняются автоматически.
