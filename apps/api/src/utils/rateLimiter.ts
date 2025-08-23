// Назначение файла: создание rate limiter с логированием и метриками
// Основные модули: express-rate-limit, prom-client, services/service
import rateLimit, {
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
    keyGenerator: ((req: RequestWithUser) =>
      `${name}:${req.user?.telegram_id ?? req.ip}`) as unknown as RateLimitLibOptions['keyGenerator'],
    standardHeaders: true,
    legacyHeaders: true,
    skip: ((req: RequestWithUser) =>
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
      const key = req.user?.telegram_id ?? req.ip;
      drops.inc({ name, key });
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
        `Превышен лимит ${req.method} ${req.originalUrl} key:${key} ` +
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
