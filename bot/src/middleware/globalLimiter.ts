// Назначение: глобальный лимитер запросов
// Основные модули: express-rate-limit, express
import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.path === '/api/v1/csrf',
});

export default globalLimiter;
