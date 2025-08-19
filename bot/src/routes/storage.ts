// Роуты управления файлами в хранилище
// Модули: express, middleware/auth, auth/roles, services/dataStorage
import { Router, RequestHandler } from 'express';
import authMiddleware from '../middleware/auth';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import { listFiles, deleteFile } from '../services/dataStorage';
import { param } from 'express-validator';

const router = Router();

router.get(
  '/',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  async (_req, res) => {
    const files = await listFiles();
    res.json(files);
  },
);

router.delete(
  '/:name',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  param('name').isString() as unknown as RequestHandler,
  async (req, res) => {
    await deleteFile(req.params.name);
    res.json({ ok: true });
  },
);

export default router;
