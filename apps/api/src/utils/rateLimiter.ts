// Назначение файла: создание rate limiter с логированием и метриками
// Основные модули: express-rate-limit, prom-client, services/service
import rateLimit, {
  ipKeyGenerator,
  type Options as RateLimitLibOptions,
} from 'express-rate-limit';
import type { RequestHandler, Response } from 'express';
import type { RequestWithUser } from '../types/request';
import { writeLog } from '../services/service';
import { sendProblem } from '../utils/problem';
import client from 'prom-client';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  name: string;
  adminMax?: number;
  captcha?: boolean;
}

const drops = new client.Counter({
  name: 'rate_limit_drops_total',
  help: 'Количество отклонённых запросов лимитером',
  labelNames: ['name', 'key'],
});


function hasConfirmedHeader(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasConfirmedHeader(item));
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value === 1;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

function extractTelegramId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
}

function resolveTelegramId(req: RequestWithUser): string | undefined {
  const fromUser = req.user?.telegram_id;
  const userTelegramId = extractTelegramId(fromUser);
  if (userTelegramId) return userTelegramId;

  const body = req.body as Record<string, unknown> | undefined;
  const query = req.query as Record<string, unknown> | undefined;
  const params = req.params as Record<string, unknown> | undefined;
  const session = (req as unknown as {
    session?: Record<string, unknown>;
  }).session;

  const candidates: unknown[] = [
    body?.telegramId,
    body?.telegram_id,
    query?.telegramId,
    query?.telegram_id,
    params?.telegramId,
    params?.telegram_id,
    session?.telegramId,
    session?.telegram_id,
  ];

  for (const candidate of candidates) {
    const id = extractTelegramId(candidate);
    if (id) return id;
  }

  return undefined;
}

export default function createRateLimiter({
  windowMs,
  max,
  name,
  adminMax,
  captcha,
}: RateLimitOptions) {
  return rateLimit({
    windowMs,
    max: ((req: RequestWithUser) =>
      req.user?.role === 'admin' && adminMax
        ? adminMax
        : max) as unknown as RateLimitLibOptions['max'],
    keyGenerator: ((req: RequestWithUser) => {
      const telegramId = resolveTelegramId(req);
      const key = telegramId ?? ipKeyGenerator(req.ip as string);
      return `${name}:${key}`;
    }) as unknown as RateLimitLibOptions['keyGenerator'],
    standardHeaders: true,
    legacyHeaders: true,
    skip: ((req: RequestWithUser) =>
      hasConfirmedHeader(req.headers['x-confirmed-action']) ||
      Boolean(
        captcha &&
          process.env.CAPTCHA_TOKEN &&
          req.headers['x-captcha-token'] === process.env.CAPTCHA_TOKEN,
      )) as unknown as RateLimitLibOptions['skip'],
    handler: ((req: RequestWithUser, res: Response) => {
      const info = (
        req as unknown as {
          rateLimit?: {
            resetTime?: Date | number;
            limit?: number;
            remaining?: number;
          };
        }
      ).rateLimit;
      const keyBase = resolveTelegramId(req) ?? ipKeyGenerator(req.ip as string);
      drops.inc({ name, key: keyBase });
      const reset = info?.resetTime;
      if (reset instanceof Date) {
        const retryAfter = Math.ceil((reset.getTime() - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
      }
      const limit = info?.limit;
      const remaining = info?.remaining;
      const resetTime =
        info?.resetTime instanceof Date
          ? Math.ceil(info.resetTime.getTime() / 1000)
          : info?.resetTime;
      if (limit !== undefined)
        res.setHeader('X-RateLimit-Limit', limit.toString());
      if (remaining !== undefined)
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
      if (resetTime !== undefined)
        res.setHeader('X-RateLimit-Reset', resetTime.toString());
      writeLog(
        `Превышен лимит ${req.method} ${req.originalUrl} key:${keyBase} ` +
          `limit:${limit} remaining:${remaining} reset:${resetTime}`,
        'warn',
      ).catch(() => {});
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Превышен лимит запросов',
        status: 429,
        detail: 'Слишком много запросов, попробуйте позже.',
      });
    }) as unknown as RateLimitLibOptions['handler'],
  }) as unknown as RequestHandler;
}
