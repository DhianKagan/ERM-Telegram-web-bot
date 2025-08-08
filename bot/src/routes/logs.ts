// Роуты логов: просмотр и запись
// Модули: express, express-validator, controllers/logs
import { Router, RequestHandler } from 'express';
import createRateLimiter from '../utils/rateLimiter';
import { query } from 'express-validator';
import * as ctrl from '../logs/logs.controller';
import { verifyToken } from '../api/middleware';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import validateDto from '../middleware/validateDto';
import { CreateLogDto } from '../dto/logs.dto';

const router = Router();
const limiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  name: 'logs',
});

router.get(
  '/',
  limiter as RequestHandler,
  verifyToken as RequestHandler,
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  query('page').optional().isInt({ min: 1 }) as unknown as RequestHandler,
  query('limit').optional().isInt({ min: 1 }) as unknown as RequestHandler,
  ctrl.list as unknown as RequestHandler,
);

router.post(
  '/',
  limiter as RequestHandler,
  verifyToken as RequestHandler,
  ...(validateDto(CreateLogDto) as RequestHandler[]),
  ctrl.create as unknown as RequestHandler,
);

export default router;
