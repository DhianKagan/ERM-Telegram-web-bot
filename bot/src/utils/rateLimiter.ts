// Назначение файла: создание rate limiter с логированием и метриками
// Основные модули: express-rate-limit, prom-client, services/service
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
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
  labelNames: ['name'],
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
    keyGenerator: (req: Request) => `${name}:${req.ip}`,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      drops.inc({ name });
      writeLog(
        `Превышен лимит ${req.method} ${req.originalUrl} ip:${req.ip}`,
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
