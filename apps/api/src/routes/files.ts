// Роут скачивания файлов с проверкой прав
// Модули: express, middleware/auth, utils/accessMask, db/model, config/storage, wgLogEngine
import { Router, RequestHandler } from 'express';
import path from 'path';
import { param } from 'express-validator';
import authMiddleware from '../middleware/auth';
import { hasAccess, ACCESS_ADMIN } from '../utils/accessMask';
import { File, Task } from '../db/model';
import type { RequestWithUser } from '../types/request';
import { uploadsDir } from '../config/storage';
import { sendProblem } from '../utils/problem';
import { writeLog } from '../services/wgLogEngine';
import { deleteFile } from '../services/dataStorage';

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
      if (!isOwner && !isAdmin) {
        if (!belongsToTask) {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Доступ запрещён',
            status: 403,
            detail: 'Forbidden',
          });
          return;
        }
        const task = await Task.findById(file.taskId).lean();
        const allowedIds = [
          task?.created_by,
          task?.assigned_user_id,
          task?.controller_user_id,
          ...(task?.assignees || []),
          ...(task?.controllers || []),
        ]
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value));
        if (!Number.isFinite(uid) || !allowedIds.includes(uid)) {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Доступ запрещён',
            status: 403,
            detail: 'Forbidden',
          });
          return;
        }
      }
      const uploadsAbs = path.resolve(uploadsDir);
      const variant =
        typeof req.query.variant === 'string' ? req.query.variant : undefined;
      const useThumbnail = variant === 'thumbnail';
      if (useThumbnail && !file.thumbnailPath) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Файл не найден',
          status: 404,
          detail: 'Not Found',
        });
        return;
      }
      const relativePath = useThumbnail ? file.thumbnailPath ?? '' : file.path;
      const uploadsTarget = path.resolve(uploadsAbs, relativePath);
      const relative = path.relative(uploadsAbs, uploadsTarget);
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
        const mime = useThumbnail
          ? 'image/jpeg'
          : file.type || 'application/octet-stream';
        res.type(mime);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'inline');
        res.sendFile(uploadsTarget, (error) => {
          if (error) next(error);
        });
        return;
      }
      res.download(uploadsTarget, safeName, (error) => {
        if (error) next(error);
      });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
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
      if (!isOwner && !isAdmin) {
        if (!belongsToTask) {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Доступ запрещён',
            status: 403,
            detail: 'Forbidden',
          });
          return;
        }
        const task = await Task.findById(file.taskId).lean();
        const allowedIds = [
          task?.created_by,
          task?.assigned_user_id,
          task?.controller_user_id,
          ...(task?.assignees || []),
          ...(task?.controllers || []),
        ]
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value));
        if (!Number.isFinite(uid) || !allowedIds.includes(uid)) {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Доступ запрещён',
            status: 403,
            detail: 'Forbidden',
          });
          return;
        }
      }
      await deleteFile(req.params.id);
      void writeLog('Удалён файл', 'info', { userId: uid, name: file.name });
      res.status(204).send();
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Файл не найден',
          status: 404,
          detail: 'Not Found',
        });
        return;
      }
      next(error);
    }
  },
);

export default router;
