// Назначение: конфигурация подключения к очередям BullMQ
// Основные модули: process

type RedisConnection = {
  url: string;
};

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

const redisUrlRaw = normalizeEnvValue(process.env.QUEUE_REDIS_URL);
let redisUrl: string | null = null;
if (redisUrlRaw) {
  try {
    const parsed = new URL(redisUrlRaw);
    if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
      throw new Error(
        'QUEUE_REDIS_URL должен начинаться с redis:// или rediss://',
      );
    }
    redisUrl = parsed.toString();
  } catch (error) {
    console.warn(
      'Очереди BullMQ отключены из-за неверного QUEUE_REDIS_URL:',
      error,
    );
  }
}

const prefixRaw = normalizeEnvValue(process.env.QUEUE_PREFIX) || 'erm';
const prefix = prefixRaw || 'erm';
const reconnectCooldownMs = parsePositiveInt(
  process.env.QUEUE_RECONNECT_COOLDOWN_MS,
  60000,
);

let queueReconnectTimer: NodeJS.Timeout | null = null;
let reconnectAt = 0;

const clearReconnectTimer = (): void => {
  if (queueReconnectTimer) {
    clearTimeout(queueReconnectTimer);
    queueReconnectTimer = null;
  }
};

export const queueConfig = {
  enabled: Boolean(redisUrl),
  connection: redisUrl ? ({ url: redisUrl } satisfies RedisConnection) : null,
  prefix,
  attempts: parsePositiveInt(process.env.QUEUE_ATTEMPTS, 3),
  backoffMs: parsePositiveInt(process.env.QUEUE_BACKOFF_MS, 5000),
  jobTimeoutMs: parsePositiveInt(process.env.QUEUE_JOB_TIMEOUT_MS, 30000),
  metricsIntervalMs: parsePositiveInt(
    process.env.QUEUE_METRICS_INTERVAL_MS,
    15000,
  ),
  reconnectCooldownMs,
};

export const isQueueAvailable = (): boolean => {
  if (!queueConfig.connection) {
    return false;
  }
  if (!queueConfig.enabled && reconnectAt > 0 && Date.now() >= reconnectAt) {
    reconnectAt = 0;
    queueConfig.enabled = true;
    clearReconnectTimer();
  }
  return queueConfig.enabled;
};

export const markQueueUnavailable = (): void => {
  if (!queueConfig.connection) {
    queueConfig.enabled = false;
    reconnectAt = 0;
    clearReconnectTimer();
    return;
  }

  queueConfig.enabled = false;
  reconnectAt = Date.now() + queueConfig.reconnectCooldownMs;
  clearReconnectTimer();
  queueReconnectTimer = setTimeout(() => {
    reconnectAt = 0;
    queueConfig.enabled = true;
    queueReconnectTimer = null;
  }, queueConfig.reconnectCooldownMs);
  queueReconnectTimer.unref?.();
};

export const markQueueAvailable = (): void => {
  if (!queueConfig.connection) {
    queueConfig.enabled = false;
    reconnectAt = 0;
    clearReconnectTimer();
    return;
  }

  queueConfig.enabled = true;
  reconnectAt = 0;
  clearReconnectTimer();
};

export const __resetQueueAvailabilityForTests = (): void => {
  queueConfig.enabled = Boolean(queueConfig.connection);
  reconnectAt = 0;
  clearReconnectTimer();
};

export type QueueConfig = typeof queueConfig;
