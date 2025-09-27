// Роуты для получения маршрутов
// Модули: express, express-validator, controllers/routes, middleware/auth
import { Router, RequestHandler } from 'express';
import { query, validationResult } from 'express-validator';
import * as ctrl from '../controllers/routes';
import { asyncHandler } from '../api/middleware';
import authMiddleware from '../middleware/auth';
import { sendProblem } from '../utils/problem';

export interface RoutesQuery {
  from?: string;
  to?: string;
  status?: string;
}

export interface RoutesResponse {
  routes: unknown[];
}

const router: Router = Router();

const validate = (v: ReturnType<typeof query>[]): RequestHandler[] => [
  ...v,
  (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    const errorList = errors.array();
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Ошибка валидации',
      status: 400,
      detail: 'Ошибка валидации',
      errors: errorList,
    });
  },
];

router.get(
  '/all',
  authMiddleware(),
  validate([
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('status').optional().isString(),
  ]),
  asyncHandler(ctrl.all),
);

export default router;
