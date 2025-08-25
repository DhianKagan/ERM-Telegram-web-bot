// Роуты задач: CRUD, время, массовые действия, миниатюры вложений, chunk-upload
// Модули: express, express-validator, controllers/tasks, middleware/auth, multer, sharp, fluent-ffmpeg
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

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

interface BodyWithAttachments extends Record<string, unknown> {
  attachments?: {
    name: string;
    url: string;
    thumbnailUrl?: string;
    uploadedBy: number;
    uploadedAt: Date;
    type: string;
    size: number;
  }[];
}

async function createThumbnail(
  file: Express.Multer.File,
  userId: number,
): Promise<string | undefined> {
  const filePath = path.join(file.destination, file.filename);
  const thumbName = `thumb_${path.parse(file.filename).name}.jpg`;
  const thumbPath = path.join(file.destination, thumbName);
  if (file.mimetype.startsWith('image/')) {
    await sharp(filePath).resize(320, 240, { fit: 'inside' }).toFile(thumbPath);
    return `${userId}/${thumbName}`;
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
    return `${userId}/${thumbName}`;
  }
  return undefined;
}

export const processUploads: RequestHandler = async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length > 0) {
      const userId = (req as RequestWithUser).user?.id as number;
      const attachments = await Promise.all(
        files.map(async (f) => {
          const original = path.basename(f.originalname);
          const thumbRel = await createThumbnail(f, userId);
          const doc = await File.create({
            userId,
            name: original,
            path: `${userId}/${f.filename}`,
            thumbnailPath: thumbRel,
            type: f.mimetype,
            size: f.size,
          });
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
      (req.body as BodyWithAttachments).attachments = attachments;
    }
    next();
  } catch {
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
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const chunkUpload = multer({ storage: multer.memoryStorage() });

const handleChunks: RequestHandler = async (req, res) => {
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
    const baseDir = path.resolve(uploadsDir, String(userId));
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
      const final = path.resolve(dir, path.basename(file.originalname));
      if (!final.startsWith(dir + path.sep)) {
        res.status(400).json({ error: 'Недопустимое имя файла' });
        return;
      }
      for (let i = 0; i < total; i++) {
        const partPath = path.resolve(dir, String(i));
        if (!partPath.startsWith(dir + path.sep)) {
          res.status(400).json({ error: 'Недопустимый путь части' });
          return;
        }
        const part = fs.readFileSync(partPath);
        fs.appendFileSync(final, part);
        fs.unlinkSync(partPath);
      }
      const diskFile: Express.Multer.File = {
        ...file,
        destination: dir,
        filename: path.basename(file.originalname),
        path: final,
        size: fs.statSync(final).size,
        buffer: Buffer.alloc(0),
      };
      (req.files as Express.Multer.File[]) = [diskFile];
      await processUploads(req, res, () => {});
      fs.rmSync(dir, { recursive: true, force: true });
      res.json((req.body as BodyWithAttachments).attachments?.[0]);
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
  chunkUpload.single('file'),
  handleChunks,
);
/**
 * Нормализует массивы и парсит вложения из JSON-строк.
 * Поддерживает поля исполнителей, контролёров и вложений.
 */
export const normalizeArrays: RequestHandler = (req, _res, next) => {
  ['assignees', 'controllers'].forEach((k) => {
    const v = (req.body as Record<string, unknown>)[k];
    if (v !== undefined && !Array.isArray(v)) {
      (req.body as Record<string, unknown>)[k] = [v];
    }
  });
  const at = (req.body as BodyWithAttachments).attachments;
  if (typeof at === 'string') {
    try {
      (req.body as BodyWithAttachments).attachments = JSON.parse(at);
    } catch {
      (req.body as BodyWithAttachments).attachments = [];
    }
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
  param('id').isMongoId(),
  ...(validateDto(AddTimeDto) as RequestHandler[]),
  checkTaskAccess as unknown as RequestHandler,
  ...(ctrl.addTime as RequestHandler[]),
);

router.delete(
  '/:id',
  authMiddleware(),
  param('id').isMongoId(),
  checkTaskAccess as unknown as RequestHandler,
  ctrl.remove as RequestHandler,
);

router.post(
  '/bulk',
  authMiddleware(),
  ...(validateDto(BulkStatusDto) as RequestHandler[]),
  ...(ctrl.bulk as RequestHandler[]),
);

export default router;
