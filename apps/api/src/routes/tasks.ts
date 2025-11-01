// Роуты задач: CRUD, время, массовые действия, миниатюры вложений, chunk-upload
// Модули: express, express-validator, controllers/tasks, middleware/auth, multer, sharp, fluent-ffmpeg, clamdjs, wgLogEngine
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import multer from 'multer';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { Router, RequestHandler } from 'express';
import { Types } from 'mongoose';
import createRateLimiter from '../utils/rateLimiter';
import { param, query } from 'express-validator';
import container from '../di';
import TasksController from '../tasks/tasks.controller';
import authMiddleware from '../middleware/auth';
import validateDto from '../middleware/validateDto';
import {
  CreateTaskDto,
  UpdateTaskDto,
  AddTimeDto,
  BulkStatusDto,
} from '../dto/tasks.dto';
import checkTaskAccess from '../middleware/taskAccess';
import { taskFormValidators } from '../form';
import { uploadsDir } from '../config/storage';
import type RequestWithUser from '../types/request';
import { File } from '../db/model';
import { findTaskIdByPublicIdentifier, syncTaskAttachments } from '../db/queries';
import { scanFile } from '../services/antivirus';
import { writeLog } from '../services/wgLogEngine';
import {
  maxUserFiles,
  maxUserStorage,
  staleUserFilesGraceMinutes,
} from '../config/limits';
import { checkFile } from '../utils/fileCheck';
import { coerceAttachments } from '../utils/attachments';
import {
  appendPendingUpload,
} from '../utils/requestUploads';
import {
  ensureUploadContext,
  clearUploadContext,
} from '../tasks/uploadContext';
import {
  finalizePendingUploads,
  purgeTemporaryUploads,
} from '../tasks/uploadFinalizer';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_MANAGER, ACCESS_TASK_DELETE } from '../utils/accessMask';
import {
  buildFileUrl,
  buildInlineFileUrl,
  buildThumbnailUrl,
} from '../utils/fileUrls';
import { handleValidation } from '../utils/validate';

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

interface BodyWithAttachments extends Record<string, unknown> {
  attachments?: {
    name: string;
    url: string;
    thumbnailUrl?: string;
    uploadedBy?: number;
    uploadedAt?: Date;
    type?: string;
    size?: number;
  }[];
}

type AttachmentItem = NonNullable<BodyWithAttachments['attachments']>[number];

const mergeAttachments = (
  current: AttachmentItem[],
  incoming: AttachmentItem[],
): AttachmentItem[] => {
  const map = new Map<string, AttachmentItem>();
  for (const attachment of current) {
    map.set(attachment.url, attachment);
  }
  for (const attachment of incoming) {
    map.set(attachment.url, attachment);
  }
  return Array.from(map.values());
};

function readAttachmentsField(value: unknown): AttachmentItem[] {
  const parsed = coerceAttachments(value);
  return Array.isArray(parsed) ? (parsed as AttachmentItem[]) : [];
}

const uploadsDirAbs = path.resolve(uploadsDir);

function relativeToUploads(target: string): string | undefined {
  const absolute = path.resolve(target);
  const relative = path.relative(uploadsDirAbs, absolute);
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    relative.length === 0
  ) {
    return undefined;
  }
  return relative.split(path.sep).join('/');
}

async function createThumbnail(
  file: Express.Multer.File,
): Promise<string | undefined> {
  const filePath = path.join(file.destination, file.filename);
  const thumbName = `thumb_${path.parse(file.filename).name}.jpg`;
  const thumbPath = path.join(file.destination, thumbName);
  try {
    if (file.mimetype.startsWith('image/')) {
      await sharp(filePath).resize(320, 240, { fit: 'inside' }).toFile(thumbPath);
      return thumbPath;
    }
    if (file.mimetype.startsWith('video/')) {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(filePath)
          .on('end', () => resolve())
          .on('error', reject)
          .screenshots({
            count: 1,
            filename: thumbName,
            folder: file.destination,
            size: '320x?',
          });
      });
      return thumbPath;
    }
  } catch (error) {
    await fs.promises.unlink(thumbPath).catch(() => undefined);
    await writeLog('Не удалось создать миниатюру', 'warn', {
      path: filePath,
      error: (error as Error).message,
    });
  }
  return undefined;
}

