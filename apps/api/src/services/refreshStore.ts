import crypto from 'node:crypto';
import Redis from 'ioredis';

export interface RefreshSessionRecord {
  userId: string;
  createdAt: number;
  expiresAt: number;
  ipHash?: string;
  userAgentHash?: string;
}

type RotateResult =
  | { status: 'rotated'; userId: string }
  | { status: 'missing' }
  | { status: 'binding_mismatch'; userId: string }
  | { status: 'reused'; userId: string };

interface RefreshStore {
  save(
    hash: string,
    record: RefreshSessionRecord,
    ttlSeconds: number,
  ): Promise<void>;
  rotate(
    oldHash: string,
    newHash: string,
    nextRecord: RefreshSessionRecord,
    ttlSeconds: number,
  ): Promise<RotateResult>;
  revoke(hash: string, ttlSeconds: number): Promise<void>;
  revokeAllByUser(userId: string): Promise<void>;
}

type RedisCommandResult<T> = { ok: true; value: T } | { ok: false };

const isRedisUnavailableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("stream isn't writeable") ||
    message.includes('stream is not writeable') ||
    message.includes('offline queue') ||
    message.includes('connection is closed') ||
    message.includes('connection closed') ||
    message.includes('connect econnrefused') ||
    message.includes('connect etimedout') ||
    message.includes('ready check failed')
  );
};

class MemoryRefreshStore implements RefreshStore {
  private readonly active = new Map<string, RefreshSessionRecord>();
  private readonly revoked = new Map<string, string>();
  private readonly userHashes = new Map<string, Set<string>>();

  async save(hash: string, record: RefreshSessionRecord): Promise<void> {
    this.active.set(hash, record);
    const hashes = this.userHashes.get(record.userId) ?? new Set<string>();
    hashes.add(hash);
    this.userHashes.set(record.userId, hashes);
  }

  async rotate(
    oldHash: string,
    newHash: string,
    nextRecord: RefreshSessionRecord,
  ): Promise<RotateResult> {
    const active = this.active.get(oldHash);
    if (!active) {
      const reusedBy = this.revoked.get(oldHash);
      if (reusedBy) {
        return { status: 'reused', userId: reusedBy };
      }
      return { status: 'missing' };
    }
    if (active.ipHash && active.ipHash !== nextRecord.ipHash) {
      await this.revokeAllByUser(active.userId);
      return { status: 'binding_mismatch', userId: active.userId };
    }
    if (
      active.userAgentHash &&
      active.userAgentHash !== nextRecord.userAgentHash
    ) {
      await this.revokeAllByUser(active.userId);
      return { status: 'binding_mismatch', userId: active.userId };
    }
    this.active.delete(oldHash);
    this.revoked.set(oldHash, active.userId);

    const prevHashes = this.userHashes.get(active.userId);
    if (prevHashes) {
      prevHashes.delete(oldHash);
      if (!prevHashes.size) {
        this.userHashes.delete(active.userId);
      }
    }

    await this.save(newHash, nextRecord);
    return { status: 'rotated', userId: active.userId };
  }

  async revoke(hash: string): Promise<void> {
    const active = this.active.get(hash);
    if (!active) {
      return;
    }
    this.active.delete(hash);
    this.revoked.set(hash, active.userId);
    const hashes = this.userHashes.get(active.userId);
    if (hashes) {
      hashes.delete(hash);
      if (!hashes.size) {
        this.userHashes.delete(active.userId);
      }
    }
  }

  async revokeAllByUser(userId: string): Promise<void> {
    const hashes = this.userHashes.get(userId);
    if (!hashes) {
      return;
    }
    for (const hash of hashes) {
      this.active.delete(hash);
      this.revoked.set(hash, userId);
    }
    this.userHashes.delete(userId);
  }
}

class RedisRefreshStore implements RefreshStore {
  constructor(
    private readonly redis: Redis,
    private readonly prefix: string,
  ) {}

  private activeKey(hash: string): string {
    return `${this.prefix}:active:${hash}`;
  }

  private revokedKey(hash: string): string {
    return `${this.prefix}:revoked:${hash}`;
  }

