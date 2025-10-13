// Роуты пользователей: список, создание, GET /:id и PATCH /:id
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
const base: RequestHandler[] = [limiter, authMiddleware()];
const ctrl = container.resolve(UsersController);

router.get(
  '/',
  ...base,
  Roles(ACCESS_MANAGER),
  rolesGuard,
  ctrl.list,
);
router.get<{ id: string }>(
  '/:id',
  ...base,
  ctrl.get,
);
router.post(
  '/',
  ...base,
  Roles(ACCESS_ADMIN),
  rolesGuard,
  ...validateDto(CreateUserDto),
  ...ctrl.create,
);
router.patch<{ id: string }>(
  '/:id',
  ...base,
  Roles(ACCESS_ADMIN),
  rolesGuard,
  ...validateDto(UpdateUserDto),
  ...ctrl.update,
);

export default router;