function resolveNumericUserId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

const selectTaskIdCandidate = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
  }
  return undefined;
};

const readTaskIdFromRequest = (req: RequestWithUser): string | undefined => {
  const body = req.body as Record<string, unknown> | undefined;
  const bodyTaskId = selectTaskIdCandidate(body?.taskId);
  if (bodyTaskId) return bodyTaskId;
  const bodySnakeTaskId = selectTaskIdCandidate(body?.task_id);
  if (bodySnakeTaskId) return bodySnakeTaskId;
  const queryTaskId = selectTaskIdCandidate((req.query as Record<string, unknown>)?.taskId);
  if (queryTaskId) return queryTaskId;
  const querySnakeTaskId = selectTaskIdCandidate(
    (req.query as Record<string, unknown>)?.task_id,
  );
  if (querySnakeTaskId) return querySnakeTaskId;
  return undefined;
};

const syncAttachmentsForRequest = async (
  req: RequestWithUser,
  attachments: AttachmentItem[],
): Promise<void> => {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return;
  }
  const taskId = readTaskIdFromRequest(req);
  if (!taskId) {
    return;
  }
  const userId = resolveNumericUserId(req.user?.id);
  const normalizedAttachments =
    attachments as Parameters<typeof syncTaskAttachments>[1];
  try {
    await syncTaskAttachments(taskId, normalizedAttachments, userId);
    return;
  } catch (error) {
    const trimmedId = typeof taskId === 'string' ? taskId.trim() : undefined;
    if (trimmedId) {
      try {
        const resolvedId = await findTaskIdByPublicIdentifier(trimmedId, userId);
        if (resolvedId) {
          await syncTaskAttachments(resolvedId, normalizedAttachments, userId);
          return;
        }
      } catch (fallbackError) {
        await Promise.resolve(
          writeLog(
            'Не удалось привязать вложения после поиска задачи по номеру',
            'warn',
            {
              taskNumber: trimmedId,
              userId,
              error: (fallbackError as Error).message,
            },
          ),
        ).catch(() => undefined);
      }
    }
    await Promise.resolve(
      writeLog(
        'Не удалось привязать вложения к задаче при загрузке',
        'error',
        {
          taskId,
          userId,
          error: (error as Error).message,
        },
      ),
    ).catch(() => undefined);
  }
};

