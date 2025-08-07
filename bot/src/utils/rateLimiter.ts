// Назначение файла: создание rate limiter с логированием превышений
// Основные модули: express-rate-limit, services/service
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { writeLog } from '../services/service';

export default function createRateLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      writeLog(
        `Превышен лимит ${req.method} ${req.originalUrl} ip:${req.ip}`,
        'warn',
      ).catch(() => {});
      res
        .status(429)
        .json({ error: 'Too many requests, please try again later.' });
    },
  });
}
