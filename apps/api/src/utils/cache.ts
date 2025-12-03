// Назначение: адаптер кеша в памяти или Redis
// Модули: redis
import { createClient } from 'redis';

const memory = new Map<string, { expire: number; value: unknown }>();
const enabled = process.env.ROUTE_CACHE_ENABLED !== '0';
const ttl = Number(process.env.ROUTE_CACHE_TTL || '600');
const redisUrl = (process.env.ROUTE_CACHE_REDIS_URL || '').trim();

type CacheRedisClient = ReturnType<typeof createClient>;

let clientPromise: Promise<CacheRedisClient | undefined> | undefined;
let redisDisabled = false;
let redisReady = false;

function validateRedisUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'redis:' || parsed.protocol === 'rediss:';
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      'ROUTE_CACHE_REDIS_URL имеет неверный формат, используется память:',
      reason,
    );
    return false;
  }
}

async function getClient(): Promise<CacheRedisClient | undefined> {
  if (!redisUrl || redisDisabled) return undefined;
  if (!validateRedisUrl(redisUrl)) {
    redisDisabled = true;
    return undefined;
  }
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = createClient({ url: redisUrl });
      client.on('error', (e) => {
        redisReady = false;
        console.error('Redis error', e);
      });
      try {
        await client.connect();
        await client.ping();
        redisReady = true;
        return client;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn('Redis недоступен, используется кеш в памяти:', reason);
        redisDisabled = true;
        return undefined;
      }
    })();
  }
  return clientPromise;
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  if (!enabled) return undefined;
  if (redisUrl) {
    const c = await getClient();
    if (c && redisReady) {
      try {
        const val = await c.get(key);
        return val ? (JSON.parse(val) as T) : undefined;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn('Redis недоступен, используется память:', reason);
        redisDisabled = true;
      }
    }
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
    if (c && redisReady) {
      try {
        await c.setEx(key, ttlSec, JSON.stringify(val));
        return;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn('Redis недоступен, используется память:', reason);
        redisDisabled = true;
      }
    }
  }
  memory.set(key, { value: val, expire: Date.now() + ttlSec * 1000 });
}

export async function cacheDel(key: string): Promise<void> {
  if (redisUrl) {
    const c = await getClient();
    if (c && redisReady) {
      try {
        await c.del(key);
        return;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn('Redis недоступен, используется память:', reason);
        redisDisabled = true;
      }
    }
  }
  memory.delete(key);
}

export async function cacheClear(): Promise<void> {
  if (redisUrl) {
    const c = await getClient();
    if (c && redisReady) {
      try {
        await c.flushDb();
        return;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn('Redis недоступен, используется память:', reason);
        redisDisabled = true;
      }
    }
  }
  memory.clear();
}

export function getCacheBackend(): 'redis' | 'memory' {
  return redisUrl && redisReady && !redisDisabled ? 'redis' : 'memory';
}
