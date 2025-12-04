// Назначение: проверки доступности инфраструктурных компонентов (прокси, Redis, MongoDB)
// Основные модули: undici/fetch, redis, mongoose, BullMQ конфигурация
import { fetch, type RequestInit, type Response } from 'undici';
import { performance } from 'node:perf_hooks';
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
  proxySource?: string;
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

const cutSnippet = (payload: string, limit = 500): string => {
  if (payload.length <= limit) {
    return payload;
  }
  return `${payload.slice(0, limit)}… (обрезано)`;
};

const proxyHintByStatus = (status: number, endpoint: string): string => {
  if (status === 401 || status === 403) {
    return 'Токен прокси отклонён: сверните PROXY_TOKEN/GEOCODER_PROXY_TOKEN и заголовок X-Proxy-Token на стороне сервиса.';
  }
  if (status === 404) {
    return `Маршрут ${endpoint} не найден: проверьте базовый URL прокси и префиксы публикации.`;
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'Прокси не добрался до бекенда: проверьте доступность OSRM/ORS и сетевые правила.';
  }
  if (status >= 500) {
    return 'Прокси вернул 5xx: загляните в логи прокси и upsteam сервисов, проверьте переменные окружения.';
  }
  if (status >= 400) {
    return 'Прокси отвечает 4xx: убедитесь в корректности запроса и валидности токена.';
  }
  return 'Неожиданный код ответа: проверьте сетевой путь до прокси и его конфигурацию.';
};

const readBodySafe = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch (error: unknown) {
    return `Не удалось прочитать тело: ${pickMessage(error)}`;
  }
};

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const initWithSignal: RequestInit = { ...init, signal: controller.signal };
    return await fetch(url, initWithSignal);
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
  async checkProxy(options: {
    proxyUrl?: string;
    proxySource?: string;
    proxyToken?: string;
  }): Promise<StackCheckResult> {
    const startedAt = performance.now();
    const { proxyUrl, proxyToken, proxySource } = options;
    if (!proxyUrl || !proxyToken) {
      return {
        name: 'proxy',
        status: 'warn',
        message: 'Прокси не настроен',
        meta: {
          hint: 'Добавьте PROXY_PRIVATE_URL/GEOCODER_URL и PROXY_TOKEN (или GEOCODER_PROXY_URL/GEOCODER_PROXY_TOKEN) в переменные окружения.',
          source: proxySource ?? 'не задан',
        },
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
        const body = await readBodySafe(healthResponse);
        return {
          name: 'proxy',
          status: 'error',
          durationMs: Math.round(performance.now() - startedAt),
          message: `Статус /health: ${healthResponse.status}`,
          meta: {
            endpoint: '/health',
            status: healthResponse.status,
            body: cutSnippet(body),
            hint: proxyHintByStatus(healthResponse.status, '/health'),
            tokenSent: Boolean(proxyToken),
            proxyUrl,
            source: proxySource,
          },
        } satisfies StackCheckResult;
      }

      const searchResponse = await fetchWithTimeout(
        `${proxyUrl}/search?q=${encodeURIComponent(SAMPLE_QUERY)}`,
        { method: 'GET', headers },
        REQUEST_TIMEOUT_MS,
      );
      const searchBody = await readBodySafe(searchResponse);
      if (searchResponse.status !== 200) {
        return {
          name: 'proxy',
          status: 'error',
          durationMs: Math.round(performance.now() - startedAt),
          message: `Статус /search: ${searchResponse.status}`,
          meta: {
            endpoint: '/search',
            status: searchResponse.status,
            body: cutSnippet(searchBody),
            hint: proxyHintByStatus(searchResponse.status, '/search'),
            sample: SAMPLE_QUERY,
            source: proxySource,
          },
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
          meta: {
            sample: cutSnippet(searchBody),
            endpoint: '/search',
            hint: 'Геокодер возвращает неожиданный ответ: проверьте конфигурацию прокси и upstream-геокодера (часто мешают HTML-страницы ошибок).',
            source: proxySource,
          },
        } satisfies StackCheckResult;
      }

      const routeResponse = await fetchWithTimeout(
        `${proxyUrl}/route?start=${ROUTE_START}&end=${ROUTE_END}`,
        { method: 'GET', headers },
        REQUEST_TIMEOUT_MS,
      );
      if (routeResponse.status !== 200) {
        const routeBody = await readBodySafe(routeResponse);
        return {
          name: 'proxy',
          status: 'warn',
          durationMs: Math.round(performance.now() - startedAt),
          message: `Статус /route: ${routeResponse.status}`,
          meta: {
            endpoint: '/route',
            status: routeResponse.status,
            body: cutSnippet(routeBody),
            hint: 'Маршрутизация недоступна: убедитесь, что OSRM/ORS принимает запросы и маршрутные данные загружены.',
            start: ROUTE_START,
            end: ROUTE_END,
            source: proxySource,
          },
        } satisfies StackCheckResult;
      }

      return {
        name: 'proxy',
        status: 'ok',
        durationMs: Math.round(performance.now() - startedAt),
        meta: {
          searchSample: cutSnippet(searchBody, 200),
          hint: 'Прокси отвечает корректно: проверьте маршрутизацию, если проблемы сохраняются на стороне клиентов.',
          source: proxySource,
        },
      } satisfies StackCheckResult;
    } catch (error: unknown) {
      return {
        name: 'proxy',
        status: 'error',
        durationMs: Math.round(performance.now() - startedAt),
        message: pickMessage(error),
        meta: {
          hint: 'Проверка прокси не завершилась: убедитесь в доступности URL и отсутствии блокировок сети/файрвола.',
          source: proxySource,
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
    const proxyResult = await this.checkProxy({
      proxyToken: options.proxyToken,
      proxyUrl: options.proxyUrl,
      proxySource: options.proxySource,
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
