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
      if (file.userId !== uid && !hasAccess(mask, ACCESS_ADMIN)) {
        if (file.taskId) {
          const task = await Task.findById(file.taskId).lean();
          const allowedIds = [
            task?.created_by,
            task?.assigned_user_id,
            task?.controller_user_id,
            ...(task?.assignees || []),
            ...(task?.controllers || []),
          ].map((n) => Number(n));
          if (!allowedIds.includes(uid)) {
            sendProblem(req, res, {
              type: 'about:blank',
              title: 'Доступ запрещён',
              status: 403,
              detail: 'Forbidden',
            });
            return;
          }
        } else {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Доступ запрещён',
            status: 403,
            detail: 'Forbidden',
          });
          return;
        }
      }
      const target = path.resolve(uploadsDir, file.path);
      if (!target.startsWith(uploadsDir + path.sep)) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Недопустимое имя файла',
          status: 400,
          detail: 'Bad Request',
        });
        return;
      }
      void writeLog('Скачан файл', 'info', { userId: uid, name: file.name });
      res.download(target, file.name);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
