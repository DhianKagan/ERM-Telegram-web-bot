// Роуты управления файлами в хранилище
// Модули: express, express-validator, middleware/auth, auth/roles, services/dataStorage
import {
  Router,
  RequestHandler,
  NextFunction,
  Request,
  Response,
} from 'express';
import authMiddleware from '../middleware/auth';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import { listFiles, deleteFile } from '../services/dataStorage';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '../api/middleware';
import container from '../di';
import { TOKENS } from '../di/tokens';
import type StorageDiagnosticsController from '../storage/storageDiagnostics.controller';

const router: Router = Router();

const diagnosticsController = container.resolve<StorageDiagnosticsController>(
  TOKENS.StorageDiagnosticsController,
);

router.get(
  '/',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  [
    query('userId').optional().isInt(),
    query('type').optional().isString(),
  ] as unknown as RequestHandler[],
  async (req: Request, res: Response) => {
    const filters = {
      userId: req.query.userId ? Number(req.query.userId) : undefined,
      type: req.query.type as string | undefined,
    };
    const files = await listFiles(filters);
    res.json(files);
  },
);

router.delete(
  '/:name',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  param('name').isString() as unknown as RequestHandler,
  async (req, res, next: NextFunction) => {
    try {
      await deleteFile(req.params.name);
      res.json({ ok: true });
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        res.status(404).json({ error: 'Файл не найден' });
      } else {
        next(error);
      }
    }
  },
);

router.get(
  '/diagnostics',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  asyncHandler(diagnosticsController.diagnose),
);

router.post(
  '/diagnostics/fix',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  [body('actions').isArray()] as unknown as RequestHandler[],
  asyncHandler(diagnosticsController.remediate),
);

export default router;
