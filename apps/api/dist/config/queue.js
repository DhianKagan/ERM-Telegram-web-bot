"use strict";
// Назначение: конфигурация подключения к очередям BullMQ
// Основные модули: process
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueConfig = void 0;
const parsePositiveInt = (value, fallback) => {
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
let redisUrl = null;
if (redisUrlRaw) {
    try {
        const parsed = new URL(redisUrlRaw);
        if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
            throw new Error('QUEUE_REDIS_URL должен начинаться с redis:// или rediss://');
        }
        redisUrl = parsed.toString();
    }
    catch (error) {
        console.warn('Очереди BullMQ отключены из-за неверного QUEUE_REDIS_URL:', error);
    }
}
const prefixRaw = (process.env.QUEUE_PREFIX || 'erm').trim();
const prefix = prefixRaw || 'erm';
exports.queueConfig = {
    enabled: Boolean(redisUrl),
    connection: redisUrl ? { url: redisUrl } : null,
    prefix,
    attempts: parsePositiveInt(process.env.QUEUE_ATTEMPTS, 3),
    backoffMs: parsePositiveInt(process.env.QUEUE_BACKOFF_MS, 5000),
    jobTimeoutMs: parsePositiveInt(process.env.QUEUE_JOB_TIMEOUT_MS, 30000),
    metricsIntervalMs: parsePositiveInt(process.env.QUEUE_METRICS_INTERVAL_MS, 15000),
};
