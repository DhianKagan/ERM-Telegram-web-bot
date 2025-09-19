// Назначение: единый реестр Prometheus-метрик
// Основные модули: prom-client
import client from 'prom-client';

const globalKey = Symbol.for('erm.metrics.register');
const globalSymbols = globalThis as unknown as Record<symbol, client.Registry>;

export const register: client.Registry =
  globalSymbols[globalKey] ||
  (globalSymbols[globalKey] = new client.Registry());

client.collectDefaultMetrics({ register });

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Количество HTTP запросов',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Длительность HTTP запросов в секундах',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 3, 5],
  registers: [register],
});

export const osrmRequestDuration = new client.Histogram({
  name: 'osrm_request_duration_seconds',
  help: 'Длительность запросов к OSRM',
  labelNames: ['endpoint', 'status'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 3, 5],
  registers: [register],
});

export const osrmErrorsTotal = new client.Counter({
  name: 'osrm_errors_total',
  help: 'Ошибки запросов к OSRM',
  labelNames: ['endpoint', 'reason'],
  registers: [register],
});

export const fleetRecoveryFailuresTotal = new client.Counter({
  name: 'fleet_recovery_failures_total',
  help: 'Неудачные попытки восстановления флота из коллекции',
  labelNames: ['reason'],
  registers: [register],
});
