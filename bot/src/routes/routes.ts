// Роуты для получения маршрутов
// Модули: express, express-validator, controllers/routes
import { Router, RequestHandler } from 'express';
import { query, validationResult } from 'express-validator';
import * as ctrl from '../controllers/routes';
import { verifyToken, asyncHandler } from '../api/middleware';

export interface RoutesQuery {
  from?: string;
  to?: string;
  status?: string;
}

export interface RoutesResponse {
  routes: unknown[];
}

const router = Router();

const validate = (v: ReturnType<typeof query>[]): RequestHandler[] => [
  ...v,
  (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    res.status(400).json({ errors: errors.array() });
  },
];

router.get(
  '/all',
  verifyToken as unknown as RequestHandler,
  validate([
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('status').optional().isString(),
  ]),
  asyncHandler(ctrl.all),
);

export default router;
