// apps/worker/src/config.ts
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

const normalizeEnvValue = (value: string | undefined): string => {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/^(['"])(.*)\1$/, '$2').trim();
};

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

const parseBoundedPositiveInt = (
  value: string | undefined,
  fallback: number,
  max: number,
  fieldName: string,
): number => {
  const parsed = parsePositiveInt(value, fallback);
  if (parsed > max) {
    logger.warn(
      { fieldName, parsed, max },
      'Значение превышает безопасный предел; используется ограничение',
    );
    return max;
  }
  return parsed;
};

const redisUrlRaw = normalizeEnvValue(process.env.QUEUE_REDIS_URL);
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
  normalizeEnvValue(process.env.GEOCODER_ENABLED) !== '0';
const geocoderUrlRaw = normalizeEnvValue(process.env.GEOCODER_URL);
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

const geocoderUserAgentRaw = normalizeEnvValue(process.env.GEOCODER_USER_AGENT);
const geocoderUserAgent = geocoderUserAgentRaw || 'ERM Logistics geocoder';
const geocoderEmailRaw = normalizeEnvValue(process.env.GEOCODER_EMAIL);
const geocoderEmail = geocoderEmailRaw || undefined;
const geocoderApiKeyRaw = normalizeEnvValue(
  process.env.GEOCODER_API_KEY || process.env.ORS_API_KEY,
);
const geocoderApiKey = geocoderApiKeyRaw || undefined;
const geocoderProxyTokenRaw = normalizeEnvValue(
  process.env.GEOCODER_PROXY_TOKEN || process.env.PROXY_TOKEN,
);
const geocoderProxyToken = geocoderProxyTokenRaw || undefined;

if (geocoderProvider === 'openrouteservice' && !geocoderApiKey) {
  logger.warn(
    'Геокодер отключён: отсутствует GEOCODER_API_KEY или ORS_API_KEY',
  );
}

// --- Изменённая логика: ROUTING_URL теперь опционален ---
// Если переменной нет или формат некорректный — маршрутизация отключается и логируется.
const routingUrlRaw = normalizeEnvValue(process.env.ROUTING_URL);
let routingBaseUrl: string | undefined;
if (!routingUrlRaw) {
  logger.info('ROUTING_URL не задан; функциональность маршрутизации отключена');
  routingBaseUrl = undefined;
} else {
  try {
    const parsed = new URL(routingUrlRaw);
    routingBaseUrl = parsed.toString();
  } catch (error) {
    logger.warn(
      { error },
      'ROUTING_URL имеет неверный формат; функциональность маршрутизации отключена',
    );
    routingBaseUrl = undefined;
  }
}

const osrmAlgorithmRaw = normalizeEnvValue(process.env.OSRM_ALGORITHM);

// ---- НОВОЕ: token для маршрутизации (если нужно аутентифицировать вызовы маршрутизации) ----
// Читаем либо GEOCODER_PROXY_TOKEN (часто используют для прокси), либо PROXY_TOKEN
const routingProxyTokenRaw = normalizeEnvValue(
  process.env.GEOCODER_PROXY_TOKEN || process.env.PROXY_TOKEN,
);
const routingProxyToken = routingProxyTokenRaw || undefined;
// -------------------------------------------------------------------------------------------

export const workerConfig = {
  connection: { url: redisUrl } satisfies RedisConnection,
  prefix: normalizeEnvValue(process.env.QUEUE_PREFIX) || 'erm',
  attempts: parsePositiveInt(process.env.QUEUE_ATTEMPTS, 3),
  backoffMs: parsePositiveInt(process.env.QUEUE_BACKOFF_MS, 5000),
  concurrency: parseBoundedPositiveInt(
    process.env.QUEUE_CONCURRENCY,
    2,
    8,
    'QUEUE_CONCURRENCY',
  ),
  geocoder: {
    enabled:
      geocoderEnabledFlag &&
      Boolean(geocoderBaseUrl) &&
      (geocoderProvider !== 'openrouteservice' || Boolean(geocoderApiKey)),
    baseUrl: geocoderBaseUrl,
    userAgent: geocoderUserAgent,
    email: geocoderEmail,
    apiKey: geocoderApiKey,
    proxyToken: geocoderProxyToken,
    provider: geocoderProvider,
  },
  routing: {
    enabled: Boolean(routingBaseUrl),
    baseUrl: routingBaseUrl,
    algorithm: osrmAlgorithmRaw || undefined,
    // ==== прокс-токен, который будет использоваться при вызовах маршрутизации ====
    proxyToken: routingProxyToken,
    // ===========================================================================
  },
} as const;

export type WorkerConfig = typeof workerConfig;
