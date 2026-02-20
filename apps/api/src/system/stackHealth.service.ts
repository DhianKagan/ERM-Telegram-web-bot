// Назначение: проверки доступности инфраструктурных компонентов (S3, storage, Redis, MongoDB)
// Основные модули: fs/promises, redis, mongoose, BullMQ конфигурация
import { performance } from 'node:perf_hooks';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createClient,
  type RedisClientType,
  type RedisFunctions,
  type RedisModules,
  type RedisScripts,
} from 'redis';
import mongoose from 'mongoose';
import { QueueName } from 'shared';
import connect from '../db/connection';
import { queueConfig } from '../config/queue';
import { uploadsDir } from '../config/storage';
import { runS3Healthcheck } from '../services/s3Health';
import { getQueueBundle } from '../queues/taskQueue';
import { register } from '../metrics';
import client from 'prom-client';

export type StackCheckStatus = 'ok' | 'warn' | 'error';

export type StackCheckResult = {
  name: string;
  status: StackCheckStatus;
  durationMs?: number;
  message?: string;
  meta?: Record<string, unknown>;
};

export type StackHealthReport = {
  ok: boolean;
  timestamp: string;
  results: StackCheckResult[];
};

type StackHealthOptions = {
  redisUrl?: string;
  queuePrefix?: string;
  queueNames?: QueueName[];
  remoteServices?: RemoteHealthTarget[];
};

export type RemoteHealthTarget = {
  name: string;
  url: string;
  timeoutMs?: number;
};

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

const stackHealthStatusGauge = getOrCreateMetric(
  'stack_health_status',
  () =>
    new client.Gauge({
      name: 'stack_health_status',
      help: 'Сводный статус healthcheck (0=ok,1=warn,2=error)',
      registers: [register],
    }),
);

const stackHealthCheckStatusGauge = getOrCreateMetric(
  'stack_health_check_status',
  () =>
    new client.Gauge({
      name: 'stack_health_check_status',
      help: 'Статус проверки компонента (0=ok,1=warn,2=error)',
      labelNames: ['component'],
      registers: [register],
    }),
);

const stackHealthCheckDurationGauge = getOrCreateMetric(
  'stack_health_check_duration_ms',
  () =>
    new client.Gauge({
      name: 'stack_health_check_duration_ms',
      help: 'Длительность проверки компонента в миллисекундах',
      labelNames: ['component'],
      registers: [register],
    }),
);

const dependencyCheckDuration = getOrCreateMetric(
  'stack_dependency_check_duration_seconds',
  () =>
    new client.Histogram({
      name: 'stack_dependency_check_duration_seconds',
      help: 'Длительность проверок зависимостей в секундах',
      labelNames: ['component', 'status'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 1, 3, 5],
      registers: [register],
    }),
);

const dependencyErrorsTotal = getOrCreateMetric(
  'stack_dependency_errors_total',
  () =>
    new client.Counter({
      name: 'stack_dependency_errors_total',
      help: 'Количество ошибок проверок зависимостей',
      labelNames: ['component'],
      registers: [register],
    }),
);

const pickMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Неизвестная ошибка';
};

const measureDurationMs = (startedAt: number): number =>
  Math.max(1, Math.round(performance.now() - startedAt));

const normalizeDurationMs = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.round(value));
};

const STATUS_TO_METRIC: Record<StackCheckStatus, number> = {
  ok: 0,
  warn: 1,
  error: 2,
};

const getAggregateStatus = (results: StackCheckResult[]): StackCheckStatus => {
  if (results.some((item) => item.status === 'error')) {
    return 'error';
  }
  if (results.some((item) => item.status === 'warn')) {
    return 'warn';
  }
  return 'ok';
};

const countKeys = async <
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
>(
  client: RedisClientType<M, F, S>,
  pattern: string,
  count = 200,
): Promise<number> => {
  let cursor = 0;
  let total = 0;

  while (true) {
    const scanResult = await client.scan(cursor, {
      MATCH: pattern,
      COUNT: count,
    });
    total += scanResult.keys.length;
    cursor = scanResult.cursor;
    if (!Number.isFinite(cursor) || cursor === 0) {
      break;
    }
  }
  return total;
};

