// Роуты ролей: список и обновление
// Модули: express, express-validator, controllers/roles
import { Router, RequestHandler } from 'express';
import createRateLimiter from '../utils/rateLimiter';
import { param } from 'express-validator';
import * as ctrl from '../roles/roles.controller';
import { verifyToken } from '../api/middleware';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import validateDto from '../middleware/validateDto';
import { UpdateRoleDto } from '../dto/roles.dto';

interface RoleUpdateParams {
  id: string;
}

interface RolesResponse {
  roles: unknown[];
}

interface UpdateRoleBody {
  access: number;
}

interface UpdateRoleResponse {
  status: string;
}

const router = Router();
const limiter = createRateLimiter(15 * 60 * 1000, 50);

router.get<unknown, RolesResponse>(
  '/',
  limiter,
  verifyToken,
  Roles(ACCESS_ADMIN),
  rolesGuard,
  ctrl.list as RequestHandler<unknown, RolesResponse>,
);

router.patch<RoleUpdateParams, UpdateRoleResponse, UpdateRoleBody>(
  '/:id',
  limiter,
  verifyToken,
  Roles(ACCESS_ADMIN),
  rolesGuard,
  [param('id').isMongoId()],
  ...validateDto(UpdateRoleDto),
  ctrl.update as RequestHandler<
    RoleUpdateParams,
    UpdateRoleResponse,
    UpdateRoleBody
  >,
);

export default router;

// Совместимость с CommonJS
module.exports = router;