export const processUploads: RequestHandler = async (req, res, next) => {
  try {
    const filesRaw = req.files;
    const files = Array.isArray(filesRaw)
      ? (filesRaw as Express.Multer.File[])
      : [];
    const existingAttachments = readAttachmentsField(
      (req.body as Record<string, unknown>).attachments,
    );
    // Проверяем тип полученных файлов
    if (
      !Array.isArray(filesRaw) &&
      filesRaw !== undefined &&
      filesRaw !== null
    ) {
      res.status(400).json({ error: 'Некорректный формат загрузки файлов' });
      return;
    }
    let createdAttachments: AttachmentItem[] = [];
    if (files.length > 0) {
      const userId = resolveNumericUserId((req as RequestWithUser).user?.id);
      if (userId === undefined) {
        res.status(403).json({ error: 'Не удалось определить пользователя' });
        return;
      }
      const graceMinutes = staleUserFilesGraceMinutes;
      const shouldApplyGrace =
        Number.isFinite(graceMinutes) && graceMinutes > 0;
      const cutoff = shouldApplyGrace
        ? new Date(Date.now() - graceMinutes * 60 * 1000)
        : null;
      if (shouldApplyGrace && cutoff) {
        try {
          type StaleEntry = {
            _id: Types.ObjectId;
            path: string;
            thumbnailPath?: string | null;
          };
          const staleEntries = await File.find(
            {
              userId,
              taskId: null,
              draftId: null,
              uploadedAt: { $lte: cutoff },
            },
            { path: 1, thumbnailPath: 1 },
          )
            .lean<StaleEntry[]>()
            .exec();
          if (staleEntries.length > 0) {
            const staleIds = staleEntries.map((entry) => entry._id);
            await File.deleteMany({ _id: { $in: staleIds } });
            for (const entry of staleEntries) {
              const targets = [entry.path, entry.thumbnailPath].filter(
                (v): v is string => Boolean(v && v.length > 0),
              );
              for (const relative of targets) {
                const fullPath = path.join(uploadsDir, relative);
                await fs.promises.unlink(fullPath).catch(async (err) => {
                  await writeLog('Не удалось удалить файл', 'error', {
                    path: fullPath,
                    error: (err as Error).message,
                  });
                });
              }
            }
            await writeLog('Удалены устаревшие вложения', 'info', {
              userId,
              count: staleEntries.length,
            });
          }
        } catch (cleanupError) {
          await writeLog('Не удалось очистить устаревшие вложения', 'error', {
            userId,
            error: (cleanupError as Error).message,
          });
        }
      }
      const aggregation = await File.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            size: { $sum: '$size' },
          },
        },
      ]);
      const rawStats =
        (aggregation[0] as {
          count?: number;
          size?: number;
        } | undefined) || {};
      const stats: { count: number; size: number } = {
        count: rawStats.count ?? 0,
        size: rawStats.size ?? 0,
      };
      const incoming = files.reduce((s, f) => s + f.size, 0);
      if (
        stats.count + files.length > maxUserFiles ||
        stats.size + incoming > maxUserStorage
      ) {
        for (const f of files) {
          const p = path.join(f.destination, f.filename);
          try {
            await fs.promises.unlink(p);
          } catch (e) {
            await writeLog('Не удалось удалить файл', 'error', {
              path: p,
              error: (e as Error).message,
            });
            res.sendStatus(500);
            return;
          }
        }
        res.status(400).json({ error: 'Превышены лимиты вложений' });
        return;
      }
      for (const f of files) {
        const full = path.join(f.destination, f.filename);
        if (!(await scanFile(full))) {
          try {
            await fs.promises.unlink(full);
          } catch (e) {
            await writeLog('Не удалось удалить файл', 'error', {
              path: full,
              error: (e as Error).message,
            });
            res.sendStatus(500);
            return;
          }
          res.status(400).json({ error: 'Файл содержит вирус' });
          return;
        }
      }
      const context = ensureUploadContext(req as RequestWithUser, userId);
      const attachments: AttachmentItem[] = [];
      const isInsideDir = (baseDir: string, targetPath: string): boolean => {
        const base = path.resolve(baseDir);
        const target = path.resolve(targetPath);
        if (base === target) {
          return false;
        }
        const relative = path.relative(base, target);
        return (
          relative.length > 0 &&
          !relative.startsWith('..') &&
          !path.isAbsolute(relative)
        );
      };
      for (const f of files) {
        const original = path.basename(f.originalname);
        const storedPath = path.resolve(f.destination, f.filename);
        const withinContext = isInsideDir(context.dir, storedPath);
        const withinUploads = isInsideDir(uploadsDirAbs, storedPath);
        if (!withinContext && !withinUploads) {
          await fs.promises.unlink(storedPath).catch(() => undefined);
          const err = new Error('INVALID_PATH');
          throw err;
        }
        const thumbAbs = await createThumbnail(f);
        const placeholder = `temp://${randomBytes(12).toString('hex')}`;
        appendPendingUpload(req, {
          placeholder,
          tempPath: storedPath,
          tempThumbnailPath: thumbAbs,
          tempDir: context.dir,
          originalName: original,
          mimeType: f.mimetype,
          size: f.size,
          userId,
        });
        attachments.push({
          name: original,
          url: placeholder,
          thumbnailUrl: undefined,
          uploadedBy: userId,
          uploadedAt: new Date(),
          type: f.mimetype,
          size: f.size,
        });
      }
      createdAttachments = attachments;
    }
    (req.body as BodyWithAttachments).attachments = mergeAttachments(
      existingAttachments,
      createdAttachments,
    );
    next();
  } catch (error) {
    await purgeTemporaryUploads(req).catch(() => undefined);
    if (res.headersSent) return;
    if ((error as Error).message === 'INVALID_PATH') {
      res.status(400).json({ error: 'Недопустимый путь файла' });
      return;
    }
    res.sendStatus(500);
  }
};

