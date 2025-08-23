// Роуты логов: просмотр и запись
// Модули: express, express-validator, controllers/logs, middleware/auth
import { Router, RequestHandler } from 'express';
import createRateLimiter from '../utils/rateLimiter';
import { query } from 'express-validator';
import container from '../di';
import LogsController from '../logs/logs.controller';
import authMiddleware from '../middleware/auth';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import validateDto from '../middleware/validateDto';
import { CreateLogDto } from '../dto/logs.dto';

const router: Router = Router();
const limiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  name: 'logs',
});
const ctrl = container.resolve(LogsController);

router.get(
  '/',
  limiter as unknown as RequestHandler,
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  query('page').optional().isInt({ min: 1 }) as unknown as RequestHandler,
  query('limit').optional().isInt({ min: 1 }) as unknown as RequestHandler,
  ctrl.list as unknown as RequestHandler,
);

router.post(
  '/',
  limiter as unknown as RequestHandler,
  authMiddleware(),
  ...(validateDto(CreateLogDto) as RequestHandler[]),
  ctrl.create as unknown as RequestHandler,
);

export default router;
