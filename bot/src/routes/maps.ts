// Роут карт: разворачивание ссылок Google Maps
// Модули: express, express-validator, services/maps, middleware/auth
import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../utils/validate';
import { expand } from '../controllers/maps';
import { asyncHandler } from '../api/middleware';
import authMiddleware from '../middleware/auth';

const router = Router();

router.post(
  '/expand',
  authMiddleware(),
  validate([body('url').isString().notEmpty()]),
  asyncHandler(expand),
);

export default router;
