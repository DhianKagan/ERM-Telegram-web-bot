"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheGet = cacheGet;
exports.cacheSet = cacheSet;
exports.cacheDel = cacheDel;
exports.cacheClear = cacheClear;
exports.getCacheBackend = getCacheBackend;
// Назначение: адаптер кеша в памяти или Redis
// Модули: redis
const redis_1 = require("redis");
const memory = new Map();
const enabled = process.env.ROUTE_CACHE_ENABLED !== '0';
const ttl = Number(process.env.ROUTE_CACHE_TTL || '600');
const redisUrl = (process.env.ROUTE_CACHE_REDIS_URL || '').trim();
let clientPromise;
let redisDisabled = false;
let redisReady = false;
function validateRedisUrl(value) {
    if (!value)
        return false;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'redis:' || parsed.protocol === 'rediss:';
    }
    catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn('ROUTE_CACHE_REDIS_URL имеет неверный формат, используется память:', reason);
        return false;
    }
}
async function getClient() {
    if (!redisUrl || redisDisabled)
        return undefined;
    if (!validateRedisUrl(redisUrl)) {
        redisDisabled = true;
        return undefined;
    }
    if (!clientPromise) {
        clientPromise = (async () => {
            const client = (0, redis_1.createClient)({ url: redisUrl });
            client.on('error', (e) => {
                redisReady = false;
                console.error('Redis error', e);
            });
            try {
                await client.connect();
                await client.ping();
                redisReady = true;
                return client;
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                console.warn('Redis недоступен, используется кеш в памяти:', reason);
                redisDisabled = true;
                return undefined;
            }
        })();
    }
    return clientPromise;
}
async function cacheGet(key) {
    if (!enabled)
        return undefined;
    if (redisUrl) {
        const c = await getClient();
        if (c && redisReady) {
            try {
                const val = await c.get(key);
                return val ? JSON.parse(val) : undefined;
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                console.warn('Redis недоступен, используется память:', reason);
                redisDisabled = true;
            }
        }
    }
    const entry = memory.get(key);
    if (entry && entry.expire > Date.now())
        return entry.value;
    if (entry)
        memory.delete(key);
    return undefined;
}
async function cacheSet(key, val, ttlSec = ttl) {
    if (!enabled)
        return;
    if (redisUrl) {
        const c = await getClient();
        if (c && redisReady) {
            try {
                await c.setEx(key, ttlSec, JSON.stringify(val));
                return;
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                console.warn('Redis недоступен, используется память:', reason);
                redisDisabled = true;
            }
        }
    }
    memory.set(key, { value: val, expire: Date.now() + ttlSec * 1000 });
}
async function cacheDel(key) {
    if (redisUrl) {
        const c = await getClient();
        if (c && redisReady) {
            try {
                await c.del(key);
                return;
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                console.warn('Redis недоступен, используется память:', reason);
                redisDisabled = true;
            }
        }
    }
    memory.delete(key);
}
async function cacheClear() {
    if (redisUrl) {
        const c = await getClient();
        if (c && redisReady) {
            try {
                await c.flushDb();
                return;
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                console.warn('Redis недоступен, используется память:', reason);
                redisDisabled = true;
            }
        }
    }
    memory.clear();
}
function getCacheBackend() {
    return redisUrl && redisReady && !redisDisabled ? 'redis' : 'memory';
}
