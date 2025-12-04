// Назначение: загрузка конфигурации воркера BullMQ
// Основные модули: dotenv, process
import path from 'node:path';
import dotenv from 'dotenv';
import { PROJECT_TIMEZONE } from 'shared';
import { logger } from './logger';

if (!process.env.TZ) {
  process.env.TZ = PROJECT_TIMEZONE;
}

dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') });

type RedisConnection = {
  url: string;
};

type GeocoderProvider = 'nominatim' | 'openrouteservice';

const detectGeocoderProvider = (url: string): GeocoderProvider => {
  const normalized = url.toLowerCase();
  if (normalized.includes('openrouteservice')) {
    return 'openrouteservice';
  }
  return 'nominatim';
};

const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value) {
    return fallback;
  }
  const normalized = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return fallback;
  }
  return normalized;
};

const redisUrlRaw = (process.env.QUEUE_REDIS_URL || '').trim();
if (!redisUrlRaw) {
  throw new Error('QUEUE_REDIS_URL обязателен для запуска воркера BullMQ');
}

let redisUrl: string;
try {
  const parsed = new URL(redisUrlRaw);
  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error(
      'QUEUE_REDIS_URL должен начинаться с redis:// или rediss://',
    );
  }
  redisUrl = parsed.toString();
} catch (error) {
  throw new Error(
    `QUEUE_REDIS_URL имеет неверный формат: ${String(
      error instanceof Error ? error.message : error,
    )}`,
  );
}

const geocoderEnabledFlag =
  (process.env.GEOCODER_ENABLED || '1').trim() !== '0';
const geocoderUrlRaw = (process.env.GEOCODER_URL || '').trim();
let geocoderBaseUrl = '';
let geocoderProvider: GeocoderProvider = 'nominatim';
if (geocoderEnabledFlag && geocoderUrlRaw) {
  try {
    const parsed = new URL(geocoderUrlRaw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('нужен http(s) URL для геокодера');
    }
    geocoderBaseUrl = parsed.toString();
    geocoderProvider = detectGeocoderProvider(geocoderBaseUrl);
  } catch (error) {
    logger.warn(
      {
        error,
      },
      'Геокодер отключён из-за неверного GEOCODER_URL',
    );
  }
}

const geocoderUserAgentRaw = (process.env.GEOCODER_USER_AGENT || '').trim();
const geocoderUserAgent = geocoderUserAgentRaw || 'ERM Logistics geocoder';
const geocoderEmailRaw = (process.env.GEOCODER_EMAIL || '').trim();
const geocoderEmail = geocoderEmailRaw || undefined;
const geocoderApiKeyRaw = (
  process.env.GEOCODER_API_KEY ||
  process.env.ORS_API_KEY ||
  ''
).trim();
const geocoderApiKey = geocoderApiKeyRaw || undefined;

if (geocoderProvider === 'openrouteservice' && !geocoderApiKey) {
  logger.warn(
    'Геокодер отключён: отсутствует GEOCODER_API_KEY или ORS_API_KEY',
  );
}

const routingUrlRaw = (process.env.ROUTING_URL || '').trim();
if (!routingUrlRaw) {
  throw new Error('ROUTING_URL обязателен для задач маршрутизации');
}

let routingBaseUrl: string;
try {
  const parsed = new URL(routingUrlRaw);
  routingBaseUrl = parsed.toString();
} catch (error) {
  throw new Error(
    `ROUTING_URL имеет неверный формат: ${String(
      error instanceof Error ? error.message : error,
    )}`,
  );
}

const osrmAlgorithmRaw = (process.env.OSRM_ALGORITHM || '').trim();

export const workerConfig = {
  connection: { url: redisUrl } satisfies RedisConnection,
  prefix: (process.env.QUEUE_PREFIX || 'erm').trim() || 'erm',
  attempts: parsePositiveInt(process.env.QUEUE_ATTEMPTS, 3),
  backoffMs: parsePositiveInt(process.env.QUEUE_BACKOFF_MS, 5000),
  concurrency: parsePositiveInt(process.env.QUEUE_CONCURRENCY, 4),
  geocoder: {
    enabled:
      geocoderEnabledFlag &&
      Boolean(geocoderBaseUrl) &&
      (geocoderProvider !== 'openrouteservice' || Boolean(geocoderApiKey)),
    baseUrl: geocoderBaseUrl,
    userAgent: geocoderUserAgent,
    email: geocoderEmail,
    apiKey: geocoderApiKey,
    provider: geocoderProvider,
  },
  routing: {
    enabled: Boolean(routingBaseUrl),
    baseUrl: routingBaseUrl,
    algorithm: osrmAlgorithmRaw || undefined,
  },
} as const;

export type WorkerConfig = typeof workerConfig;
