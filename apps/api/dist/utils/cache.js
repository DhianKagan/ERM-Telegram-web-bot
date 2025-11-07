"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheGet = cacheGet;
exports.cacheSet = cacheSet;
exports.cacheDel = cacheDel;
exports.cacheClear = cacheClear;
// Назначение: адаптер кеша в памяти или Redis
// Модули: redis
const redis_1 = require("redis");
const memory = new Map();
const enabled = process.env.ROUTE_CACHE_ENABLED !== '0';
const ttl = Number(process.env.ROUTE_CACHE_TTL || '600');
const redisUrl = process.env.ROUTE_CACHE_REDIS_URL;
let client;
async function getClient() {
    if (!redisUrl)
        return undefined;
    if (!client) {
        client = (0, redis_1.createClient)({ url: redisUrl });
        client.on('error', (e) => console.error('Redis error', e));
        await client.connect();
    }
    return client;
}
async function cacheGet(key) {
    if (!enabled)
        return undefined;
    if (redisUrl) {
        const c = await getClient();
        const val = await c.get(key);
        return val ? JSON.parse(val) : undefined;
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
        await c.setEx(key, ttlSec, JSON.stringify(val));
    }
    else {
        memory.set(key, { value: val, expire: Date.now() + ttlSec * 1000 });
    }
}
async function cacheDel(key) {
    if (redisUrl) {
        const c = await getClient();
        await c.del(key);
    }
    else {
        memory.delete(key);
    }
}
async function cacheClear() {
    if (redisUrl) {
        const c = await getClient();
        await c.flushDb();
    }
    else {
        memory.clear();
    }
}
