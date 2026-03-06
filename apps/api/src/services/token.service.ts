import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import config from '../config';
import {
  getRefreshStore,
  hashRefreshToken,
  type RefreshSessionRecord,
} from './refreshStore';

export interface AccessPayload {
  id: string | number;
  username: string;
  role: string;
  access: number;
  is_service_account?: boolean;
}

interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

const accessTtl = Number.parseInt(process.env.ACCESS_TOKEN_TTL || '900', 10);
const refreshTtl = Number.parseInt(
  process.env.REFRESH_TOKEN_TTL || `${7 * 24 * 60 * 60}`,
  10,
);
const refreshCookieName = process.env.REFRESH_COOKIE_NAME || 'refresh';
const refreshCookiePath = process.env.REFRESH_COOKIE_PATH || '/api/v1/auth';

const getJwtSecret = (): string => {
  const secret = config.jwtSecret;
  if (!secret) {
    throw new Error('JWT_SECRET не задан');
  }
  return secret;
};

const signAccess = (payload: AccessPayload): string =>
  jwt.sign(
    {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      access: payload.access,
      is_service_account: Boolean(payload.is_service_account),
    },
    getJwtSecret(),
    {
      expiresIn: accessTtl,
      algorithm: 'HS256',
    },
  );

const signRefresh = (payload: AccessPayload): string =>
  jwt.sign(
    {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      access: payload.access,
      is_service_account: Boolean(payload.is_service_account),
      type: 'refresh',
      jti: crypto.randomUUID(),
    },
    getJwtSecret(),
    {
      expiresIn: refreshTtl,
      algorithm: 'HS256',
    },
  );

const buildRecord = (
  userId: string,
  ttlSeconds: number,
  meta: SessionMeta,
): RefreshSessionRecord => ({
  userId,
  createdAt: Date.now(),
  expiresAt: Date.now() + ttlSeconds * 1000,
  ip: meta.ip,
  userAgent: meta.userAgent,
});

const parseRefreshPayload = (refreshToken: string): AccessPayload | null => {
  try {
    const payload = jwt.verify(refreshToken, getJwtSecret(), {
      algorithms: ['HS256'],
    }) as unknown as AccessPayload & { type?: string };
    if (payload.type !== 'refresh') {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

export async function issueSession(
  payload: AccessPayload,
  meta: SessionMeta = {},
): Promise<SessionTokens> {
  const refreshToken = signRefresh(payload);
  const hash = hashRefreshToken(refreshToken);
  await getRefreshStore().save(
    hash,
    buildRecord(String(payload.id), refreshTtl, meta),
    refreshTtl,
  );

  return {
    accessToken: signAccess(payload),
    refreshToken,
  };
}

export async function rotateSession(
  refreshToken: string,
  meta: SessionMeta = {},
): Promise<SessionTokens | null> {
  const payload = parseRefreshPayload(refreshToken);
  if (!payload) {
    return null;
  }

  const oldHash = hashRefreshToken(refreshToken);
  const nextRefreshToken = signRefresh(payload);
  const nextHash = hashRefreshToken(nextRefreshToken);
  const result = await getRefreshStore().rotate(
    oldHash,
    nextHash,
    buildRecord(String(payload.id), refreshTtl, meta),
    refreshTtl,
  );

  if (result.status === 'reused') {
    await getRefreshStore().revokeAllByUser(result.userId);
    return null;
  }
  if (result.status !== 'rotated') {
    return null;
  }

  return {
    accessToken: signAccess(payload),
    refreshToken: nextRefreshToken,
  };
}

export async function revokeRefresh(refreshToken: string): Promise<void> {
  await getRefreshStore().revoke(hashRefreshToken(refreshToken), refreshTtl);
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
  }) as unknown as AccessPayload;
}

export function decodeLegacyToken(token: string): AccessPayload {
  return verifyAccessToken(token);
}

export const tokenSettings = {
  accessTtl,
  refreshTtl,
  refreshCookieName,
  refreshCookiePath,
};
