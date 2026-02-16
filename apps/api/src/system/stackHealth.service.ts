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

const pickMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Неизвестная ошибка';
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
        durationMs: Math.round(performance.now() - startedAt),
        meta: {
          ...report.metadata,
          checkedAt: report.checkedAt,
          s3Status: report.status,
          error: report.error,
          hint:
            status === 'warn'
              ? 'S3 не настроен: заполните S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY.'
              : undefined,
        },
      } satisfies StackCheckResult;
    } catch (error: unknown) {
      return {
        name: 's3',
        status: 'error',
        durationMs: Math.round(performance.now() - startedAt),
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

      if (readBack !== 'ok') {
        throw new Error('Контрольная запись /storage не совпала');
      }

      return {
        name: 'storage',
        status: 'ok',
        durationMs: Math.round(performance.now() - startedAt),
        meta: {
          directory: root,
          hint: 'Локальное хранилище доступно для чтения и записи.',
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
        durationMs: Math.round(performance.now() - startedAt),
        message: pickMessage(error),
        meta: {
          directory: root,
          hint: 'Проверьте монтирование STORAGE_DIR и права на запись для процесса API.',
        },
      } satisfies StackCheckResult;
    }
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
          durationMs: Math.round(performance.now() - startedAt),
          message: `Неожиданный ответ PING: ${ping}`,
        } satisfies StackCheckResult;
      }

      const memoryInfo = await client.info('memory');
      const keyspaceInfo = await client.info('keyspace');
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
        durationMs: Math.round(performance.now() - startedAt),
        meta: {
          cacheCount,
          lockCount,
          queues,
          memoryInfo: memoryInfo.slice(0, 400),
          keyspaceInfo,
        },
      } satisfies StackCheckResult;
    } catch (error: unknown) {
      return {
        name: 'redis',
        status: 'error',
        durationMs: Math.round(performance.now() - startedAt),
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

  async checkMongo(): Promise<StackCheckResult> {
    const startedAt = performance.now();
    try {
      const connection = await connect();
      const db = connection.db;
      if (!db) {
        return {
          name: 'mongo',
          status: 'error',
          durationMs: Math.round(performance.now() - startedAt),
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
        durationMs: Math.round(performance.now() - startedAt),
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
        durationMs: Math.round(performance.now() - startedAt),
        message: pickMessage(error),
      } satisfies StackCheckResult;
    }
  }

  async run(options: StackHealthOptions): Promise<StackHealthReport> {
    const s3Result = await this.checkS3();
    const storageResult = await this.checkStorage();

    const redisResult = await this.checkRedis({
      redisUrl: options.redisUrl,
      queuePrefix: options.queuePrefix ?? queueConfig.prefix,
      queueNames: options.queueNames ?? [
        QueueName.LogisticsGeocoding,
        QueueName.LogisticsRouting,
      ],
    });

    const mongoResult = await this.checkMongo();

    const results = [s3Result, storageResult, redisResult, mongoResult];
    const aggregateStatus = getAggregateStatus(results);
    const ok = aggregateStatus !== 'error';

    for (const item of results) {
      stackHealthCheckStatusGauge
        .labels(item.name)
        .set(STATUS_TO_METRIC[item.status]);
      if (typeof item.durationMs === 'number') {
        stackHealthCheckDurationGauge.labels(item.name).set(item.durationMs);
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
