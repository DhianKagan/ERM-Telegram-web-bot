<!-- Назначение файла: объединённое техническое руководство для проекта. Основные модули: bot, web, scripts. -->

# Технический мануал

Этот документ собирает в одном месте всю информацию по настройке и запуску проекта. Предыдущие файлы `docs/*.md` оставлены для истории, но все основные сведения сведены здесь.

## Архитектура

Проект состоит из сервера и мини‑приложения React внутри каталога `bot`.

- `src/api` — Express API с подключением Swagger и лимитом запросов.
- `src/bot` — Telegram‑бот на Telegraf и планировщик напоминаний.
- `src/routes` — REST‑маршруты.
- `src/services` — работа с Telegram API и MongoDB.
- `src/models`, `src/db` — схемы Mongoose и подключение к базе.
- `web` — клиентская часть React с собственными контекстами.

### Схема модулей

Диаграмма зависимостей и связи компонентов приведены в файле
`docs/architecture.md`. Она демонстрирует роль сервисов между API, ботом и
клиентом.

## Маски доступа

Роль пользователя описывается числовой маской в поле `access`:

- `1` — обычный пользователь.
- `2` — администратор.

Функция `hasAccess` из `bot/src/utils/accessMask.js` проверяет права, middleware `checkRole` умеет принимать маску и строковое название роли.

## Основные маршруты API

Полный список маршрутов доступен через Swagger по адресу `/api-docs` после запуска сервера. Ниже перечислены базовые эндпойнты:

| Метод | Путь                     | Назначение                  |
| ----- | ------------------------ | --------------------------- |
| GET   | /health                  | Проверка сервера            |
| POST  | /api/v1/auth/send_code   | Отправить код подтверждения |
| POST  | /api/v1/auth/verify_code | Подтвердить код             |
| GET   | /api/v1/tasks            | Список задач                |
| POST  | /api/v1/tasks            | Создать задачу              |
| PATCH | /api/v1/tasks/:id        | Обновить задачу             |

Более подробная карта запросов приведена в разделе "Карта запросов".

## Защита от CSRF

API использует middleware `lusca.csrf`. Токен хранится в cookie `XSRF-TOKEN`
и передаётся в заголовке `X-XSRF-TOKEN`. Для получения токена предусмотрен
маршрут `GET /api/v1/csrf`, который устанавливает cookie и возвращает значение
в поле `csrfToken`. Мини‑приложение вызывает его при запуске и копирует токен
в заголовок. Если токен отсутствует, `authFetch` получает его перед запросом.
Маршрут `/api/v1/optimizer` исключён из проверки CSRF, чтобы проще вызывать его из скриптов.
Ошибки проверки увеличивают счётчик `csrf_errors_total` и
фиксируются в логах. Логи собирает движок WG Log Engine,
просмотреть их можно на странице `/cp/logs`. Схема MongoDB принимает уровни `debug`, `info`, `warn`, `error` и `log`,
уровни подсвечены цветом,
ошибки могут дублироваться в Telegram.

## Карта запросов

Базовые функции взаимодействуют с MongoDB и API следующим образом:

| Операция            | Функция              | Маршрут                         |
| ------------------- | -------------------- | ------------------------------- |
| Создать задачу      | `createTask()`       | POST `/api/v1/tasks`            |
| Получить задачи     | `getTasks()`         | GET `/api/v1/tasks`             |
| Обновить задачу     | `updateTask()`       | PATCH `/api/v1/tasks/:id`       |
| Изменить статус     | `updateTaskStatus()` | POST `/api/v1/tasks/:id/status` |
| Массовое обновление | `bulkUpdate()`       | POST `/api/v1/tasks/bulk`       |

Команды бота вызывают те же функции через сервисы в `src/services`.
Функция `updateTask()` фильтрует поля обновления и игнорирует ключи, начинающиеся с `$`.

## Настройка Telegram‑бота

