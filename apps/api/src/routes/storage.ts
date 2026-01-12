// Роуты управления файлами в хранилище
// Модули: express, express-validator, middleware/auth, auth/roles, services/fileService
import { Router, RequestHandler, NextFunction, Response } from 'express';
import authMiddleware from '../middleware/auth';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import { listFiles, deleteFile, getFile } from '../services/fileService';
import { param, query } from 'express-validator';
import { asyncHandler } from '../api/middleware';
import container from '../di';
import { TOKENS } from '../di/tokens';
import type StorageDiagnosticsController from '../controllers/storageDiagnostics.controller';
import TaskSyncController from '../controllers/taskSync.controller';
import type RequestWithUser from '../types/request';
import { syncTaskAttachments } from '../db/queries';

const router: Router = Router();

const diagnosticsController = container.resolve<StorageDiagnosticsController>(
  TOKENS.StorageDiagnosticsController,
);

const taskSyncController = container.resolve<TaskSyncController>(
  TOKENS.TaskSyncController,
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
  async (req: RequestWithUser, res: Response) => {
    const filters = {
      userId: req.query.userId ? Number(req.query.userId) : undefined,
      type: req.query.type as string | undefined,
    };
    const files = await listFiles(filters);
    res.json(files);
  },
);

router.get(
  '/:id([0-9a-fA-F]{24})',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  param('id').isMongoId() as unknown as RequestHandler,
  async (req: RequestWithUser, res: Response) => {
    const file = await getFile(req.params.id);
    if (!file) {
      res.status(404).json({ error: 'Файл не найден' });
      return;
    }
    res.json(file);
  },
);

router.delete(
  '/:id([0-9a-fA-F]{24})',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  param('id').isMongoId() as unknown as RequestHandler,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const deletionResult = await deleteFile(req.params.id);
      if (deletionResult?.taskId) {
        const normalizedUserId =
          typeof req.user?.id === 'number' && Number.isFinite(req.user.id)
            ? req.user.id
            : undefined;
        const attachmentsForSync =
          deletionResult.attachments !== undefined
            ? deletionResult.attachments
            : [];
        try {
          await syncTaskAttachments(
            deletionResult.taskId,
            attachmentsForSync,
            normalizedUserId,
          );
        } catch (syncError) {
          console.error(
            'Не удалось обновить вложения задачи после удаления файла через Storage',
            syncError,
          );
        }
        try {
          await taskSyncController.syncAfterChange(deletionResult.taskId);
        } catch (telegramError) {
          console.error(
            'Не удалось синхронизировать задачу в Telegram после удаления файла через Storage',
            telegramError,
          );
        }
      }
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
  asyncHandler(diagnosticsController.remediate),
);

export default router;
