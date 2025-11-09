// Назначение: адаптер кеша в памяти или Redis
// Модули: redis
import { createClient, RedisClientType } from 'redis';

const memory = new Map<string, { expire: number; value: unknown }>();
const enabled = process.env.ROUTE_CACHE_ENABLED !== '0';
const ttl = Number(process.env.ROUTE_CACHE_TTL || '600');
const redisUrl = process.env.ROUTE_CACHE_REDIS_URL;
let client: RedisClientType | undefined;

async function getClient(): Promise<RedisClientType | undefined> {
  if (!redisUrl) return undefined;
  if (!client) {
    client = createClient({ url: redisUrl });
    client.on('error', (e) => console.error('Redis error', e));
    await client.connect();
  }
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  if (!enabled) return undefined;
  if (redisUrl) {
    const c = await getClient();
    const val = await c!.get(key);
    return val ? (JSON.parse(val) as T) : undefined;
  }
  const entry = memory.get(key);
  if (entry && entry.expire > Date.now()) return entry.value as T;
  if (entry) memory.delete(key);
  return undefined;
}

export async function cacheSet<T>(
  key: string,
  val: T,
  ttlSec: number = ttl,
): Promise<void> {
  if (!enabled) return;
  if (redisUrl) {
    const c = await getClient();
    await c!.setEx(key, ttlSec, JSON.stringify(val));
  } else {
    memory.set(key, { value: val, expire: Date.now() + ttlSec * 1000 });
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (redisUrl) {
    const c = await getClient();
    await c!.del(key);
  } else {
    memory.delete(key);
  }
}

export async function cacheClear(): Promise<void> {
  if (redisUrl) {
    const c = await getClient();
    await c!.flushDb();
  } else {
    memory.clear();
  }
}
