// Роуты пользователей: список и создание
const express = require('express');
const rateLimit = require('express-rate-limit');
const ext = process.env.NODE_ENV === 'test' ? '.ts' : '.js';
const ctrl = require('../users/users.controller' + ext);
const { verifyToken } = require('../api/middleware');
const { Roles } = require('../auth/roles.decorator' + ext);
const rolesGuard = require('../auth/roles.guard' + ext);
const { ACCESS_ADMIN } = require('../utils/accessMask');
const validateDto = require('../middleware/validateDto' + ext);
const { CreateUserDto } = require('../dto/users.dto' + ext);

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

router.get(
  '/',
  limiter,
  verifyToken,
  Roles(ACCESS_ADMIN),
  rolesGuard,
  ctrl.list,
);
router.post(
  '/',
  limiter,
  verifyToken,
  Roles(ACCESS_ADMIN),
  rolesGuard,
  ...validateDto(CreateUserDto),
  ctrl.create,
);

module.exports = router;
