// Назначение: глобальный лимитер запросов
// Основные модули: express-rate-limit, express
import rateLimit from 'express-rate-limit';
import type { Request, Response, RequestHandler } from 'express';

const globalLimiter: RequestHandler = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request, res: Response) => {
    void res;
    return req.path === '/api/v1/csrf';
  },
}) as unknown as RequestHandler;

export default globalLimiter;
