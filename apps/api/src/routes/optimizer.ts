// Роут расчёта оптимального маршрута для нескольких машин
// Модули: express, express-validator, controllers/optimizer, middleware/auth
import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../utils/validate';
import * as ctrl from '../controllers/optimizer';
import { asyncHandler } from '../api/middleware';
import authMiddleware from '../middleware/auth';

const router: Router = Router();

router.post(
  '/',
  authMiddleware(),
  ...validate([
    body('tasks').isArray({ min: 1 }),
    body('tasks.*.id').isString().trim().notEmpty(),
    body('tasks.*.coordinates').isObject(),
    body('tasks.*.coordinates.lat').isFloat({ min: -90, max: 90 }),
    body('tasks.*.coordinates.lng').isFloat({ min: -180, max: 180 }),
    body('tasks.*.demand').optional({ nullable: true }).isFloat({ min: 0 }),
    body('tasks.*.serviceMinutes')
      .optional({ nullable: true })
      .isFloat({ min: 0 }),
    body('tasks.*.timeWindow')
      .optional({ nullable: true })
      .isArray({ min: 2, max: 2 }),
    body('tasks.*.timeWindow.*')
      .optional({ nullable: true })
      .isInt({ min: 0 }),
    body('vehicleCapacity').isInt({ min: 1 }),
    body('vehicleCount').isInt({ min: 1 }),
    body('timeWindows')
      .optional({ nullable: true })
      .isArray({ min: 1 }),
    body('timeWindows.*')
      .optional({ nullable: true })
      .isArray({ min: 2, max: 2 }),
    body('timeWindows.*.*')
      .optional({ nullable: true })
      .isInt({ min: 0 }),
    body('averageSpeedKmph').optional({ nullable: true }).isFloat({ min: 1 }),
  ]),
  asyncHandler(ctrl.optimize),
);

export default router;
