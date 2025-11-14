// Роут скачивания файлов с проверкой прав
// Модули: express, middleware/auth, utils/accessMask, db/model, config/storage, wgLogEngine
import { Router, RequestHandler, NextFunction } from 'express';
import path from 'path';
import { body, param } from 'express-validator';
import authMiddleware from '../middleware/auth';
import { hasAccess, ACCESS_ADMIN } from '../utils/accessMask';
import { File, Task, type Attachment } from '../db/model';
import type { RequestWithUser } from '../types/request';
import { uploadsDir } from '../config/storage';
import { sendProblem } from '../utils/problem';
import { writeLog } from '../services/wgLogEngine';
import { deleteFile } from '../services/dataStorage';
import { syncTaskAttachments } from '../db/queries';
import { extractFileIdFromUrl } from '../utils/attachments';
import validate from '../utils/validate';

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
      const relativePath = useThumbnail
        ? (file.thumbnailPath ?? '')
        : file.path;
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

router.post(
  '/:id/attach',
  authMiddleware(),
  ...validate([
    param('id').isMongoId().withMessage('Некорректный идентификатор файла'),
    body('taskId')
      .isString()
      .withMessage('Некорректный идентификатор задачи')
      .bail()
      .trim()
      .notEmpty()
      .withMessage('ID задачи обязателен')
      .bail()
      .isMongoId()
      .withMessage('ID задачи должен быть ObjectId'),
  ]),
  async (req: RequestWithUser, res, next: NextFunction) => {
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
      const isOwner = Number.isFinite(uid) && file.userId === uid;
      const isAdmin = hasAccess(mask, ACCESS_ADMIN);
      if (!isOwner && !isAdmin) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Доступ запрещён',
          status: 403,
          detail: 'Forbidden',
        });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const taskIdRaw = typeof body.taskId === 'string' ? body.taskId : '';
      const taskId = taskIdRaw.trim();
      const task = await Task.findById(taskId).lean();
      if (!task) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Задача не найдена',
          status: 404,
          detail: 'Not Found',
        });
        return;
      }

      const allowedTaskIds = [
        task?.created_by,
        task?.assigned_user_id,
        task?.controller_user_id,
        ...(Array.isArray(task?.assignees) ? task.assignees : []),
        ...(Array.isArray(task?.controllers) ? task.controllers : []),
      ]
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
      const isTaskMember = Number.isFinite(uid) && allowedTaskIds.includes(uid);
      if (!isAdmin && !isTaskMember) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Доступ запрещён',
          status: 403,
          detail: 'Forbidden',
        });
        return;
      }

      const fileId = String(file._id ?? req.params.id);
      const baseUrl = `/api/v1/files/${fileId}`;
      const cleanupRegexSource = `/${fileId}(?:$|[/?#])`;
      const cleanupPattern = new RegExp(cleanupRegexSource, 'i');
      await Task.updateMany(
        {
          _id: { $ne: task._id },
          attachments: { $elemMatch: { url: cleanupPattern } },
        },
        {
          $pull: {
            attachments: { url: cleanupPattern },
          },
        },
      ).exec();
      const existingAttachments = Array.isArray(task.attachments)
        ? [...(task.attachments as Attachment[])]
        : [];
      const now = new Date();
      const uploadedAtSource =
        file.uploadedAt instanceof Date
          ? file.uploadedAt
          : typeof file.uploadedAt === 'string'
            ? new Date(file.uploadedAt)
            : now;
      const uploadedAt =
        uploadedAtSource instanceof Date &&
        !Number.isNaN(uploadedAtSource.getTime())
          ? uploadedAtSource
          : now;
      const uploadedByRaw =
        typeof file.userId === 'number' && Number.isFinite(file.userId)
          ? file.userId
          : Number.isFinite(uid)
            ? uid
            : undefined;
      const uploadedBy =
        typeof uploadedByRaw === 'number' && Number.isFinite(uploadedByRaw)
          ? uploadedByRaw
          : 0;
      const thumbnailUrl =
        typeof file.thumbnailPath === 'string' &&
        file.thumbnailPath.trim().length > 0
          ? `/uploads/${file.thumbnailPath.trim()}`
          : undefined;
      const payload: Attachment = {
        name: typeof file.name === 'string' ? file.name : 'Файл',
        url: baseUrl,
        uploadedBy,
        uploadedAt,
        type:
          typeof file.type === 'string' && file.type.trim().length > 0
            ? file.type
            : 'application/octet-stream',
        size:
          typeof file.size === 'number' &&
          Number.isFinite(file.size) &&
          file.size >= 0
            ? file.size
            : 0,
      };
      if (thumbnailUrl) {
        payload.thumbnailUrl = thumbnailUrl;
      }

      const nextAttachments: Attachment[] = existingAttachments.filter(
        (attachment) => extractFileIdFromUrl(attachment?.url) !== fileId,
      );
      nextAttachments.push(payload);

      await Task.updateOne(
        { _id: task._id },
        { $set: { attachments: nextAttachments } },
      );
      const userIdForSync = Number.isFinite(uid) ? uid : undefined;
      await syncTaskAttachments(taskId, nextAttachments, userIdForSync);

      res.json({ ok: true, taskId });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
