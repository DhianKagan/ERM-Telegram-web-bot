"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerConfig = void 0;
// apps/worker/src/config.ts
// Назначение: загрузка конфигурации воркера BullMQ
// Основные модули: dotenv, process
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = __importDefault(require("dotenv"));
const shared_1 = require("shared");
const logger_1 = require("./logger");
if (!process.env.TZ) {
    process.env.TZ = shared_1.PROJECT_TIMEZONE;
}
dotenv_1.default.config({ path: node_path_1.default.resolve(__dirname, '../../..', '.env') });
const detectGeocoderProvider = (url) => {
    const normalized = url.toLowerCase();
    if (normalized.includes('openrouteservice')) {
        return 'openrouteservice';
    }
    return 'nominatim';
};
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
if (!redisUrlRaw) {
    throw new Error('QUEUE_REDIS_URL обязателен для запуска воркера BullMQ');
}
let redisUrl;
try {
    const parsed = new URL(redisUrlRaw);
    if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
        throw new Error('QUEUE_REDIS_URL должен начинаться с redis:// или rediss://');
    }
    redisUrl = parsed.toString();
}
catch (error) {
    throw new Error(`QUEUE_REDIS_URL имеет неверный формат: ${String(error instanceof Error ? error.message : error)}`);
}
const geocoderEnabledFlag = (process.env.GEOCODER_ENABLED || '1').trim() !== '0';
const geocoderUrlRaw = (process.env.GEOCODER_URL || '').trim();
let geocoderBaseUrl = '';
let geocoderProvider = 'nominatim';
if (geocoderEnabledFlag && geocoderUrlRaw) {
    try {
        const parsed = new URL(geocoderUrlRaw);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('нужен http(s) URL для геокодера');
        }
        geocoderBaseUrl = parsed.toString();
        geocoderProvider = detectGeocoderProvider(geocoderBaseUrl);
    }
    catch (error) {
        logger_1.logger.warn({
            error,
        }, 'Геокодер отключён из-за неверного GEOCODER_URL');
    }
}
const geocoderUserAgentRaw = (process.env.GEOCODER_USER_AGENT || '').trim();
const geocoderUserAgent = geocoderUserAgentRaw || 'ERM Logistics geocoder';
const geocoderEmailRaw = (process.env.GEOCODER_EMAIL || '').trim();
const geocoderEmail = geocoderEmailRaw || undefined;
const geocoderApiKeyRaw = (process.env.GEOCODER_API_KEY ||
    process.env.ORS_API_KEY ||
    '').trim();
const geocoderApiKey = geocoderApiKeyRaw || undefined;
const geocoderProxyTokenRaw = (process.env.GEOCODER_PROXY_TOKEN ||
    process.env.PROXY_TOKEN ||
    '').trim();
const geocoderProxyToken = geocoderProxyTokenRaw || undefined;
if (geocoderProvider === 'openrouteservice' && !geocoderApiKey) {
    logger_1.logger.warn('Геокодер отключён: отсутствует GEOCODER_API_KEY или ORS_API_KEY');
}
// --- Изменённая логика: ROUTING_URL теперь опционален ---
// Если переменной нет или формат некорректный — маршрутизация отключается и логируется.
const routingUrlRaw = (process.env.ROUTING_URL || '').trim();
let routingBaseUrl;
if (!routingUrlRaw) {
    logger_1.logger.info('ROUTING_URL не задан; функциональность маршрутизации отключена');
    routingBaseUrl = undefined;
}
else {
    try {
        const parsed = new URL(routingUrlRaw);
        routingBaseUrl = parsed.toString();
    }
    catch (error) {
        logger_1.logger.warn({ error }, 'ROUTING_URL имеет неверный формат; функциональность маршрутизации отключена');
        routingBaseUrl = undefined;
    }
}
const osrmAlgorithmRaw = (process.env.OSRM_ALGORITHM || '').trim();
// ---- НОВОЕ: token для маршрутизации (если нужно аутентифицировать вызовы маршрутизации) ----
// Читаем либо GEOCODER_PROXY_TOKEN (часто используют для прокси), либо PROXY_TOKEN
const routingProxyTokenRaw = (process.env.GEOCODER_PROXY_TOKEN ||
    process.env.PROXY_TOKEN ||
    '').trim();
const routingProxyToken = routingProxyTokenRaw || undefined;
// -------------------------------------------------------------------------------------------
exports.workerConfig = {
    connection: { url: redisUrl },
    prefix: (process.env.QUEUE_PREFIX || 'erm').trim() || 'erm',
    attempts: parsePositiveInt(process.env.QUEUE_ATTEMPTS, 3),
    backoffMs: parsePositiveInt(process.env.QUEUE_BACKOFF_MS, 5000),
    concurrency: parsePositiveInt(process.env.QUEUE_CONCURRENCY, 4),
    geocoder: {
        enabled: geocoderEnabledFlag &&
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
};