const router: Router = Router();
const ctrl = container.resolve(TasksController);
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = resolveNumericUserId((req as RequestWithUser).user?.id);
    if (userId === undefined) {
      cb(new Error('UPLOAD_USER_RESOLVE_FAILED'), '');
      return;
    }
    let contextDir = '';
    try {
      const context = ensureUploadContext(req as RequestWithUser, userId);
      contextDir = context.dir;
      fs.mkdirSync(contextDir, { recursive: true });
      cb(null, contextDir);
    } catch (error) {
      cb(error as Error, contextDir);
    }
  },
  filename: (_req, file, cb) => {
    const original = path.basename(file.originalname);
    cb(null, `${Date.now()}_${original}`);
  },
});
const maxUploadSize = 10 * 1024 * 1024;

const sharedFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (checkFile(file)) {
    cb(null, true);
    return;
  }
  cb(new Error('Недопустимый тип файла'));
};

const sharedLimits: multer.Options['limits'] = {
  fileSize: maxUploadSize,
};

const upload = multer({
  storage,
  fileFilter: sharedFileFilter,
  limits: sharedLimits,
});
const inlineUpload = upload.single('upload');

const chunkUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: sharedFileFilter,
  limits: sharedLimits,
});

const chunkUploadMiddleware: RequestHandler = (req, res, next) => {
  chunkUpload.single('file')(req, res, (err) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? 'Файл превышает допустимый размер'
        : (err as Error).message;
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
};

const detailLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  name: 'task-detail',
});
const tasksLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  name: 'tasks',
});

router.use(authMiddleware());
router.use(tasksLimiter as unknown as RequestHandler);

const requireTaskCreationRights: RequestHandler[] = [
  Roles(ACCESS_MANAGER) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
];

