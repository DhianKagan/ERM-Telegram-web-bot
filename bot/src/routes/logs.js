// Роуты логов: просмотр и запись
const express = require('express');
const createRateLimiter = require('../utils/rateLimiter');
const { query } = require('express-validator');
const ext = process.env.NODE_ENV === 'test' ? '.ts' : '.js';
const ctrl = require('../logs/logs.controller' + ext);
const { verifyToken } = require('../api/middleware');
const { Roles } = require('../auth/roles.decorator' + ext);
const rolesGuard = require('../auth/roles.guard' + ext);
const { ACCESS_ADMIN } = require('../utils/accessMask');
const validateDto = require('../middleware/validateDto' + ext);
const { CreateLogDto } = require('../dto/logs.dto' + ext);

const router = express.Router();
const limiter = createRateLimiter(15 * 60 * 1000, 100);

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
