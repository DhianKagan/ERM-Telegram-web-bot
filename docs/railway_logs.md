<!-- Назначение файла: автоматизация сбора, анализа и передачи логов деплоев Railway. -->

# Автоматизированный сбор и анализ логов деплоев Railway

> Internal-only: runbook для maintainers/SRE. Не публикуйте operational details, admin endpoints и attach с логами вне доверенного контура.

Процесс построен так, чтобы вы выполнили только базовую настройку Railway, а далее скрипт сам выгружает логи, анализирует ошибки и запускает улучшения кода.

## 1. Что нужно сделать вручную

1. Настройте проект по краткому чек-листу из [railway_minimal_setup.md](./railway_minimal_setup.md).
2. Установите Railway CLI: `npm install -g @railway/cli`.
3. Выполните `railway login` и завершите интерактивную авторизацию Railway CLI. Если нужен headless/token-based доступ, храните токен только в password manager / CI secret и не передавайте его в shell history или скриншоты.
4. Свяжите репозиторий с проектом: `railway link`.
5. Скопируйте конфигурацию конвейера: `cp Railway/config/pipeline.example.env Railway/config/pipeline.env` и задайте значения переменных.

На этом ручные действия заканчиваются.

## 2. Запуск полного конвейера

В корне репозитория выполните:

```bash
./scripts/railway_log_pipeline.sh
```

Скрипт последовательно:

- скачивает логи последнего деплоя (или указанного идентификатора);
- сохраняет их в `Railway/logs/<service>-<env>-<deploy>-<timestamp>.log`;
- запускает `scripts/analyze_railway_logs.mjs`, который формирует отчёт в `Railway/analysis` и подбирает корректирующие действия;
- автоматически выполняет безопасные команды (например, `pnpm lint`, `pnpm test:api`, `node scripts/check_mongo.mjs`).
- при обнаружении ошибок форматирования добавляет и запускает `pnpm format`, чтобы привести код к стандарту перед повторным деплоем.

Отчёт с расшифровкой ошибок и списком рекомендаций сохраняется в Markdown и JSON. Ссылки на созданные файлы выводятся в консоли.

## 3. Частые параметры

- `--deploy <id>` — проанализировать конкретный деплой.
- `--tail 800` — увеличить объём загружаемого лога.
- `--skip-improvements` — сформировать отчёт, но не запускать команды улучшений.
- `--dry-run` — показать последовательность действий без выполнения.
- `--output-dir ./tmp/analysis` — сохранить результаты в другой каталог.

Пример запуска для продакшна:

```bash
./scripts/railway_log_pipeline.sh --deploy latest --tail 600
```

## 3.1 Быстрая валидация стека (health + метрики)

Для оперативной проверки API/Redis/Mongo/S3/BullMQ и обязательных метрик выполните:

```bash
API_BASE_URL=https://<public-api-domain> ./scripts/railway/quick_stack_validation.sh
```

Скрипт проверяет `GET /api/monitor/health` и `GET /metrics`, валидирует статусы `s3/storage/redis/mongo/bullmq=ok` и наличие метрик:

- `bullmq_jobs_total`
- `bullmq_queue_oldest_wait_seconds`
- `bullmq_job_processing_duration_seconds`
- `disk_used_bytes`
- `osrm_precheck_failures_total`

Если хоть один компонент недоступен или метрика отсутствует, скрипт завершается с ненулевым кодом.

Дополнительно скрипт проверяет именно связку `Redis ↔ worker` по метрикам очереди:

- `bullmq_queue_oldest_wait_seconds` не превышает `QUEUE_LAG_LIMIT_SECONDS` (по умолчанию `180` секунд);
- `bullmq_jobs_total{state="failed"}` не превышает `FAILED_JOBS_LIMIT` (по умолчанию `0`).

Пример с кастомными порогами:

```bash
API_BASE_URL=https://<public-api-domain> \
QUEUE_LAG_LIMIT_SECONDS=300 \
FAILED_JOBS_LIMIT=5 \
./scripts/railway/quick_stack_validation.sh
```

## 3.2 Как собрать evidence packet для пересмотра runtime-профилей

Когда нужно решить, повышать ли RAM/CPU/concurrency для `api`, `bot` или `worker`, собирайте один и тот же минимальный пакет фактов по каждому сервису:

1. **Deployment status + restart history** за последние `24h` из Railway UI. Ищите burst `>3` рестартов за `15 min`.
2. **Последние runtime-логи** через `./scripts/railway_log_pipeline.sh --deploy latest --tail 600` отдельно по сервису:
   - `api`: ищем `health`, `bind`, OOM, timeout, 5xx;
   - `bot`: ищем `Webhook Telegram настроен`, ошибки Telegram API, повторные старты runtime;
   - `worker`: ищем `BullMQ workers started`, `failed`, `stalled`, Redis/OSRM/Mongo ошибки.
3. **Health + metrics snapshot** через `./scripts/railway/quick_stack_validation.sh`, чтобы подтвердить состояние API и очередей.
4. **Window наблюдения 7–14 дней** по метрикам `CPU avg/p95`, `memory avg/p95`, `restarts`, `p95 latency` (для API), `bullmq_queue_oldest_wait_seconds` и `bullmq_jobs_total{state="failed"}` (для worker).

Практическая интерпретация:

- если нет restart bursts, нет OOM и memory держится ниже `80–85%`, RAM не повышаем;
- если `worker` упирается только в queue lag, начинаем с проверки внешних зависимостей и только потом обсуждаем `QUEUE_CONCURRENCY 1 → 2`;
- если `bot` стабилен по логам и не показывает runtime-errors, зависший deployment в `BUILDING` трактуем как deployment issue, а не как повод увеличивать CPU/RAM;
- если `api` отвечает `200`, но p95 ухудшается, сначала проверяем downstream-зависимости и только затем повышаем ресурсы.

## 4. Передача материалов ассистенту

1. Прикрепите файл отчёта из `Railway/analysis/*.md` и, при необходимости, исходный лог из `Railway/logs/`.
2. Добавьте команду запуска конвейера, чтобы можно было воспроизвести шаги.
3. Перед публикацией убедитесь, что в логах нет секретов. При необходимости удалите их вручную.

## 5. Если что-то пошло не так

- `Not authenticated` — повторите `railway login` и убедитесь, что CLI привязан к нужному аккаунту/проекту без передачи токена через историю shell.
- `Project not linked` — выполните `railway link` в корне репозитория.
- `No deployments found` — проверьте значение переменных `RAILWAY_SERVICE` и `RAILWAY_ENVIRONMENT` в конфигурации.
- Конвейер завершился с ошибкой — изучите `Railway/analysis/*` и вывод команд. При необходимости используйте `--skip-improvements`, чтобы получить отчёт без автоисправлений.

## 6. Интеграция с оркестратором

- API `/api/v1/system/overview` и `/api/v1/system/log-analysis/latest` возвращают свежие данные об анализе логов, которые отображаются в интерфейсе страницы хранилища.
- Карточка «Анализ логов Railway» показывает количество ошибок, предупреждений и автокоманд, а также позволяет запустить обновление анализа вручную.
