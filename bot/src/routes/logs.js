// Роуты логов: просмотр и запись
const express = require('express');
const rateLimit = require('express-rate-limit');
const { query } = require('express-validator');
const ctrl = require('../logs/logs.controller.ts');
const { verifyToken } = require('../api/middleware');
const { Roles } = require('../auth/roles.decorator.ts');
const rolesGuard = require('../auth/roles.guard.ts');
const { ACCESS_ADMIN } = require('../utils/accessMask');
const validateDto = require('../middleware/validateDto.ts');
const { CreateLogDto } = require('../dto/logs.dto.ts');

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

router.get(
  '/',
  limiter,
  verifyToken,
  Roles(ACCESS_ADMIN),
  rolesGuard,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1 }),
  ],
  ctrl.list,
);
router.post(
  '/',
  limiter,
  verifyToken,
  ...validateDto(CreateLogDto),
  ctrl.create,
);

module.exports = router;
