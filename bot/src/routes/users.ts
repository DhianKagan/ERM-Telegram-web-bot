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

interface UsersResponse {
  users: unknown[];
}

interface CreateUserBody {
  telegramId: number;
  name?: string;
  roleId?: number;
}

interface CreateUserResponse {
  status: string;
}

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const middlewares = [limiter, verifyToken, Roles(ACCESS_ADMIN), rolesGuard];

router.get<unknown, UsersResponse>(
  '/',
  middlewares,
  ctrl.list as RequestHandler<unknown, UsersResponse>,
);
router.post<unknown, CreateUserResponse, CreateUserBody>(
  '/',
  [...middlewares, ...validateDto(CreateUserDto)],
  ctrl.create as RequestHandler<unknown, CreateUserResponse, CreateUserBody>,
);

export default router;

// Совместимость с CommonJS
module.exports = router;