const handleInlineUpload: RequestHandler = async (req, res) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ error: 'Файл не получен' });
      return;
    }
    if (!file.mimetype.startsWith('image/')) {
      res.status(400).json({ error: 'Допустимы только изображения' });
      return;
    }
    (req as { files?: Express.Multer.File[] }).files = [file];
    (req.body as BodyWithAttachments).attachments = [];
    await new Promise<void>((resolve, reject) => {
      processUploads(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    if (res.headersSent) {
      await purgeTemporaryUploads(req).catch(() => undefined);
      return;
    }
    const bodyWithAttachments = req.body as BodyWithAttachments;
    const finalizeResult = await finalizePendingUploads({
      req: req as RequestWithUser,
      attachments: bodyWithAttachments.attachments ?? [],
    });
    bodyWithAttachments.attachments =
      finalizeResult.attachments as AttachmentItem[];
    if (res.headersSent) return;
    const attachment = bodyWithAttachments.attachments?.[0];
    if (!attachment?.url) {
      res.status(500).json({ error: 'Не удалось сохранить файл' });
      return;
    }
    await syncAttachmentsForRequest(req as RequestWithUser, [attachment]);
    const inlineUrl = (() => {
      const base = attachment.url;
      if (typeof base !== 'string') {
        return base;
      }
      const [pathPart] = base.split('?');
      const segments = pathPart.split('/').filter(Boolean);
      const identifier = segments[segments.length - 1];
      return identifier ? buildInlineFileUrl(identifier) : base;
    })();
    res.json({
      url: inlineUrl,
      thumbnailUrl: attachment.thumbnailUrl,
      originalUrl: attachment.url,
    });
  } catch (error) {
    if (res.headersSent) return;
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Не удалось загрузить файл';
    res.status(500).json({ error: message });
  }
};

export const handleChunks: RequestHandler = async (req, res) => {
  try {
    const { fileId, chunkIndex, totalChunks } = req.body as Record<
      string,
      string
    >;
    // Проверяем допустимость идентификатора файла
    if (typeof fileId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(fileId)) {
      res.status(400).json({ error: 'Недопустимый идентификатор файла' });
      return;
    }
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ error: 'Файл не получен' });
      return;
    }
    const idx = Number(chunkIndex);
    const total = Number(totalChunks);
    // Проверяем индексы чанков
    if (
      !Number.isInteger(idx) ||
      !Number.isInteger(total) ||
      idx < 0 ||
      total <= 0 ||
      idx >= total
    ) {
      res.status(400).json({ error: 'Недопустимый индекс' });
      return;
    }
    const userId = resolveNumericUserId((req as RequestWithUser).user?.id);
    if (userId === undefined) {
      res.status(403).json({ error: 'Не удалось определить пользователя' });
      return;
    }
    const context = ensureUploadContext(req as RequestWithUser, userId);
    const baseDir = context.dir;
    const dir = path.resolve(baseDir, fileId);
    // Не допускаем выход за пределы каталога пользователя
    if (!dir.startsWith(baseDir + path.sep)) {
      res.status(400).json({ error: 'Недопустимый путь' });
      return;
    }
    fs.mkdirSync(dir, { recursive: true });
    const chunkPath = path.resolve(dir, String(idx));
    if (!chunkPath.startsWith(dir + path.sep)) {
      res.status(400).json({ error: 'Недопустимый путь части' });
      return;
    }
    fs.writeFileSync(chunkPath, file.buffer);
    if (idx + 1 === total) {
      const originalName = path.basename(file.originalname);
      const storedName = `${Date.now()}_${originalName}`;
      const final = path.resolve(dir, storedName);
      let cleanedTemp = false;
      const cleanupTemp = () => {
        if (!cleanedTemp) {
          fs.rmSync(dir, { recursive: true, force: true });
          cleanedTemp = true;
        }
      };
      if (!final.startsWith(dir + path.sep)) {
        cleanupTemp();
        res.status(400).json({ error: 'Недопустимое имя файла' });
        return;
      }
      let assembledSize = 0;
      for (let i = 0; i < total; i++) {
        const partPath = path.resolve(dir, String(i));
        if (!partPath.startsWith(dir + path.sep)) {
          fs.rmSync(final, { force: true });
          cleanupTemp();
          res.status(400).json({ error: 'Недопустимый путь части' });
          return;
        }
        const part = fs.readFileSync(partPath);
        assembledSize += part.length;
        fs.appendFileSync(final, part);
        fs.unlinkSync(partPath);
      }
      if (assembledSize > maxUploadSize) {
        fs.rmSync(final, { force: true });
        cleanupTemp();
        res.status(400).json({ error: 'Файл превышает допустимый размер' });
        return;
      }
      const targetDir = context.dir;
      fs.mkdirSync(targetDir, { recursive: true });
      const target = path.resolve(targetDir, storedName);
      if (!target.startsWith(targetDir + path.sep)) {
        fs.rmSync(final, { force: true });
        cleanupTemp();
        res.status(400).json({ error: 'Недопустимое имя файла' });
        return;
      }
      fs.renameSync(final, target);
      const diskFile: Express.Multer.File = {
        ...file,
        destination: targetDir,
        filename: storedName,
        path: target,
        size: assembledSize,
        buffer: Buffer.alloc(0),
        originalname: originalName,
      };
      (req.files as Express.Multer.File[]) = [diskFile];
      (req as { file?: Express.Multer.File }).file = diskFile;
      try {
        await processUploads(req, res, () => {});
      } finally {
        cleanupTemp();
      }
      if (res.headersSent) {
        await purgeTemporaryUploads(req).catch(() => undefined);
        return;
      }
      const bodyWithAttachments = req.body as BodyWithAttachments;
      const finalizeResult = await finalizePendingUploads({
        req: req as RequestWithUser,
        attachments: bodyWithAttachments.attachments ?? [],
      });
      bodyWithAttachments.attachments =
        finalizeResult.attachments as AttachmentItem[];
      if (res.headersSent) return;
      const attachment = bodyWithAttachments.attachments?.[0];
      if (!attachment) {
        res.sendStatus(500);
        return;
      }
      await syncAttachmentsForRequest(req as RequestWithUser, [attachment]);
      res.json(attachment);
      return;
    }
    res.json({ received: idx });
  } catch {
    res.sendStatus(500);
  }
};

