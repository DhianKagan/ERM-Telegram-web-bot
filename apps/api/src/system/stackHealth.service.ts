// Назначение: проверки доступности инфраструктурных компонентов (прокси, Redis, MongoDB)
// Основные модули: undici/fetch, redis, mongoose, BullMQ конфигурация
import { fetch } from 'undici';
import { performance } from 'node:perf_hooks';
import { createClient, type RedisClientType } from 'redis';
import mongoose from 'mongoose';
import { QueueName } from 'shared';
import connect from '../db/connection';
import { queueConfig } from '../config/queue';

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
  proxyUrl?: string;
  proxyToken?: string;
  redisUrl?: string;
  queuePrefix?: string;
  queueNames?: QueueName[];
};

const REQUEST_TIMEOUT_MS = 10_000;
const SAMPLE_QUERY = 'ул Ленина 1 Киев';
const ROUTE_START = '30.708021,46.3939888';
const ROUTE_END = '30.7124526,46.4206201';

const pickMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Неизвестная ошибка';
};

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const parseJsonSafe = (payload: string): unknown => {
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
};

const countKeys = async (
  client: RedisClientType,
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
    cursor = Number.parseInt(scanResult.cursor, 10);
    if (!Number.isFinite(cursor) || cursor === 0) {
      break;
    }
  }
  return total;
};

const readListLength = async (
  client: RedisClientType,
  key: string,
): Promise<number> => {
  const keyType = await client.type(key);
  if (keyType !== 'list' && keyType !== 'stream') {
    return 0;
  }
  try {
    return await client.llen(key);
  } catch {
    return 0;
  }
};

export default class StackHealthService {
  async checkProxy(options: {
    proxyUrl?: string;
    proxyToken?: string;
  }): Promise<StackCheckResult> {
    const startedAt = performance.now();
    const { proxyUrl, proxyToken } = options;
    if (!proxyUrl || !proxyToken) {
      return {
        name: 'proxy',
        status: 'warn',
        message: 'Прокси не настроен',
      } satisfies StackCheckResult;
    }

    const headers = {
      'X-Proxy-Token': proxyToken,
      'User-Agent': 'ERM-healthcheck',
    } as const;

    try {
      const healthResponse = await fetchWithTimeout(
        `${proxyUrl}/health`,
        { method: 'GET', headers },
        REQUEST_TIMEOUT_MS,
      );
      if (healthResponse.status !== 200) {
        return {
          name: 'proxy',
          status: 'error',
          durationMs: Math.round(performance.now() - startedAt),
          message: `Статус /health: ${healthResponse.status}`,
        } satisfies StackCheckResult;
      }

      const searchResponse = await fetchWithTimeout(
        `${proxyUrl}/search?q=${encodeURIComponent(SAMPLE_QUERY)}`,
        { method: 'GET', headers },
        REQUEST_TIMEOUT_MS,
      );
      const searchBody = await searchResponse.text();
      if (searchResponse.status !== 200) {
        return {
          name: 'proxy',
          status: 'error',
          durationMs: Math.round(performance.now() - startedAt),
          message: `Статус /search: ${searchResponse.status}`,
        } satisfies StackCheckResult;
      }

      const parsed = parseJsonSafe(searchBody);
      const looksValid = Array.isArray(parsed)
        ? parsed.length > 0
        : typeof parsed === 'object' && parsed !== null;
      if (!looksValid) {
        return {
          name: 'proxy',
          status: 'warn',
          durationMs: Math.round(performance.now() - startedAt),
          message: 'Ответ /search не похож на ожидаемый JSON',
          meta: { sample: searchBody.slice(0, 200) },
        } satisfies StackCheckResult;
      }

      const routeResponse = await fetchWithTimeout(
        `${proxyUrl}/route?start=${ROUTE_START}&end=${ROUTE_END}`,
        { method: 'GET', headers },
        REQUEST_TIMEOUT_MS,
      );
      if (routeResponse.status !== 200) {
        return {
          name: 'proxy',
          status: 'warn',
          durationMs: Math.round(performance.now() - startedAt),
          message: `Статус /route: ${routeResponse.status}`,
        } satisfies StackCheckResult;
      }

      return {
        name: 'proxy',
        status: 'ok',
        durationMs: Math.round(performance.now() - startedAt),
        meta: { searchSample: searchBody.slice(0, 200) },
      } satisfies StackCheckResult;
    } catch (error: unknown) {
      return {
        name: 'proxy',
        status: 'error',
        durationMs: Math.round(performance.now() - startedAt),
        message: pickMessage(error),
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
    const proxyResult = await this.checkProxy({
      proxyToken: options.proxyToken,
      proxyUrl: options.proxyUrl,
    });

    const redisResult = await this.checkRedis({
      redisUrl: options.redisUrl,
      queuePrefix: options.queuePrefix ?? queueConfig.prefix,
      queueNames: options.queueNames ?? [
        QueueName.LogisticsGeocoding,
        QueueName.LogisticsRouting,
      ],
    });

    const mongoResult = await this.checkMongo();

    const results = [proxyResult, redisResult, mongoResult];
    const ok = results.every((item) => item.status !== 'error');

    return {
      ok,
      timestamp: new Date().toISOString(),
      results,
    } satisfies StackHealthReport;
  }
}
