// Назначение файла: создание rate limiter с логированием и метриками
// Основные модули: express-rate-limit, prom-client, services/service
import rateLimit from 'express-rate-limit';
import type { Response } from 'express';
import type { RequestWithUser } from '../types/request';
import { writeLog } from '../services/service';
import { sendProblem } from '../utils/problem';
import client from 'prom-client';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  name: string;
  adminMax?: number;
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
}: RateLimitOptions) {
  return rateLimit({
    windowMs,
    max: (req: RequestWithUser) =>
      req.user?.role === 'admin' && adminMax ? adminMax : max,
    keyGenerator: (req: RequestWithUser) => `${name}:${req.user?.id ?? req.ip}`,
    standardHeaders: true,
    legacyHeaders: true,
    handler: (req: RequestWithUser, res: Response) => {
      const key = req.user?.id ?? req.ip;
      drops.inc({ name, key });
      const reset = req.rateLimit?.resetTime;
      if (reset instanceof Date) {
        const retryAfter = Math.ceil((reset.getTime() - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
      }
      const limit = req.rateLimit?.limit;
      const remaining = req.rateLimit?.remaining;
      const resetTime =
        req.rateLimit?.resetTime instanceof Date
          ? Math.ceil(req.rateLimit.resetTime.getTime() / 1000)
          : req.rateLimit?.resetTime;
      if (limit !== undefined) {
        res.setHeader('X-RateLimit-Limit', limit.toString());
      }
      if (remaining !== undefined) {
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
      }
      if (resetTime !== undefined) {
        res.setHeader('X-RateLimit-Reset', resetTime.toString());
      }
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
    },
  });
}