router.post(
  '/upload-chunk',
  ...requireTaskCreationRights,
  chunkUploadMiddleware,
  handleChunks,
);
router.post(
  '/upload-inline',
  ...requireTaskCreationRights,
  inlineUpload,
  handleInlineUpload,
);
function normalizeUserId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export const normalizeArrays: RequestHandler = (req, _res, next) => {
  const body = req.body as Record<string, unknown>;
  const requestUserId = (req as RequestWithUser).user?.id;
  const hasAssignedUserId =
    body.assigned_user_id !== undefined ||
    (body as Record<string, unknown>).assignedUserId !== undefined;
  const hasAssignees = body.assignees !== undefined;

  const normalizedId = normalizeUserId(requestUserId);

  if (
    req.method === 'POST' &&
    !hasAssignedUserId &&
    !hasAssignees &&
    normalizedId &&
    normalizedId.length > 0
  ) {
    body.assigned_user_id = normalizedId;
    body.assignees = [normalizedId];
  }

  const assignedRaw =
    body.assigned_user_id ?? (body as Record<string, unknown>).assignedUserId;
  if (assignedRaw !== undefined) {
    const pickValue = Array.isArray(assignedRaw)
      ? assignedRaw.find(
          (item) =>
            item !== null &&
            item !== undefined &&
            !(typeof item === 'string' && item.trim().length === 0),
        )
      : assignedRaw;
    if (
      pickValue === null ||
      pickValue === undefined ||
      (typeof pickValue === 'string' && pickValue.trim().length === 0)
    ) {
      body.assigned_user_id = null;
      body.assignees = [];
    } else {
      const normalized =
        typeof pickValue === 'string' ? pickValue.trim() : pickValue;
      body.assigned_user_id = normalized;
      body.assignees = [normalized];
    }
  } else if (body.assignees !== undefined) {
    const rawAssignees = Array.isArray(body.assignees)
      ? body.assignees
      : [body.assignees];
    const normalizedAssignees = rawAssignees
      .map((item) => (typeof item === 'string' ? item.trim() : item))
      .filter(
        (item) =>
          item !== null &&
          item !== undefined &&
          !(typeof item === 'string' && item.length === 0),
      );
    body.assignees = normalizedAssignees;
  }
  const controllersValue = body.controllers;
  if (controllersValue !== undefined && !Array.isArray(controllersValue)) {
    body.controllers = [controllersValue];
  }
  const attachmentsField = (req.body as Record<string, unknown>).attachments;
  if (attachmentsField !== undefined) {
    (req.body as BodyWithAttachments).attachments = readAttachmentsField(
      attachmentsField,
    );
  }
  next();
};

