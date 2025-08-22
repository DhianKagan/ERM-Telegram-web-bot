// Роут расчёта оптимального маршрута для нескольких машин
// Модули: express, express-validator, controllers/optimizer, middleware/auth
import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../utils/validate';
import * as ctrl from '../controllers/optimizer';
import { asyncHandler } from '../api/middleware';
import authMiddleware from '../middleware/auth';

const router = Router();

router.post(
  '/',
  authMiddleware(),
  ...validate([
    body('tasks').isArray({ min: 1 }),
    body('count').optional().isInt({ min: 1, max: 3 }),
    body('method').optional().isIn(['angle', 'trip']),
  ]),
  asyncHandler(ctrl.optimize),
);

export default router;
