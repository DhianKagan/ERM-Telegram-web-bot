// Назначение: кастомный бекенд админки без базовой аутентификации
// Модули: express, path
import path from 'path';
import express, { Express, NextFunction, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../api/middleware';
import type { RequestWithUser } from '../types/request';

export default function initCustomAdmin(app: Express): void {
  const router = express.Router();
  const pub = path.join(__dirname, '../../public');

  const adminRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  });

  router.use(adminRateLimiter);
  router.use(express.static(pub, { index: false }));

  router.use((req: RequestWithUser, _res: Response, next: NextFunction) => {
    if (!req.headers.authorization && req.query.token) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  });

  router.use(verifyToken);
  router.use((req: RequestWithUser, res: Response, next: NextFunction) => {
    if (req.user?.role === 'admin') return next();
    res.sendFile(path.join(pub, 'admin-placeholder.html'));
  });

  router.get('/*splat', (_req: RequestWithUser, res: Response) => {
    res.sendFile(path.join(pub, 'index.html'));
  });

  app.use('/cp', router);
}
