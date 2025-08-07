// Роут расчёта оптимального маршрута для нескольких машин
// Модули: express, express-validator, controllers/optimizer
import { Router, RequestHandler } from 'express';
import { body } from 'express-validator';
import validate from '../utils/validate';
import * as ctrl from '../controllers/optimizer';
import { verifyToken, asyncHandler } from '../api/middleware';

interface OptimizeBody {
  tasks: string[];
  count?: number;
  method?: 'angle' | 'trip';
}

interface OptimizeResponse {
  routes: unknown;
}

const router = Router();

router.post(
  '/',
  verifyToken as RequestHandler,
  ...validate([
    body('tasks').isArray({ min: 1 }),
    body('count').optional().isInt({ min: 1, max: 3 }),
    body('method').optional().isIn(['angle', 'trip']),
  ]),
  asyncHandler(ctrl.optimize as any),
);

export default router;

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = router;
