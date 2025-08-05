// Назначение: кастомный бекенд админки без базовой аутентификации
// Модули: express, path
import path from 'path';
import express, { Express, NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../api/middleware';

export default function initCustomAdmin(app: Express): void {
  const router = express.Router();
  const pub = path.join(__dirname, '../../public');

  const adminRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  });

  router.use(adminRateLimiter);
  router.use(express.static(pub, { index: false }));

  router.use((req: Request, _res: Response, next: NextFunction) => {
    if (!req.headers.authorization && req.query.token) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  });

  router.use(verifyToken);
  router.use((req: Request, res: Response, next: NextFunction) => {
    if ((req as any).user.role === 'admin') return next();
    res.sendFile(path.join(pub, 'admin-placeholder.html'));
  });

  router.get('/*splat', (_req: Request, res: Response) => {
    res.sendFile(path.join(pub, 'index.html'));
  });

  app.use('/cp', router);
}

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = initCustomAdmin;
