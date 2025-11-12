// Роут карт: разворачивание ссылок Google Maps
// Модули: express, express-validator, services/maps, middleware/auth
import { Router } from 'express';
import { body, query } from 'express-validator';
import validate from '../utils/validate';
import { expand, search, reverse } from '../controllers/maps';
import { asyncHandler } from '../api/middleware';
import authMiddleware from '../middleware/auth';

const router: Router = Router();

router.post(
  '/expand',
  authMiddleware(),
  validate([body('url').isString().notEmpty()]),
  asyncHandler(expand),
);

router.get(
  '/search',
  authMiddleware(),
  validate([
    query('q').isString().trim().isLength({ min: 3, max: 200 }),
    query('limit').optional().isInt({ min: 1, max: 10 }),
  ]),
  asyncHandler(search),
);

router.get(
  '/reverse',
  authMiddleware(),
  validate([
    query('lat').isFloat({ min: -90, max: 90 }),
    query('lng').optional().isFloat({ min: -180, max: 180 }).bail(),
    query('lon').optional().isFloat({ min: -180, max: 180 }).bail(),
    query('lat').custom((_, { req }) => {
      const hasLng = typeof req?.query?.lng === 'string';
      const hasLon = typeof req?.query?.lon === 'string';
      if (!hasLng && !hasLon) {
        throw new Error('lng or lon is required');
      }
      return true;
    }),
  ]),
  asyncHandler(reverse),
);

export default router;