const readListLength = async <
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
>(
  client: RedisClientType<M, F, S>,
  key: string,
): Promise<number> => {
  const keyType = await client.type(key);
  if (keyType !== 'list' && keyType !== 'stream') {
    return 0;
  }
  try {
    return await client.lLen(key);
  } catch {
    return 0;
  }
};

export default class StackHealthService {
  async checkS3(): Promise<StackCheckResult> {
    const startedAt = performance.now();
    try {
      const report = await runS3Healthcheck();
      const status: StackCheckStatus =
        report.status === 'ok'
          ? 'ok'
          : report.metadata.configured
            ? 'error'
            : 'warn';
      return {
        name: 's3',
        status,
        durationMs: normalizeDurationMs(
          report.latencyMs,
          measureDurationMs(startedAt),
        ),
        meta: {
          ...report.metadata,
          checkedAt: report.checkedAt,
          s3Status: report.status,
          error: report.error,
          hint:
            status === 'warn'
              ? 'S3 не настроен: заполните S3_ENDPOINT/S3_REGION/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY/S3_FORCE_PATH_STYLE.'
              : undefined,
        },
      } satisfies StackCheckResult;
    } catch (error: unknown) {
      return {
        name: 's3',
        status: 'error',
        durationMs: measureDurationMs(startedAt),
        message: pickMessage(error),
      } satisfies StackCheckResult;
    }
  }

  async checkStorage(): Promise<StackCheckResult> {
    const startedAt = performance.now();
    const root = path.resolve(uploadsDir);
    const tempName = `.health-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`;
    const tempPath = path.join(root, tempName);

    try {
      const rootStat = await fs.stat(root);
      if (!rootStat.isDirectory()) {
        throw new Error('STORAGE_DIR существует, но не является директорией');
      }
      await fs.access(root, fs.constants.R_OK | fs.constants.W_OK);
      await fs.writeFile(tempPath, 'ok', { encoding: 'utf8' });
      const readBack = await fs.readFile(tempPath, 'utf8');
      await fs.unlink(tempPath);
      const fsStats = await fs.statfs(root);
      const freeBytes = fsStats.bavail * fsStats.bsize;
      const totalBytes = fsStats.blocks * fsStats.bsize;

      if (readBack !== 'ok') {
        throw new Error('Контрольная запись /storage не совпала');
      }

      return {
        name: 'storage',
        status: 'ok',
        durationMs: measureDurationMs(startedAt),
        meta: {
          directory: root,
          freeBytes,
          totalBytes,
          hint: 'Локальное хранилище API доступно для чтения и записи.',
        },
      } satisfies StackCheckResult;
    } catch (error: unknown) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // игнорируем очистку
      }

