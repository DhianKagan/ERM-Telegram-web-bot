// Роуты задач: CRUD, время, массовые действия
const express = require('express');
const createRateLimiter = require('../utils/rateLimiter');
const { param, query } = require('express-validator');
const ext = process.env.NODE_ENV === 'test' ? '.ts' : '.js';
const ctrl = require('../tasks/tasks.controller' + ext);
const { verifyToken } = require('../api/middleware');
const validateDto = require('../middleware/validateDto' + ext);
const {
  CreateTaskDto,
  UpdateTaskDto,
  AddTimeDto,
  BulkStatusDto,
} = require('../dto/tasks.dto' + ext);

const router = express.Router();

// Лимитирует 100 запросов к деталям и операциям с задачами за 15 минут
const detailLimiter = createRateLimiter(15 * 60 * 1000, 100);
const tasksLimiter = createRateLimiter(15 * 60 * 1000, 100);

router.use(tasksLimiter);

router.get(
  '/',
  verifyToken,
  [
    query('status').optional().isString(),
    query('assignees').optional().isArray(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1 }),
  ],
  ctrl.list,
);

router.get('/mentioned', verifyToken, ctrl.mentioned);

router.get(
  '/report/summary',
  verifyToken,
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  ctrl.summary,
);

router.get(
  '/:id',
  verifyToken,
  detailLimiter,
  [param('id').isMongoId()],
  ctrl.detail,
);

router.post('/', verifyToken, ...validateDto(CreateTaskDto), ctrl.create);

const checkTaskAccess = require('../middleware/taskAccess');

router.patch(
  '/:id',
  verifyToken,
  [param('id').isMongoId()],
  checkTaskAccess,
  ...validateDto(UpdateTaskDto),
  ctrl.update,
);

router.patch(
  '/:id/time',
  verifyToken,
  [param('id').isMongoId()],
  ...validateDto(AddTimeDto),
  checkTaskAccess,
  ctrl.addTime,
);

router.delete(
  '/:id',
  verifyToken,
  [param('id').isMongoId()],
  checkTaskAccess,
  ctrl.remove,
);

router.post('/bulk', verifyToken, ...validateDto(BulkStatusDto), ctrl.bulk);

module.exports = router;
