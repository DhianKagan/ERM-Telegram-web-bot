// Роуты ролей: список и обновление
const express = require('express');
const createRateLimiter = require('../utils/rateLimiter');
const { param } = require('express-validator');
const ext = process.env.NODE_ENV === 'test' ? '.ts' : '.js';
const ctrl = require('../roles/roles.controller' + ext);
const { verifyToken } = require('../api/middleware');
const { Roles } = require('../auth/roles.decorator' + ext);
const rolesGuard = require('../auth/roles.guard' + ext);
const { ACCESS_ADMIN } = require('../utils/accessMask');
const validateDto = require('../middleware/validateDto' + ext);
const { UpdateRoleDto } = require('../dto/roles.dto' + ext);

const router = express.Router();
const limiter = createRateLimiter(15 * 60 * 1000, 50);

router.get(
  '/',
  limiter,
  verifyToken,
  Roles(ACCESS_ADMIN),
  rolesGuard,
  ctrl.list,
);
router.patch(
  '/:id',
  limiter,
  verifyToken,
  Roles(ACCESS_ADMIN),
  rolesGuard,
  [param('id').isMongoId()],
  ...validateDto(UpdateRoleDto),
  ctrl.update,
);

module.exports = router;
