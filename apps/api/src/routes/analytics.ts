// Назначение: маршруты аналитики по маршрутным планам.
// Основные модули: express, express-validator, controllers/analytics

import { Router } from 'express';
import { query } from 'express-validator';
import { asyncHandler } from '../api/middleware';
import authMiddleware from '../middleware/auth';
import * as ctrl from '../controllers/analytics';
import validate from '../utils/validate';

const router: Router = Router();

router.get(
  '/route-plans/summary',
  authMiddleware(),
  ...validate([
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('status').optional().isIn(['draft', 'approved', 'completed']),
  ]),
  asyncHandler(ctrl.routePlanSummary),
);

export default router;
