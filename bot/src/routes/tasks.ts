// Роуты задач: CRUD, время, массовые действия
// Модули: express, express-validator, controllers/tasks
import { Router, RequestHandler } from 'express';
import createRateLimiter from '../utils/rateLimiter';
import { param, query } from 'express-validator';
import * as ctrl from '../tasks/tasks.controller';
import { verifyToken } from '../api/middleware';
import validateDto from '../middleware/validateDto';
import {
  CreateTaskDto,
  UpdateTaskDto,
  AddTimeDto,
  BulkStatusDto,
} from '../dto/tasks.dto';
import checkTaskAccess from '../middleware/taskAccess';

interface ListQuery {
  status?: string;
  assignees?: string[];
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

interface TasksListResponse {
  tasks: unknown[];
  users: Record<string, unknown>;
}

interface TaskParams {
  id: string;
}

interface TaskResponse {
  task: unknown;
  users: Record<string, unknown>;
}

interface StatusResponse {
  status: string;
}

const router = Router();

const detailLimiter = createRateLimiter(15 * 60 * 1000, 100);
const tasksLimiter = createRateLimiter(15 * 60 * 1000, 100);
router.use(tasksLimiter);

router.get<unknown, TasksListResponse, unknown, ListQuery>(
  '/',
  verifyToken,
  [
    query('status').optional().isString(),
    query('assignees').optional().isArray(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1 }),
  ],
  ctrl.list as RequestHandler<unknown, TasksListResponse, unknown, ListQuery>,
);

router.get('/mentioned', verifyToken, ctrl.mentioned);

router.get<unknown, unknown, unknown, { from?: string; to?: string }>(
  '/report/summary',
  verifyToken,
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  ctrl.summary as RequestHandler,
);

router.get<TaskParams, TaskResponse>(
  '/:id',
  verifyToken,
  detailLimiter,
  [param('id').isMongoId()],
  ctrl.detail as RequestHandler<TaskParams, TaskResponse>,
);

router.post<unknown, unknown, CreateTaskDto>(
  '/',
  verifyToken,
  ...validateDto(CreateTaskDto),
  ctrl.create as RequestHandler<unknown, unknown, CreateTaskDto>,
);

router.patch<TaskParams, unknown, UpdateTaskDto>(
  '/:id',
  verifyToken,
  [param('id').isMongoId()],
  checkTaskAccess,
  ...validateDto(UpdateTaskDto),
  ctrl.update as RequestHandler<TaskParams, unknown, UpdateTaskDto>,
);

router.patch<TaskParams, unknown, AddTimeDto>(
  '/:id/time',
  verifyToken,
  [param('id').isMongoId()],
  ...validateDto(AddTimeDto),
  checkTaskAccess,
  ctrl.addTime as RequestHandler<TaskParams, unknown, AddTimeDto>,
);

router.delete<TaskParams>(
  '/:id',
  verifyToken,
  [param('id').isMongoId()],
  checkTaskAccess,
  ctrl.remove as RequestHandler<TaskParams>,
);

router.post<unknown, StatusResponse, BulkStatusDto>(
  '/bulk',
  verifyToken,
  ...validateDto(BulkStatusDto),
  ctrl.bulk as RequestHandler<unknown, StatusResponse, BulkStatusDto>,
);

export default router;

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = router;