      return {
        name: 'storage',
        status: 'error',
        durationMs: measureDurationMs(startedAt),
        message: pickMessage(error),
        meta: {
          directory: root,
          hint: 'Проверьте STORAGE_DIR и права процесса API. Для разделённых сервисов убедитесь, что нужные volume смонтированы в каждом сервисе отдельно.',
        },
      } satisfies StackCheckResult;
    }
  }

  async checkRemoteServices(
    targets: RemoteHealthTarget[],
  ): Promise<StackCheckResult[]> {
    const checks = targets.map(async (target) => {
      const startedAt = performance.now();
      const timeoutMs =
        typeof target.timeoutMs === 'number' &&
        Number.isFinite(target.timeoutMs)
          ? Math.max(1_000, Math.round(target.timeoutMs))
          : 5_000;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(target.url, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeout);

        return {
          name: `service:${target.name}`,
          status: response.ok ? 'ok' : 'error',
          durationMs: measureDurationMs(startedAt),
          message: response.ok
            ? undefined
            : `HTTP ${response.status} ${response.statusText}`,
          meta: {
            url: target.url,
            httpStatus: response.status,
            timeoutMs,
          },
        } satisfies StackCheckResult;
      } catch (error: unknown) {
        clearTimeout(timeout);
        return {
          name: `service:${target.name}`,
          status: 'error',
          durationMs: measureDurationMs(startedAt),
          message: pickMessage(error),
          meta: {
            url: target.url,
            timeoutMs,
            hint: 'Проверьте доступность сервиса, URL и сетевые правила между сервисами.',
          },
        } satisfies StackCheckResult;
      }
    });
    return Promise.all(checks);
  }

  async checkRedis(options: {
    redisUrl?: string;
    queuePrefix?: string;
    queueNames: QueueName[];
  }): Promise<StackCheckResult> {
    const startedAt = performance.now();
    const { redisUrl, queuePrefix, queueNames } = options;
    if (!redisUrl) {
      return {
        name: 'redis',
        status: 'warn',
        message: 'Redis не настроен',
      } satisfies StackCheckResult;
    }

    const client = createClient({ url: redisUrl });
    const prefix = queuePrefix?.trim() || 'erm';
    try {
      await client.connect();
      const ping = await client.ping();
      if (ping !== 'PONG') {
        return {
          name: 'redis',
          status: 'error',
          durationMs: measureDurationMs(startedAt),
          message: `Неожиданный ответ PING: ${ping}`,
        } satisfies StackCheckResult;
      }

      const memoryInfo = await client.info('memory');
      const keyspaceInfo = await client.info('keyspace');
      const clientsInfo = await client.info('clients');
      const usedMemoryMatch = memoryInfo.match(/^used_memory:(\d+)$/m);
      const connectedClientsMatch = clientsInfo.match(
        /^connected_clients:(\d+)$/m,
      );
      const cacheCount = await countKeys(client, 'cache:*');
      const lockCount = await countKeys(client, 'lock:*');

      const queues: Record<string, unknown> = {};
      for (const name of queueNames) {
        const waitKey = `${prefix}:${name}:wait`;
        const activeKey = `${prefix}:${name}:active`;
        const failedKey = `${prefix}:${name}:failed`;
        const waiting = await readListLength(client, waitKey);
        const active = await readListLength(client, activeKey);
        const failed = await readListLength(client, failedKey);
        queues[name] = { waiting, active, failed };
      }

      return {
        name: 'redis',
        status: 'ok',
        durationMs: measureDurationMs(startedAt),
        meta: {
          cacheCount,
          lockCount,
          usedMemoryBytes: usedMemoryMatch ? Number(usedMemoryMatch[1]) : null,
          connectedClients: connectedClientsMatch
            ? Number(connectedClientsMatch[1])
            : null,
          queues,
          memoryInfo: memoryInfo.slice(0, 400),
          keyspaceInfo,
        },
      } satisfies StackCheckResult;
    } catch (error: unknown) {
      return {
        name: 'redis',
        status: 'error',
        durationMs: measureDurationMs(startedAt),
        message: pickMessage(error),
      } satisfies StackCheckResult;
    } finally {
      try {
        await client.disconnect();
      } catch {
        // игнорируем ошибки отключения
      }
    }
  }

  async checkBullmq(options: {
    queueNames: QueueName[];
  }): Promise<StackCheckResult> {
    const startedAt = performance.now();
    if (!queueConfig.connection || !queueConfig.enabled) {
      return {
        name: 'bullmq',
        status: 'warn',
        durationMs: measureDurationMs(startedAt),
        message: 'BullMQ отключен или не настроен',
        meta: {
          enabled: queueConfig.enabled,
          hint: 'Проверьте QUEUE_REDIS_URL и QUEUE_ENABLED, затем перезапустите API/worker.',
        },
      } satisfies StackCheckResult;
    }

    const queueSummaries: Record<string, unknown> = {};
    const problematicQueues: string[] = [];

    try {
      for (const queueName of options.queueNames) {
        const bundle = getQueueBundle(queueName);
        if (!bundle) {
          queueSummaries[queueName] = { enabled: false };
          problematicQueues.push(`${queueName}:unavailable`);
          continue;
        }

        const counts = await bundle.queue.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
          'completed',
        );
        queueSummaries[queueName] = {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          completed: counts.completed ?? 0,
        };

        const failed = counts.failed ?? 0;
        const waiting = counts.waiting ?? 0;
        if (failed > 0) {
          problematicQueues.push(`${queueName}:failed=${failed}`);
        }
        if (queueName === QueueName.DeadLetter && waiting > 0) {
          problematicQueues.push(`${queueName}:waiting=${waiting}`);
        }
      }
      const hasIssues = problematicQueues.length > 0;

      return {
        name: 'bullmq',
        status: hasIssues ? 'warn' : 'ok',
        durationMs: measureDurationMs(startedAt),
        message: hasIssues
          ? `Очереди требуют разбора: ${problematicQueues.join(', ')}`
          : undefined,
        meta: {
          queues: queueSummaries,
          enabled: queueConfig.enabled,
          hint: hasIssues
            ? 'Проверьте /api/v1/system/queues/diagnostics и выполните /api/v1/system/queues/recover (dryRun=true) перед replay/remove.'
            : undefined,
        },
      } satisfies StackCheckResult;
    } catch (error: unknown) {
      return {
        name: 'bullmq',
        status: 'error',
        durationMs: measureDurationMs(startedAt),
        message: pickMessage(error),
      } satisfies StackCheckResult;
    }
  }

  async checkMongo(): Promise<StackCheckResult> {
    const startedAt = performance.now();
    try {
      const connection = await connect();
      const db = connection.db;
      if (!db) {
        return {
          name: 'mongo',
          status: 'error',
          durationMs: measureDurationMs(startedAt),
          message: 'Соединение с MongoDB не готово',
        } satisfies StackCheckResult;
      }
      const stats = await db.stats();
      const collection = db.collection('healthcheck_tmp');
      const inserted = await collection.insertOne({ createdAt: new Date() });
      await collection.deleteOne({ _id: inserted.insertedId });

      return {
        name: 'mongo',
        status: 'ok',
        durationMs: measureDurationMs(startedAt),
        meta: {
          collections: stats.collections,
          dataSize: stats.dataSize,
          readyState: mongoose.connection.readyState,
        },
      } satisfies StackCheckResult;
    } catch (error: unknown) {
      return {
        name: 'mongo',
        status: 'error',
        durationMs: measureDurationMs(startedAt),
        message: pickMessage(error),
      } satisfies StackCheckResult;
    }
  }

  async run(options: StackHealthOptions): Promise<StackHealthReport> {
    const s3Result = await this.checkS3();
    const storageResult = await this.checkStorage();

    const selectedQueueNames = options.queueNames ?? [
      QueueName.LogisticsGeocoding,
      QueueName.LogisticsRouting,
      QueueName.DeadLetter,
    ];

    const redisResult = await this.checkRedis({
      redisUrl: options.redisUrl,
      queuePrefix: options.queuePrefix ?? queueConfig.prefix,
      queueNames: selectedQueueNames,
    });

    const mongoResult = await this.checkMongo();
    const bullmqResult = await this.checkBullmq({
      queueNames: selectedQueueNames,
    });
    const remoteServicesResults = await this.checkRemoteServices(
      options.remoteServices ?? [],
    );

    const results = [
      s3Result,
      storageResult,
      redisResult,
      mongoResult,
      bullmqResult,
      ...remoteServicesResults,
    ];
    const aggregateStatus = getAggregateStatus(results);
    const ok = aggregateStatus !== 'error';

    for (const item of results) {
      stackHealthCheckStatusGauge
        .labels(item.name)
        .set(STATUS_TO_METRIC[item.status]);
      if (typeof item.durationMs === 'number') {
        stackHealthCheckDurationGauge.labels(item.name).set(item.durationMs);
        dependencyCheckDuration
          .labels(item.name, item.status)
          .observe(item.durationMs / 1000);
      }
      if (item.status === 'error') {
        dependencyErrorsTotal.labels(item.name).inc();
      }
    }
    stackHealthStatusGauge.set(STATUS_TO_METRIC[aggregateStatus]);

    return {
      ok,
      timestamp: new Date().toISOString(),
      results,
    } satisfies StackHealthReport;
  }
}
