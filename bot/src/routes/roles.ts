// Роуты ролей: список и обновление
// Модули: express, express-validator, controllers/roles
import { Router, RequestHandler } from 'express';
import createRateLimiter from '../utils/rateLimiter';
import { param } from 'express-validator';
import container from '../di';
import RolesController from '../roles/roles.controller';
import { verifyToken } from '../api/middleware';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import validateDto from '../middleware/validateDto';
import { UpdateRoleDto } from '../dto/roles.dto';

export interface RoleUpdateParams {
  id: string;
}

export interface RolesResponse {
  roles: unknown[];
}

export interface UpdateRoleBody {
  access: number;
}

export interface UpdateRoleResponse {
  status: string;
}

const router = Router();
const limiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  name: 'roles',
});
const ctrl = container.resolve(RolesController);

router.get(
  '/',
  limiter as unknown as RequestHandler,
  verifyToken as unknown as RequestHandler,
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  ctrl.list as RequestHandler,
);

router.patch(
  '/:id',
  limiter as unknown as RequestHandler,
  verifyToken as unknown as RequestHandler,
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  param('id').isMongoId(),
  ...(validateDto(UpdateRoleDto) as RequestHandler[]),
  ctrl.update as unknown as RequestHandler,
);

export default router;
