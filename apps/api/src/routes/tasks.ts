// Роуты задач: CRUD, время, массовые действия
// Модули: express, express-validator, controllers/tasks, middleware/auth
import fs from 'fs';
import path from 'path';
import multer from 'multer';
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

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

interface BodyWithAttachments extends Record<string, unknown> {
  attachments?: { name: string; url: string }[];
}

export const processUploads: RequestHandler = async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length > 0) {
      const attachments = await Promise.all(
        files.map(async (f) => {
          const original = path.basename(f.originalname);
          const name = `${Date.now()}_${original}`;
          await fs.promises.writeFile(path.join(uploadsDir, name), f.buffer);
          return { name: original, url: `/uploads/${name}` };
        }),
      );
      (req.body as BodyWithAttachments).attachments = attachments;
    }
    next();
  } catch {
    res.sendStatus(500);
  }
};

const router = Router();
const ctrl = container.resolve(TasksController);
const upload = multer({ storage: multer.memoryStorage() });
const normalizeArrays: RequestHandler = (req, _res, next) => {
  ['assignees', 'controllers'].forEach((k) => {
    const v = (req.body as Record<string, unknown>)[k];
    if (v !== undefined && !Array.isArray(v)) {
      (req.body as Record<string, unknown>)[k] = [v];
    }
  });
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
