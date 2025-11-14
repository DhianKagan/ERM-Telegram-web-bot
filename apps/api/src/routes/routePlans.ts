// Маршруты управления маршрутными планами.
// Основные модули: express, express-validator, controllers/routePlans

import { Router } from 'express';
import { body, query } from 'express-validator';
import authMiddleware from '../middleware/auth';
import { asyncHandler } from '../api/middleware';
import validate from '../utils/validate';
import * as ctrl from '../controllers/routePlans';

const router: Router = Router();

router.get(
  '/',
  authMiddleware(),
  ...validate([
    query('status').optional().isIn(['draft', 'approved', 'completed']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ]),
  asyncHandler(ctrl.list),
);

router.get('/:id', authMiddleware(), asyncHandler(ctrl.detail));

router.patch(
  '/:id',
  authMiddleware(),
  ...validate([
    body('title').optional().isString(),
    body('notes').optional({ nullable: true }).isString(),
    body('routes').optional().isArray(),
    body('routes.*.id').optional({ nullable: true }).isString(),
    body('routes.*.order').optional().isInt(),
    body('routes.*.vehicleId').optional({ nullable: true }).isString(),
    body('routes.*.vehicleName').optional({ nullable: true }).isString(),
    body('routes.*.driverId').optional({ nullable: true }).isString(),
    body('routes.*.driverName').optional({ nullable: true }).isString(),
    body('routes.*.notes').optional({ nullable: true }).isString(),
    body('routes.*.tasks').optional().isArray({ min: 1 }),
    body('routes.*.tasks.*').optional().isString(),
  ]),
  asyncHandler(ctrl.update),
);

router.patch(
  '/:id/status',
  authMiddleware(),
  ...validate([body('status').isIn(['draft', 'approved', 'completed'])]),
  asyncHandler(ctrl.changeStatus),
);

router.delete('/:id', authMiddleware(), asyncHandler(ctrl.remove));

export default router;
