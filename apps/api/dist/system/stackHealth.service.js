"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Назначение: проверки доступности инфраструктурных компонентов (прокси, Redis, MongoDB)
// Основные модули: undici/fetch, redis, mongoose, BullMQ конфигурация
const undici_1 = require("undici");
const node_perf_hooks_1 = require("node:perf_hooks");
const redis_1 = require("redis");
const mongoose_1 = __importDefault(require("mongoose"));
const shared_1 = require("shared");
const connection_1 = __importDefault(require("../db/connection"));
const queue_1 = require("../config/queue");
const REQUEST_TIMEOUT_MS = 10000;
const SAMPLE_QUERY = 'ул Ленина 1 Киев';
const ROUTE_START = '30.708021,46.3939888';
const ROUTE_END = '30.7124526,46.4206201';
const pickMessage = (error) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Неизвестная ошибка';
};
const cutSnippet = (payload, limit = 500) => {
    if (payload.length <= limit) {
        return payload;
    }
    return `${payload.slice(0, limit)}… (обрезано)`;
};
const proxyHintByStatus = (status, endpoint) => {
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
const readBodySafe = async (response) => {
    try {
        return await response.text();
    }
    catch (error) {
        return `Не удалось прочитать тело: ${pickMessage(error)}`;
    }
};
const fetchWithTimeout = async (url, init, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const initWithSignal = { ...init, signal: controller.signal };
        return await (0, undici_1.fetch)(url, initWithSignal);
    }
    finally {
        clearTimeout(timer);
    }
};
const parseJsonSafe = (payload) => {
    try {
        return JSON.parse(payload);
    }
    catch {
        return undefined;
    }
};
const countKeys = async (client, pattern, count = 200) => {
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
const readListLength = async (client, key) => {
    const keyType = await client.type(key);
    if (keyType !== 'list' && keyType !== 'stream') {
        return 0;
    }
    try {
        return await client.lLen(key);
    }
    catch {
        return 0;
    }
};
class StackHealthService {
    async checkProxy(options) {
        const startedAt = node_perf_hooks_1.performance.now();
        const { proxyUrl, proxyToken, proxySource } = options;
        if (!proxyUrl || !proxyToken) {
            return {
                name: 'proxy',
                status: 'warn',
                message: 'Прокси не настроен',
                meta: {
                    hint: 'Добавьте PROXY_PRIVATE_URL/GEOCODER_URL и PROXY_TOKEN (или GEOCODER_PROXY_URL/GEOCODER_PROXY_TOKEN) в переменные окружения.',
                    source: proxySource !== null && proxySource !== void 0 ? proxySource : 'не задан',
                },
            };
        }
        const headers = {
            'X-Proxy-Token': proxyToken,
            'User-Agent': 'ERM-healthcheck',
        };
        try {
            const healthResponse = await fetchWithTimeout(`${proxyUrl}/health`, { method: 'GET', headers }, REQUEST_TIMEOUT_MS);
            if (healthResponse.status !== 200) {
                const body = await readBodySafe(healthResponse);
                return {
                    name: 'proxy',
                    status: 'error',
                    durationMs: Math.round(node_perf_hooks_1.performance.now() - startedAt),
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
                };
            }
            const searchResponse = await fetchWithTimeout(`${proxyUrl}/search?q=${encodeURIComponent(SAMPLE_QUERY)}`, { method: 'GET', headers }, REQUEST_TIMEOUT_MS);
            const searchBody = await readBodySafe(searchResponse);
            if (searchResponse.status !== 200) {
                return {
                    name: 'proxy',
                    status: 'error',
                    durationMs: Math.round(node_perf_hooks_1.performance.now() - startedAt),
                    message: `Статус /search: ${searchResponse.status}`,
                    meta: {
                        endpoint: '/search',
                        status: searchResponse.status,
                        body: cutSnippet(searchBody),
                        hint: proxyHintByStatus(searchResponse.status, '/search'),
                        sample: SAMPLE_QUERY,
                        source: proxySource,
                    },
                };
            }
            const parsed = parseJsonSafe(searchBody);
            const looksValid = Array.isArray(parsed)
                ? parsed.length > 0
                : typeof parsed === 'object' && parsed !== null;
            if (!looksValid) {
                return {
                    name: 'proxy',
                    status: 'warn',
                    durationMs: Math.round(node_perf_hooks_1.performance.now() - startedAt),
                    message: 'Ответ /search не похож на ожидаемый JSON',
                    meta: {
                        sample: cutSnippet(searchBody),
                        endpoint: '/search',
                        hint: 'Геокодер возвращает неожиданный ответ: проверьте конфигурацию прокси и upstream-геокодера (часто мешают HTML-страницы ошибок).',
                        source: proxySource,
                    },
                };
            }
            const routeResponse = await fetchWithTimeout(`${proxyUrl}/route?start=${ROUTE_START}&end=${ROUTE_END}`, { method: 'GET', headers }, REQUEST_TIMEOUT_MS);
            if (routeResponse.status !== 200) {
                const routeBody = await readBodySafe(routeResponse);
                return {
                    name: 'proxy',
                    status: 'warn',
                    durationMs: Math.round(node_perf_hooks_1.performance.now() - startedAt),
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
                };
            }
            return {
                name: 'proxy',
                status: 'ok',
                durationMs: Math.round(node_perf_hooks_1.performance.now() - startedAt),
                meta: {
                    searchSample: cutSnippet(searchBody, 200),
                    hint: 'Прокси отвечает корректно: проверьте маршрутизацию, если проблемы сохраняются на стороне клиентов.',
                    source: proxySource,
                },
            };
        }
        catch (error) {
            return {
                name: 'proxy',
                status: 'error',
                durationMs: Math.round(node_perf_hooks_1.performance.now() - startedAt),
                message: pickMessage(error),
                meta: {
                    hint: 'Проверка прокси не завершилась: убедитесь в доступности URL и отсутствии блокировок сети/файрвола.',
                    source: proxySource,
                },
            };
        }
    }
    async checkRedis(options) {
        const startedAt = node_perf_hooks_1.performance.now();
        const { redisUrl, queuePrefix, queueNames } = options;
        if (!redisUrl) {
            return {
                name: 'redis',
                status: 'warn',
                message: 'Redis не настроен',
            };
        }
        const client = (0, redis_1.createClient)({ url: redisUrl });
        const prefix = (queuePrefix === null || queuePrefix === void 0 ? void 0 : queuePrefix.trim()) || 'erm';
        try {
            await client.connect();
            const ping = await client.ping();
            if (ping !== 'PONG') {
                return {
                    name: 'redis',
                    status: 'error',
                    durationMs: Math.round(node_perf_hooks_1.performance.now() - startedAt),
                    message: `Неожиданный ответ PING: ${ping}`,
                };
            }
            const memoryInfo = await client.info('memory');
            const keyspaceInfo = await client.info('keyspace');
            const cacheCount = await countKeys(client, 'cache:*');
            const lockCount = await countKeys(client, 'lock:*');
            const queues = {};
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
                durationMs: Math.round(node_perf_hooks_1.performance.now() - startedAt),
                meta: {
                    cacheCount,
                    lockCount,
                    queues,
                    memoryInfo: memoryInfo.slice(0, 400),
                    keyspaceInfo,
                },
            };
        }
        catch (error) {
            return {
                name: 'redis',
                status: 'error',
                durationMs: Math.round(node_perf_hooks_1.performance.now() - startedAt),
                message: pickMessage(error),
            };
        }
        finally {
            try {
                await client.disconnect();
            }
            catch {
                // игнорируем ошибки отключения
            }
        }
    }
    async checkMongo() {
        const startedAt = node_perf_hooks_1.performance.now();
        try {
            const connection = await (0, connection_1.default)();
            const db = connection.db;
            if (!db) {
                return {
                    name: 'mongo',
                    status: 'error',
                    durationMs: Math.round(node_perf_hooks_1.performance.now() - startedAt),
                    message: 'Соединение с MongoDB не готово',
                };
            }
            const stats = await db.stats();
            const collection = db.collection('healthcheck_tmp');
            const inserted = await collection.insertOne({ createdAt: new Date() });
            await collection.deleteOne({ _id: inserted.insertedId });
            return {
                name: 'mongo',
                status: 'ok',
                durationMs: Math.round(node_perf_hooks_1.performance.now() - startedAt),
                meta: {
                    collections: stats.collections,
                    dataSize: stats.dataSize,
                    readyState: mongoose_1.default.connection.readyState,
                },
            };
        }
        catch (error) {
            return {
                name: 'mongo',
                status: 'error',
                durationMs: Math.round(node_perf_hooks_1.performance.now() - startedAt),
                message: pickMessage(error),
            };
        }
    }
    async run(options) {
        var _a, _b;
        const proxyResult = await this.checkProxy({
            proxyToken: options.proxyToken,
            proxyUrl: options.proxyUrl,
            proxySource: options.proxySource,
        });
        const redisResult = await this.checkRedis({
            redisUrl: options.redisUrl,
            queuePrefix: (_a = options.queuePrefix) !== null && _a !== void 0 ? _a : queue_1.queueConfig.prefix,
            queueNames: (_b = options.queueNames) !== null && _b !== void 0 ? _b : [
                shared_1.QueueName.LogisticsGeocoding,
                shared_1.QueueName.LogisticsRouting,
            ],
        });
        const mongoResult = await this.checkMongo();
        const results = [proxyResult, redisResult, mongoResult];
        const ok = results.every((item) => item.status !== 'error');
        return {
            ok,
            timestamp: new Date().toISOString(),
            results,
        };
    }
}
exports.default = StackHealthService;
