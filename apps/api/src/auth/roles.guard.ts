// Назначение файла: guard для проверки маски доступа пользователя
// Основные модули: utils/accessMask, services/service, jsonwebtoken, config
import jwt from 'jsonwebtoken';
import { Response, NextFunction } from 'express';
import { hasAccess, ACCESS_USER } from '../utils/accessMask';
import { writeLog } from '../services/service';
import { ROLES_KEY } from './roles.decorator';
import type { RequestWithUser } from '../types/request';
import { sendProblem } from '../utils/problem';
import config from '../config';

const normalizeMask = (candidate: unknown): number | undefined => {
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const readAuthToken = (req: RequestWithUser): string | undefined => {
  const header = req.headers?.authorization;
  if (!header) {
    return undefined;
  }
  if (header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    return token.length > 0 ? token : undefined;
  }
  const trimmed = header.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const augmentUserFromToken = (req: RequestWithUser): number | undefined => {
  const token = readAuthToken(req);
  if (!token) {
    return undefined;
  }
  const secrets = new Set<string>();
  if (typeof config.jwtSecret === 'string' && config.jwtSecret.trim().length > 0) {
    secrets.add(config.jwtSecret);
  }
  const envSecret = process.env.JWT_SECRET;
  if (typeof envSecret === 'string' && envSecret.trim().length > 0) {
    secrets.add(envSecret);
  }
  if (process.env.NODE_ENV === 'test') {
    secrets.add('test-secret');
  }
  let lastError: Error | undefined;
  for (const secret of secrets) {
    try {
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
      if (!payload || typeof payload !== 'object') {
        continue;
      }
      const record = payload as Record<string, unknown>;
      const decodedMask = normalizeMask(record.access);
      if (!req.user) {
        req.user = {};
      }
      if (req.user.access === undefined && decodedMask !== undefined) {
        req.user.access = decodedMask;
      }
      const decodedId = record.id;
      if (
        req.user.id === undefined &&
        (typeof decodedId === 'number' || typeof decodedId === 'string')
      ) {
        req.user.id = decodedId;
      }
      return decodedMask;
    } catch (error) {
      lastError = error as Error;
      continue;
    }
  }
  if (lastError) {
    const preview = token.slice(0, 8);
    writeLog(
      `Не удалось декодировать токен ${preview}: ${lastError.message}`,
    ).catch(() => {});
  }
  return undefined;
};

export default function rolesGuard(
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
) {
  const required = (req as unknown as Record<string | symbol, unknown>)[
    ROLES_KEY
  ] as number | undefined;
  if (!required) return next();
  const currentMask = normalizeMask(req.user?.access) ?? ACCESS_USER;
  if (hasAccess(currentMask, required)) return next();
  const decodedMask = augmentUserFromToken(req);
  const effectiveMask = normalizeMask(decodedMask) ?? currentMask;
  if (hasAccess(effectiveMask, required)) return next();
  writeLog(
    `Недостаточно прав ${req.method} ${req.originalUrl} user:${req.user?.id}/${req.user?.username} ip:${req.ip}`,
  ).catch(() => {});
  sendProblem(req, res, {
    type: 'about:blank',
    title: 'Доступ запрещён',
    status: 403,
    detail: 'Forbidden',
  });
  return;
}