router.get(
  '/',
  [
    query('status').optional().isString(),
    query('assignees')
      .optional()
      .custom((value) => Array.isArray(value) || typeof value === 'string'),
    query('assignee').optional().isString(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1 }),
    query('kind').optional().isIn(['task', 'request']),
    query('taskType').optional().isString(),
  ] as RequestHandler[],
  ctrl.list as RequestHandler,
);

router.get(
  '/executors',
  [query('kind').optional().isIn(['task', 'request'])] as RequestHandler[],
  ctrl.executors as RequestHandler,
);

router.get('/mentioned', ctrl.mentioned);

router.get('/transport-options', ctrl.transportOptions as RequestHandler);

router.get(
  '/report.pdf',
  [
    query('status').optional().isString(),
    query('assignees')
      .optional()
      .custom((value) => Array.isArray(value) || typeof value === 'string'),
    query('assignee').optional().isString(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('kind').optional().isIn(['task', 'request']),
    query('taskType').optional().isString(),
  ] as RequestHandler[],
  handleValidation as unknown as RequestHandler,
  ctrl.downloadPdf as RequestHandler,
);

router.get(
  '/report.xlsx',
  [
    query('status').optional().isString(),
    query('assignees')
      .optional()
      .custom((value) => Array.isArray(value) || typeof value === 'string'),
    query('assignee').optional().isString(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('kind').optional().isIn(['task', 'request']),
    query('taskType').optional().isString(),
  ] as RequestHandler[],
  handleValidation as unknown as RequestHandler,
  ctrl.downloadExcel as RequestHandler,
);

router.get(
  '/report/summary',
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('kind').optional().isIn(['task', 'request']),
  ],
  ctrl.summary as RequestHandler,
);

router.get(
  '/report/chart',
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('kind').optional().isIn(['task', 'request']),
  ],
  ctrl.chart as RequestHandler,
);

router.get(
  '/:id',
  // Приводим лимитер к типу Express 5
  detailLimiter as unknown as RequestHandler,
  param('id').isMongoId(),
  ctrl.detail as RequestHandler,
);

router.post(
  '/requests',
  upload.any(),
  processUploads,
  normalizeArrays,
  ...(taskFormValidators as unknown as RequestHandler[]),
  ...(validateDto(CreateTaskDto) as RequestHandler[]),
  ...(ctrl.createRequest as RequestHandler[]),
);

router.post(
  '/',
  ...requireTaskCreationRights,
  upload.any(),
  processUploads,
  normalizeArrays,
  ...(taskFormValidators as unknown as RequestHandler[]),
  ...(validateDto(CreateTaskDto) as RequestHandler[]),
  ...(ctrl.create as RequestHandler[]),
);

router.patch(
  '/:id',
  param('id').isMongoId(),
  upload.any(),
  checkTaskAccess as unknown as RequestHandler,
  processUploads,
  normalizeArrays,
  ...(validateDto(UpdateTaskDto) as RequestHandler[]),
  ...(ctrl.update as RequestHandler[]),
);

router.patch(
  '/:id/time',
  Roles(ACCESS_MANAGER) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  param('id').isMongoId(),
  ...(validateDto(AddTimeDto) as RequestHandler[]),
  checkTaskAccess as unknown as RequestHandler,
  ...(ctrl.addTime as RequestHandler[]),
);

router.delete(
  '/:id',
  param('id').isMongoId(),
  Roles(ACCESS_TASK_DELETE) as unknown as RequestHandler, // удаление только для уровня 8
  rolesGuard as unknown as RequestHandler,
  checkTaskAccess as unknown as RequestHandler,
  ctrl.remove as RequestHandler,
);

router.post(
  '/bulk',
  Roles(ACCESS_MANAGER) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  ...(validateDto(BulkStatusDto) as RequestHandler[]),
  ...(ctrl.bulk as RequestHandler[]),
);

export default router;