  private userKey(userId: string): string {
    return `${this.prefix}:user:${userId}`;
  }

  private async runRedisCommand<T>(
    action: () => Promise<T>,
  ): Promise<RedisCommandResult<T>> {
    try {
      return { ok: true, value: await action() };
    } catch (error) {
      if (isRedisUnavailableError(error)) {
        return { ok: false };
      }
      throw error;
    }
  }

  async save(
    hash: string,
    record: RefreshSessionRecord,
    ttlSeconds: number,
  ): Promise<void> {
    const payload = JSON.stringify(record);
    const result = await this.runRedisCommand(() =>
      this.redis
        .multi()
        .set(this.activeKey(hash), payload, 'EX', ttlSeconds)
        .sadd(this.userKey(record.userId), hash)
        .expire(this.userKey(record.userId), ttlSeconds)
        .exec(),
    );
    if (!result.ok) {
      throw new Error('REDIS_REFRESH_STORE_UNAVAILABLE');
    }
  }

  async rotate(
    oldHash: string,
    newHash: string,
    nextRecord: RefreshSessionRecord,
    ttlSeconds: number,
  ): Promise<RotateResult> {
    const activePayloadResult = await this.runRedisCommand(() =>
      this.redis.get(this.activeKey(oldHash)),
    );
    if (!activePayloadResult.ok) {
      throw new Error('REDIS_REFRESH_STORE_UNAVAILABLE');
    }
    const activePayload = activePayloadResult.value;
    if (!activePayload) {
      const reusedByResult = await this.runRedisCommand(() =>
        this.redis.get(this.revokedKey(oldHash)),
      );
      if (!reusedByResult.ok) {
        throw new Error('REDIS_REFRESH_STORE_UNAVAILABLE');
      }
      const reusedBy = reusedByResult.value;
      if (reusedBy) {
        return { status: 'reused', userId: reusedBy };
      }
      return { status: 'missing' };
    }

    const active = JSON.parse(activePayload) as RefreshSessionRecord;
    if (active.ipHash && active.ipHash !== nextRecord.ipHash) {
      await this.revokeAllByUser(active.userId);
      return { status: 'binding_mismatch', userId: active.userId };
    }
    if (
      active.userAgentHash &&
      active.userAgentHash !== nextRecord.userAgentHash
    ) {
      await this.revokeAllByUser(active.userId);
      return { status: 'binding_mismatch', userId: active.userId };
    }
    const updateResult = await this.runRedisCommand(() =>
      this.redis
        .multi()
        .del(this.activeKey(oldHash))
        .set(this.revokedKey(oldHash), active.userId, 'EX', ttlSeconds)
        .srem(this.userKey(active.userId), oldHash)
        .set(
          this.activeKey(newHash),
          JSON.stringify(nextRecord),
          'EX',
          ttlSeconds,
        )
        .sadd(this.userKey(active.userId), newHash)
        .expire(this.userKey(active.userId), ttlSeconds)
        .exec(),
    );
    if (!updateResult.ok) {
      throw new Error('REDIS_REFRESH_STORE_UNAVAILABLE');
    }

    return { status: 'rotated', userId: active.userId };
  }

  async revoke(hash: string, ttlSeconds: number): Promise<void> {
    const activePayloadResult = await this.runRedisCommand(() =>
      this.redis.get(this.activeKey(hash)),
    );
    if (!activePayloadResult.ok) {
      throw new Error('REDIS_REFRESH_STORE_UNAVAILABLE');
    }
    const activePayload = activePayloadResult.value;
    if (!activePayload) {
      return;
    }
    const active = JSON.parse(activePayload) as RefreshSessionRecord;
    const revokeResult = await this.runRedisCommand(() =>
      this.redis
        .multi()
        .del(this.activeKey(hash))
        .set(this.revokedKey(hash), active.userId, 'EX', ttlSeconds)
        .srem(this.userKey(active.userId), hash)
        .exec(),
    );
    if (!revokeResult.ok) {
      throw new Error('REDIS_REFRESH_STORE_UNAVAILABLE');
    }
  }

