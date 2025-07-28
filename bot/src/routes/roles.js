// Роуты ролей: список и обновление
const express = require('express');
const rateLimit = require('express-rate-limit');
const { param } = require('express-validator');
const ctrl = require('../roles/roles.controller.ts');
const { verifyToken } = require('../api/middleware');
const { Roles } = require('../auth/roles.decorator.ts');
const rolesGuard = require('../auth/roles.guard.ts');
const { ACCESS_ADMIN } = require('../utils/accessMask');
const validateDto = require('../middleware/validateDto.ts');
const { UpdateRoleDto } = require('../dto/roles.dto.ts');

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });

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
