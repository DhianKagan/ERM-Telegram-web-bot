// Роуты архива задач
// Основные модули: express, controllers/archives, middleware/auth
import { Router, RequestHandler } from 'express';
import { query } from 'express-validator';
import container from '../di';
import ArchivesController from '../archives/archives.controller';
import authMiddleware from '../middleware/auth';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import {
  ACCESS_ADMIN,
  ACCESS_MANAGER,
  ACCESS_TASK_DELETE,
} from '../utils/accessMask';
import validateDto from '../middleware/validateDto';
import { PurgeArchiveDto } from '../dto/archives.dto';

const router: Router = Router();
const ctrl = container.resolve(ArchivesController);
const ARCHIVE_ACCESS = ACCESS_ADMIN | ACCESS_MANAGER;

router.get(
  '/',
  authMiddleware(),
  Roles(ARCHIVE_ACCESS) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  query('page')
    .optional()
    .isInt({ min: 1 })
    .toInt() as unknown as RequestHandler,
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .toInt() as unknown as RequestHandler,
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 }) as unknown as RequestHandler,
  ctrl.list as unknown as RequestHandler,
);

router.post(
  '/purge',
  authMiddleware(),
  Roles(ACCESS_TASK_DELETE) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  ...(validateDto(PurgeArchiveDto) as RequestHandler[]),
  ctrl.purge as unknown as RequestHandler,
);

export default router;
