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

  async save(
    hash: string,
    record: RefreshSessionRecord,
    ttlSeconds: number,
  ): Promise<void> {
    const payload = JSON.stringify(record);
    await this.redis
      .multi()
      .set(this.activeKey(hash), payload, 'EX', ttlSeconds)
      .sadd(this.userKey(record.userId), hash)
      .expire(this.userKey(record.userId), ttlSeconds)
      .exec();
  }

  async rotate(
    oldHash: string,
    newHash: string,
    nextRecord: RefreshSessionRecord,
    ttlSeconds: number,
  ): Promise<RotateResult> {
    const activePayload = await this.redis.get(this.activeKey(oldHash));
    if (!activePayload) {
      const reusedBy = await this.redis.get(this.revokedKey(oldHash));
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
    await this.redis
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
      .exec();

    return { status: 'rotated', userId: active.userId };
  }

  async revoke(hash: string, ttlSeconds: number): Promise<void> {
    const activePayload = await this.redis.get(this.activeKey(hash));
    if (!activePayload) {
      return;
    }
    const active = JSON.parse(activePayload) as RefreshSessionRecord;
    await this.redis
      .multi()
      .del(this.activeKey(hash))
      .set(this.revokedKey(hash), active.userId, 'EX', ttlSeconds)
      .srem(this.userKey(active.userId), hash)
      .exec();
  }

  async revokeAllByUser(userId: string): Promise<void> {
    const hashes = await this.redis.smembers(this.userKey(userId));
    if (!hashes.length) {
      return;
    }
    const tx = this.redis.multi();
    for (const hash of hashes) {
      tx.del(this.activeKey(hash));
      tx.set(this.revokedKey(hash), userId, 'EX', 24 * 60 * 60);
    }
    tx.del(this.userKey(userId));
    await tx.exec();
  }
}

let cachedStore: RefreshStore | null = null;

function buildStore(): RefreshStore {
  const redisUrl = process.env.REDIS_URL || process.env.QUEUE_REDIS_URL;
  if (!redisUrl) {
    return new MemoryRefreshStore();
  }

  try {
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
    return new RedisRefreshStore(
      redis,
      process.env.REFRESH_REDIS_PREFIX || 'erm:auth:refresh',
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
