<!-- Назначение файла: практический runbook по восстановлению BullMQ geocoding/DLQ и базовым алертам. -->

# Runbook: восстановление geocoding и dead-letter очередей

## Когда применять

Используйте этот runbook, если в `/metrics` наблюдаются признаки деградации:

- `stack_health_status > 0`
- `bullmq_jobs_total{queue="logistics-geocoding",state="failed"} > 0`
- `bullmq_jobs_total{queue="logistics-dead-letter",state="waiting"} > 0`

- `bullmq_queue_oldest_wait_seconds{queue="logistics-geocoding"} > 0`

Новые метрики для диагностики:

- `bullmq_jobs_processed_total{queue,job,status,error_class}`
- `bullmq_job_wait_duration_seconds{queue,job,status}`
- `bullmq_job_processing_duration_seconds{queue,job,status}`
- `bullmq_queue_oldest_wait_seconds{queue}`

## 1) Диагностика

Админ-роут (API):

```bash
curl -sS -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://<api-host>/api/v1/system/queues/diagnostics?limit=20"
```

Ответ покажет:

- `geocodingFailed` — задачи `logistics-geocoding` в статусе `failed`;
- `deadLetterWaiting` — задачи в DLQ, ожидающие ручного разбора;
- `deadLetterFailed` — задачи, которые не обработались даже в DLQ.

## 2) Safe preview (dry-run)

Перед реальным восстановлением запускайте dry-run:

```bash
curl -sS -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  "https://<api-host>/api/v1/system/queues/recover" \
  -d '{
    "dryRun": true,
    "geocodingFailedLimit": 20,
    "deadLetterLimit": 20,
    "removeReplayedDeadLetter": false
  }'
```

## 3) Восстановление

### Вариант A (рекомендован): replay без удаления DLQ задач

```bash
curl -sS -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  "https://<api-host>/api/v1/system/queues/recover" \
  -d '{
    "dryRun": false,
    "geocodingFailedLimit": 20,
    "deadLetterLimit": 20,
    "removeReplayedDeadLetter": false
  }'
```

### Вариант B: replay + удаление успешно переигранных DLQ задач

```bash
curl -sS -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  "https://<api-host>/api/v1/system/queues/recover" \
  -d '{
    "dryRun": false,
    "geocodingFailedLimit": 20,
    "deadLetterLimit": 20,
    "removeReplayedDeadLetter": true
  }'
```

## 4) Базовые алерты (Prometheus rules)

```yaml
groups:
  - name: ermbot-queue-health
    rules:
      - alert: ERMStackHealthWarn
        expr: stack_health_status > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Stack health warn/error'

      - alert: ERMGeocodingFailedJobs
        expr: bullmq_jobs_total{queue="logistics-geocoding",state="failed"} > 0
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: 'Geocoding queue has failed jobs'

      - alert: ERMDeadLetterBacklog
        expr: bullmq_jobs_total{queue="logistics-dead-letter",state="waiting"} > 0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 'Dead-letter queue backlog detected'
```

> Изменения production-alerting в `prometheus/` выполняются через SRE-процесс.

## 5) Готовые PromQL-запросы

```promql
histogram_quantile(0.95, sum by (le, queue, job) (rate(bullmq_job_wait_duration_seconds_bucket[10m])))
```

```promql
histogram_quantile(0.95, sum by (le, queue, job) (rate(bullmq_job_processing_duration_seconds_bucket[10m])))
```

```promql
max by (queue) (bullmq_queue_oldest_wait_seconds)
```