  async revokeAllByUser(userId: string): Promise<void> {
    const hashesResult = await this.runRedisCommand(() =>
      this.redis.smembers(this.userKey(userId)),
    );
    if (!hashesResult.ok) {
      throw new Error('REDIS_REFRESH_STORE_UNAVAILABLE');
    }
    const hashes = hashesResult.value;
    if (!hashes.length) {
      return;
    }
    const tx = this.redis.multi();
    for (const hash of hashes) {
      tx.del(this.activeKey(hash));
      tx.set(this.revokedKey(hash), userId, 'EX', 24 * 60 * 60);
    }
    tx.del(this.userKey(userId));
    const execResult = await this.runRedisCommand(() => tx.exec());
    if (!execResult.ok) {
      throw new Error('REDIS_REFRESH_STORE_UNAVAILABLE');
    }
  }
}

class ResilientRefreshStore implements RefreshStore {
  private activeStore: RefreshStore;

  constructor(
    primaryStore: RefreshStore,
    private readonly fallbackStore: RefreshStore,
  ) {
    this.activeStore = primaryStore;
  }

  private switchToFallback(error: unknown): RefreshStore {
    if (
      error instanceof Error &&
      error.message === 'REDIS_REFRESH_STORE_UNAVAILABLE'
    ) {
      if (this.activeStore !== this.fallbackStore) {
        console.warn(
          '[auth] refresh Redis unavailable, switching refresh sessions to in-memory store',
        );
        this.activeStore = this.fallbackStore;
      }
      return this.fallbackStore;
    }

    throw error;
  }

  async save(
    hash: string,
    record: RefreshSessionRecord,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.activeStore.save(hash, record, ttlSeconds);
    } catch (error) {
      await this.switchToFallback(error).save(hash, record, ttlSeconds);
    }
  }

  async rotate(
    oldHash: string,
    newHash: string,
    nextRecord: RefreshSessionRecord,
    ttlSeconds: number,
  ): Promise<RotateResult> {
    try {
      return await this.activeStore.rotate(
        oldHash,
        newHash,
        nextRecord,
        ttlSeconds,
      );
    } catch (error) {
      return this.switchToFallback(error).rotate(
        oldHash,
        newHash,
        nextRecord,
        ttlSeconds,
      );
    }
  }

  async revoke(hash: string, ttlSeconds: number): Promise<void> {
    try {
      await this.activeStore.revoke(hash, ttlSeconds);
    } catch (error) {
      await this.switchToFallback(error).revoke(hash, ttlSeconds);
    }
  }

  async revokeAllByUser(userId: string): Promise<void> {
    try {
      await this.activeStore.revokeAllByUser(userId);
    } catch (error) {
      await this.switchToFallback(error).revokeAllByUser(userId);
    }
  }
}

let cachedStore: RefreshStore | null = null;

function buildStore(): RefreshStore {
  const redisUrl = process.env.REDIS_URL || process.env.QUEUE_REDIS_URL;
  if (!redisUrl) {
    return new MemoryRefreshStore();
  }

  try {
    const fallbackStore = new MemoryRefreshStore();
    const redis = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: Number.parseInt(
        process.env.AUTH_REDIS_CONNECT_TIMEOUT_MS || '1000',
        10,
      ),
      commandTimeout: Number.parseInt(
        process.env.AUTH_REDIS_COMMAND_TIMEOUT_MS || '1000',
        10,
      ),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    redis.connect().catch(() => undefined);
    return new ResilientRefreshStore(
      new RedisRefreshStore(
        redis,
        process.env.REFRESH_REDIS_PREFIX || 'erm:auth:refresh',
      ),
      fallbackStore,
    );
  } catch {
    return new MemoryRefreshStore();
  }
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET не задан');
  }
  return secret;
};

export const hashRefreshToken = (token: string): string =>
  crypto
    .createHash('sha256')
    .update(`${getJwtSecret()}:${token}`)
    .digest('hex');

export const __resetRefreshStoreForTests = (): void => {
  cachedStore = null;
};

export const getRefreshStore = (): RefreshStore => {
  if (!cachedStore) {
    cachedStore = buildStore();
  }
  return cachedStore;
};

export type { RefreshStore, RotateResult };
