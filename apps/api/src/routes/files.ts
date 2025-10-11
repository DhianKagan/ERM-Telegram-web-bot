// Роут скачивания файлов с проверкой прав
// Модули: express, middleware/auth, utils/accessMask, db/model, config/storage, wgLogEngine
import { Router, RequestHandler } from 'express';
import path from 'path';
import { param } from 'express-validator';
import authMiddleware from '../middleware/auth';
import { hasAccess, ACCESS_ADMIN } from '../utils/accessMask';
import { File } from '../db/model';
import type { RequestWithUser } from '../types/request';
import { uploadsDir } from '../config/storage';
import { sendProblem } from '../utils/problem';
import { writeLog } from '../services/wgLogEngine';

const router: Router = Router();

router.get(
  '/:id',
  authMiddleware(),
  param('id').isMongoId() as unknown as RequestHandler,
  async (req: RequestWithUser, res, next) => {
    try {
      const file = await File.findById(req.params.id).lean();
      if (!file) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Файл не найден',
          status: 404,
          detail: 'Not Found',
        });
        return;
      }
      const mask = req.user?.access ?? 0;
      const uid = Number(req.user?.id);
      const belongsToTask = Boolean(file.taskId);
      const isOwner = Number.isFinite(uid) && file.userId === uid;
      const isAdmin = hasAccess(mask, ACCESS_ADMIN);
      if (!belongsToTask && !isOwner && !isAdmin) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Доступ запрещён',
          status: 403,
          detail: 'Forbidden',
        });
        return;
      }
      const uploadsAbs = path.resolve(uploadsDir);
      const target = path.resolve(uploadsAbs, file.path);
      const relative = path.relative(uploadsAbs, target);
      if (
        relative.startsWith('..') ||
        path.isAbsolute(relative) ||
        relative.length === 0
      ) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Недопустимое имя файла',
          status: 400,
          detail: 'Bad Request',
        });
        return;
      }
      const safeName = path.basename(file.name ?? file.path ?? 'file');
      const inlineMode = req.query.mode === 'inline';
      const logMessage = inlineMode ? 'Просмотрен файл' : 'Скачан файл';
      void writeLog(logMessage, 'info', { userId: uid, name: file.name });
      if (inlineMode) {
        res.type(file.type || 'application/octet-stream');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'inline');
        res.sendFile(target, (error) => {
          if (error) next(error);
        });
        return;
      }
      res.download(target, safeName, (error) => {
        if (error) next(error);
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
