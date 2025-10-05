// Роуты задач: CRUD, время, массовые действия, миниатюры вложений, chunk-upload
// Модули: express, express-validator, controllers/tasks, middleware/auth, multer, sharp, fluent-ffmpeg, clamscan, wgLogEngine
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { Router, RequestHandler } from 'express';
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
import { scanFile } from '../services/antivirus';
import { writeLog } from '../services/wgLogEngine';
import { maxUserFiles, maxUserStorage } from '../config/limits';
import { checkFile } from '../utils/fileCheck';
import { coerceAttachments } from '../utils/attachments';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN, ACCESS_MANAGER } from '../utils/accessMask';

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
      return relativeToUploads(thumbPath);
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
      return relativeToUploads(thumbPath);
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
      const userId = (req as RequestWithUser).user?.id as number;
      const agg = await File.aggregate([
        { $match: { userId } },
        { $group: { _id: null, count: { $sum: 1 }, size: { $sum: '$size' } } },
      ]);
      const cur = agg[0] || { count: 0, size: 0 };
      const incoming = files.reduce((s, f) => s + f.size, 0);
      if (
        cur.count + files.length > maxUserFiles ||
        cur.size + incoming > maxUserStorage
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
      const attachments = await Promise.all(
        files.map(async (f) => {
          const original = path.basename(f.originalname);
          const storedPath = path.join(f.destination, f.filename);
          const relative = relativeToUploads(storedPath);
          if (!relative) {
            await fs.promises.unlink(storedPath).catch(() => undefined);
            const err = new Error('INVALID_PATH');
            throw err;
          }
          const thumbRel = await createThumbnail(f);
          const doc = await File.create({
            userId,
            name: original,
            path: relative,
            thumbnailPath: thumbRel,
            type: f.mimetype,
            size: f.size,
          });
          await writeLog('Загружен файл', 'info', { userId, name: original });
          return {
            name: original,
            url: `/api/v1/files/${String(doc._id)}`,
            thumbnailUrl: thumbRel ? `/uploads/${thumbRel}` : undefined,
            uploadedBy: userId,
            uploadedAt: new Date(),
            type: f.mimetype,
            size: f.size,
          };
        }),
      );
      createdAttachments = attachments;
    }
    (req.body as BodyWithAttachments).attachments = mergeAttachments(
      existingAttachments,
      createdAttachments,
    );
    next();
  } catch (error) {
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
    const userId = (req as RequestWithUser).user?.id;
    const dest = path.join(uploadsDir, String(userId));
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
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
    if (res.headersSent) return;
    const attachment = (req.body as BodyWithAttachments).attachments?.[0];
    if (!attachment?.url) {
      res.status(500).json({ error: 'Не удалось сохранить файл' });
      return;
    }
    res.json({
      url: `${attachment.url}?mode=inline`,
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
    const file = req.file as Express.Multer.File;
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
    const userId = (req as RequestWithUser).user?.id as number;
    const baseDir = path.resolve(uploadsDirAbs, String(userId));
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
      const userDir = path.resolve(uploadsDirAbs, String(userId));
      fs.mkdirSync(userDir, { recursive: true });
      const target = path.resolve(userDir, storedName);
      if (!target.startsWith(userDir + path.sep)) {
        fs.rmSync(final, { force: true });
        cleanupTemp();
        res.status(400).json({ error: 'Недопустимое имя файла' });
        return;
      }
      fs.renameSync(final, target);
      const diskFile: Express.Multer.File = {
        ...file,
        destination: userDir,
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
      if (res.headersSent) return;
      const attachment = (req.body as BodyWithAttachments).attachments?.[0];
      if (!attachment) {
        res.sendStatus(500);
        return;
      }
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
  authMiddleware(),
  chunkUploadMiddleware,
  handleChunks,
);
router.post(
  '/upload-inline',
  authMiddleware(),
  inlineUpload,
  handleInlineUpload,
);
export const normalizeArrays: RequestHandler = (req, _res, next) => {
  const body = req.body as Record<string, unknown>;
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
// Приводим лимитер к типу Express 5
router.use(tasksLimiter as unknown as RequestHandler);

router.get(
  '/',
  authMiddleware(),
  [
    query('status').optional().isString(),
    query('assignees').optional().isArray(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1 }),
  ] as RequestHandler[],
  ctrl.list as RequestHandler,
);

router.get('/mentioned', authMiddleware(), ctrl.mentioned);

router.get(
  '/report/summary',
  authMiddleware(),
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  ctrl.summary as RequestHandler,
);

router.get(
  '/:id',
  authMiddleware(),
  // Приводим лимитер к типу Express 5
  detailLimiter as unknown as RequestHandler,
  param('id').isMongoId(),
  ctrl.detail as RequestHandler,
);

router.post(
  '/',
  authMiddleware(),
  upload.any(),
  processUploads,
  normalizeArrays,
  Roles(ACCESS_MANAGER) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  ...(taskFormValidators as unknown as RequestHandler[]),
  ...(validateDto(CreateTaskDto) as RequestHandler[]),
  ...(ctrl.create as RequestHandler[]),
);

router.patch(
  '/:id',
  authMiddleware(),
  upload.any(),
  processUploads,
  normalizeArrays,
  param('id').isMongoId(),
  checkTaskAccess as unknown as RequestHandler,
  ...(validateDto(UpdateTaskDto) as RequestHandler[]),
  ...(ctrl.update as RequestHandler[]),
);

router.patch(
  '/:id/time',
  authMiddleware(),
  Roles(ACCESS_MANAGER) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  param('id').isMongoId(),
  ...(validateDto(AddTimeDto) as RequestHandler[]),
  checkTaskAccess as unknown as RequestHandler,
  ...(ctrl.addTime as RequestHandler[]),
);

router.delete(
  '/:id',
  authMiddleware(),
  param('id').isMongoId(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler, // только админам
  rolesGuard as unknown as RequestHandler,
  checkTaskAccess as unknown as RequestHandler,
  ctrl.remove as RequestHandler,
);

router.post(
  '/bulk',
  authMiddleware(),
  Roles(ACCESS_MANAGER) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  ...(validateDto(BulkStatusDto) as RequestHandler[]),
  ...(ctrl.bulk as RequestHandler[]),
);

export default router;