1. Получите токен у [@BotFather](https://t.me/BotFather) и сохраните в `.env` как `BOT_TOKEN`.
2. Запустите `./scripts/set_bot_commands.sh`, чтобы зарегистрировать команды бота.
3. Для установки текстов сообщений выполните `./scripts/set_bot_messages.sh`.
4. Мини‑приложение можно открыть по команде `/task_form_app`.

Бот разворачивает короткие ссылки Google Maps и сохраняет координаты задачи. После создания задачи из мини‑приложения отправляется событие `task_created` через `Telegram.WebApp.sendData`.

## Проверка initData WebApp

Перед выдачей токена сервер проверяет строку `initData`, полученную от Telegram. Подпись рассчитывается алгоритмом HMAC‑SHA256 с ключом `BOT_TOKEN`. Если подпись не совпадает, запрос отклоняется.

## Развёртывание и запуск

- Локальная разработка начинается с создания `.env` через `./scripts/create_env_from_exports.sh`.
- Зависимости сервера и клиента устанавливаются скриптом `./scripts/install_bot_deps.sh`.
- Тесты и статический анализ запускаются `./scripts/setup_and_test.sh`.
- Для проверки зависимостей выполните `./scripts/audit_deps.sh`.

### Быстрый старт

```bash
./scripts/create_env_from_exports.sh
./scripts/install_bot_deps.sh # устанавливает все зависимости
npm --prefix bot run dev
```

### Redis

Сервер Redis обеспечивает кеширование и метрики. Запустите контейнер командой:

```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

При необходимости укажите адрес в переменной `REDIS_URL`.
Если сервер Redis запущен на Railway, добавьте `?family=0`:

```bash
REDIS_URL=redis://user:pass@redis.railway.internal:6379?family=0
```

### Railway

Пошаговое развертывание на Railway:

1. Создайте проект и подключите плагин **MongoDB**.
2. Задайте переменные `BOT_TOKEN`, `MONGO_DATABASE_URL`, `APP_URL`, `ROUTING_URL` и `VITE_ROUTING_URL`. Переменные `LOG_LEVEL`, `LOG_TELEGRAM_TOKEN` и `LOG_TELEGRAM_CHAT` можно не задавать.
3. Railway использует `Procfile`, который собирает клиент и запускает pm2.
4. Убедитесь, что приложение слушает `process.env.PORT` на адресе `0.0.0.0`.

### Сервис маршрутов OSRM

Для расчёта маршрутов может использоваться собственный сервис OSRM.

```bash
docker build -t osrm-odessa .
docker run -d -p 5000:5000 osrm-odessa
```

Переменные `ROUTING_URL` и `VITE_ROUTING_URL` должны указывать на адрес сервиса.

## Профилирование и нагрузка

Скрипт `profiling/profile.py` запускает cProfile и делает серию запросов к API:

```bash
python profiling/profile.py
```

Для стресс‑тестов используется Locust:

```bash
locust -f loadtest/locustfile.py --host http://localhost:3000
```

## Метрики Prometheus и Chaos testing

Эндпойнт `/metrics` отдаёт данные prom-client. Для сбора метрик можно
использовать Prometheus. Пример конфигурации приведён в каталоге
`prometheus/prometheus.yml`. Базовое правило оповещения лежит в
`prometheus/alert.rules.yml`.

Запуск Prometheus локально:

```bash
docker run -d -p 9090:9090 \
  -v $(pwd)/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

После старта откройте <http://localhost:9090> и добавьте правила из
`prometheus/alert.rules.yml`.

Для испытаний устойчивости можно запустить `npm --prefix bot run chaos`.

## Интерфейс админки

Веб‑интерфейс построен на TailAdmin. Советы по стилизации собраны в `extended_tailadmin_guide.md`. Цветовые палитры определены в Tailwind, компонентные примеры приведены в файлах `bot/web`.

## Ответы бота

Типовые сообщения собраны в `bot/src/messages.js` и перечислены в `docs/bot_responses.md`. При необходимости их можно обновить скриптом `set_bot_messages.sh`.

---

Для подробностей обратитесь к исходным файлам в каталоге `docs/` или истории изменений в `CHANGELOG.md`.
