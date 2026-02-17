# Modern monitoring stack (Prometheus + Grafana + Loki)

Документ описывает быстрый и минимально инвазивный способ подключить современный стек мониторинга для локального запуска ERM.

## Что добавлено

- `docker-compose.monitoring.yml` — отдельный compose-оверлей для observability.
- `prometheus/prometheus.monitoring.yml` — scrape-конфиг под `docker compose` сервисы.
- `grafana/provisioning/**` — автоподключение Prometheus/Loki и автозагрузка дашборда.
- `promtail/promtail-config.yml` — сбор docker-логов в Loki.

## Быстрый старт

1. Запустите основной сервис и мониторинг вместе:

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

2. Проверьте UI:

- Grafana: <http://localhost:3001> (логин/пароль: `admin` / `admin`)
- Prometheus: <http://localhost:9090>
- Loki: <http://localhost:3100>

3. Проверьте доступность метрик API:

```bash
curl -fsS http://localhost:3000/metrics | head
```

4. Проверьте, что Prometheus видит таргеты:

```bash
curl -fsS http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health, lastError: .lastError}'
```

## Что смотреть в первую очередь

1. **BullMQ:**
   - `bullmq_jobs_total{state="failed"}`
   - `bullmq_queue_oldest_wait_seconds{queue="logistics-dead-letter"}`
2. **Stack health:**
   - `stack_health_status`
   - `stack_health_check_status{component="s3"}`
   - `stack_health_check_status{component="bullmq"}`
3. **HTTP latency/error profile:**
   - `http_requests_total`
   - `http_request_duration_seconds`

## Остановка

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml down
```

## Примечания

- Конфиг сделан отдельным overlay-файлом, чтобы не ломать базовый workflow локального запуска.
- Для production рекомендуется вынести Grafana credentials в секреты и сменить пароль администратора.
