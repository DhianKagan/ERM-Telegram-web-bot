<!-- Назначение: примеры правил Prometheus. -->

# Примеры правил

```yaml
groups:
  - name: http-latency
    rules:
      - alert: HighHttpLatency
        expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le,route)) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Высокая задержка HTTP на {{ $labels.route }}'
  - name: osrm-errors
    rules:
      - alert: OsrmErrors
        expr: increase(osrm_errors_total[5m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Ошибки OSRM'
```
