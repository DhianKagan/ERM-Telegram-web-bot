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

interface LogsQuery {
  page?: number;
  limit?: number;
}

interface LogsResponse {
  logs: unknown[];
  total?: number;
}

interface LogBody {
  level: string;
  message: string;
}

interface LogResponse {
  status: string;
}

const router = Router();
const limiter = createRateLimiter(15 * 60 * 1000, 100);

router.get<unknown, LogsResponse, unknown, LogsQuery>(
  '/',
  limiter,
  verifyToken,
  Roles(ACCESS_ADMIN),
  rolesGuard,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1 }),
  ],
  ctrl.list as RequestHandler<unknown, LogsResponse, unknown, LogsQuery>,
);

router.post<unknown, LogResponse, LogBody>(
  '/',
  limiter,
  verifyToken,
  ...validateDto(CreateLogDto),
  ctrl.create as RequestHandler<unknown, LogResponse, LogBody>,
);

export default router;

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = router;
