// Назначение: единый реестр Prometheus-метрик
// Основные модули: prom-client
import client from 'prom-client';
import { QueueJobName, QueueName } from 'shared';

const globalKey = Symbol.for('erm.metrics.register');
const globalSymbols = globalThis as unknown as Record<symbol, client.Registry>;

export const register: client.Registry =
  globalSymbols[globalKey] ||
  (globalSymbols[globalKey] = new client.Registry());

const isJest =
  typeof process !== 'undefined' &&
  (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined);

let defaultMetricsInterval: NodeJS.Timeout | undefined;
if (!isJest) {
  defaultMetricsInterval = client.collectDefaultMetrics({ register }) as
    | NodeJS.Timeout
    | undefined;
  defaultMetricsInterval?.unref?.();
}

const getOrCreateMetric = <T extends client.Metric<string>>(
  name: string,
  factory: () => T,
): T => {
  const existing = register.getSingleMetric(name);
  if (existing) {
    return existing as T;
  }
  return factory();
};

export const httpRequestsTotal = getOrCreateMetric(
  'http_requests_total',
  () =>
    new client.Counter({
      name: 'http_requests_total',
      help: 'Количество HTTP запросов',
      labelNames: ['method', 'route', 'status'],
      registers: [register],
    }),
);

export const httpRequestDuration = getOrCreateMetric(
  'http_request_duration_seconds',
  () =>
    new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Длительность HTTP запросов в секундах',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.05, 0.1, 0.3, 0.5, 1, 3, 5],
      registers: [register],
    }),
);

export const osrmRequestDuration = getOrCreateMetric(
  'osrm_request_duration_seconds',
  () =>
    new client.Histogram({
      name: 'osrm_request_duration_seconds',
      help: 'Длительность запросов к OSRM',
      labelNames: ['endpoint', 'status'],
      buckets: [0.05, 0.1, 0.3, 0.5, 1, 3, 5],
      registers: [register],
    }),
);

export const osrmErrorsTotal = getOrCreateMetric(
  'osrm_errors_total',
  () =>
    new client.Counter({
      name: 'osrm_errors_total',
      help: 'Ошибки запросов к OSRM',
      labelNames: ['endpoint', 'reason'],
      registers: [register],
    }),
);

export const fleetRecoveryFailuresTotal = getOrCreateMetric(
  'fleet_recovery_failures_total',
  () =>
    new client.Counter({
      name: 'fleet_recovery_failures_total',
      help: 'Неудачные попытки восстановления флота из коллекции',
      labelNames: ['reason'],
      registers: [register],
    }),
);

export type BullMqJobStatus = 'completed' | 'failed' | 'timeout';

export type BullMqErrorClass =
  | 'timeout'
  | 'redis'
  | 'validation'
  | 'upstream'
  | 'unknown';

export const bullmqJobsProcessedTotal = getOrCreateMetric(
  'bullmq_jobs_processed_total',
  () =>
    new client.Counter({
      name: 'bullmq_jobs_processed_total',
      help: 'Количество обработанных задач BullMQ по итоговому статусу',
      labelNames: ['queue', 'job', 'status', 'error_class'],
      registers: [register],
    }),
);

export const bullmqJobWaitDurationSeconds = getOrCreateMetric(
  'bullmq_job_wait_duration_seconds',
  () =>
    new client.Histogram({
      name: 'bullmq_job_wait_duration_seconds',
      help: 'Время ожидания результата задачи BullMQ (E2E wait)',
      labelNames: ['queue', 'job', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5, 10, 30, 60],
      registers: [register],
    }),
);

export const bullmqJobProcessingDurationSeconds = getOrCreateMetric(
  'bullmq_job_processing_duration_seconds',
  () =>
    new client.Histogram({
      name: 'bullmq_job_processing_duration_seconds',
      help: 'Время обработки задачи воркером BullMQ',
      labelNames: ['queue', 'job', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5, 10, 30, 60],
      registers: [register],
    }),
);

export const osrmPrecheckFailuresTotal = getOrCreateMetric(
  'osrm_precheck_failures_total',
  () =>
    new client.Counter({
      name: 'osrm_precheck_failures_total',
      help: 'Ошибки локального precheck перед вызовом OSRM',
      labelNames: ['endpoint', 'reason'],
      registers: [register],
    }),
);

export const taskPointsValidationFailuresTotal = getOrCreateMetric(
  'task_points_validation_failures_total',
  () =>
    new client.Counter({
      name: 'task_points_validation_failures_total',
      help: 'Ошибки валидации points во входном payload задачи',
      labelNames: ['code'],
      registers: [register],
    }),
);

export const normalizeBullMqErrorClass = (error: unknown): BullMqErrorClass => {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`.toLowerCase()
      : String(error ?? '').toLowerCase();

  if (message.includes('timeout')) return 'timeout';
  if (
    message.includes('redis') ||
    message.includes('econnrefused') ||
    message.includes('connection is closed')
  ) {
    return 'redis';
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return 'validation';
  }
  if (message.includes('osrm') || message.includes('upstream')) {
    return 'upstream';
  }
  return 'unknown';
};

const enumValues = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') {
    return [];
  }
  return Object.values(value).filter(
    (item): item is string => typeof item === 'string',
  );
};

export const BULLMQ_LABELS = {
  queues: enumValues(QueueName),
  jobs: enumValues(QueueJobName),
} as const;
