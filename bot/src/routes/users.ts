// Роуты пользователей: список и создание
// Модули: express, express-rate-limit, controllers/users
import { Router, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../users/users.controller';
import { verifyToken } from '../api/middleware';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import validateDto from '../middleware/validateDto';
import { CreateUserDto } from '../dto/users.dto';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const middlewares = [
  limiter,
  verifyToken,
  Roles(ACCESS_ADMIN),
  rolesGuard,
] as RequestHandler[];

router.get('/', ...middlewares, ctrl.list as RequestHandler);
router.post(
  '/',
  ...middlewares,
  ...(validateDto(CreateUserDto) as RequestHandler[]),
  ctrl.create as RequestHandler,
);

export default router;

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = router;
