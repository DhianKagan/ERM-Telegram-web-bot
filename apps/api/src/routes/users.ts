// Роуты пользователей: список и создание
// Модули: express, express-rate-limit, controllers/users, middleware/auth
import { Router, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import container from '../di';
import UsersController from '../users/users.controller';
import authMiddleware from '../middleware/auth';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import validateDto from '../middleware/validateDto';
import { CreateUserDto } from '../dto/users.dto';

const router: Router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const middlewares = [
  limiter,
  authMiddleware(),
  Roles(ACCESS_ADMIN),
  rolesGuard,
] as RequestHandler[];
const ctrl = container.resolve(UsersController);

router.get('/', ...middlewares, ctrl.list as RequestHandler);
router.post(
  '/',
  ...middlewares,
  ...(validateDto(CreateUserDto) as RequestHandler[]),
  ...(ctrl.create as RequestHandler[]),
);

export default router;
