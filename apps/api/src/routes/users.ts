// Роуты пользователей: список и создание
// Модули: express, express-rate-limit, controllers/users, middleware/auth, utils/accessMask
import { Router, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import container from '../di';
import UsersController from '../users/users.controller';
import authMiddleware from '../middleware/auth';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN, ACCESS_MANAGER } from '../utils/accessMask';
import validateDto from '../middleware/validateDto';
import { CreateUserDto, UpdateUserDto } from '../dto/users.dto';

const router: Router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const base = [limiter, authMiddleware()] as RequestHandler[];
const ctrl = container.resolve(UsersController);

router.get(
  '/',
  ...base,
  Roles(ACCESS_MANAGER),
  rolesGuard,
  ctrl.list as RequestHandler,
);
router.post(
  '/',
  ...base,
  Roles(ACCESS_ADMIN),
  rolesGuard,
  ...(validateDto(CreateUserDto) as RequestHandler[]),
  ...(ctrl.create as RequestHandler[]),
);
router.patch(
  '/:id',
  ...base,
  Roles(ACCESS_ADMIN),
  rolesGuard,
  ...(validateDto(UpdateUserDto) as RequestHandler[]),
  ...(ctrl.update as RequestHandler[]),
);

export default router;
