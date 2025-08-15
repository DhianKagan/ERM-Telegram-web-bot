// Назначение файла: настройка маршрутов HTTP API.
// Основные модули: express, middleware, сервисы, роутеры
import express, {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';
import type { CookieOptions } from 'express-session';
import path from 'path';
import cors from 'cors';
import lusca from 'lusca';
import {
  body,
  validationResult,
  param,
  ValidationChain,
} from 'express-validator';
import createRateLimiter from '../utils/rateLimiter';
import { swaggerUi, specs } from './swagger';
import { register } from '../metrics';
import { verifyToken, asyncHandler, requestLogger } from './middleware';
import errorMiddleware from '../middleware/errorMiddleware';
import globalLimiter from '../middleware/globalLimiter';
import tasksRouter from '../routes/tasks';
import mapsRouter from '../routes/maps';
import routeRouter from '../routes/route';
import routesRouter from '../routes/routes';
import optimizerRouter from '../routes/optimizer';
import authUserRouter from '../routes/authUser';
import usersRouter from '../routes/users';
import rolesRouter from '../routes/roles';
import logsRouter from '../routes/logs';
import taskTemplatesRouter from '../routes/taskTemplates';
import checkTaskAccess from '../middleware/taskAccess';
import { sendProblem } from '../utils/problem';
import {
  updateTaskStatus,
  writeLog,
  listMentionedTasks,
  getTask,
} from '../services/service';
import container from '../di';
import { TOKENS } from '../di/tokens';
import authService from '../auth/auth.service';

const validate = (validations: ValidationChain[]): RequestHandler[] => [
  ...validations,
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Ошибка валидации',
      status: 400,
      detail: JSON.stringify(errors.array()),
    });
  },
];

export default async function registerRoutes(
  app: express.Express,
  cookieFlags: CookieOptions,
  pub: string,
): Promise<void> {
  const csrf = lusca.csrf({ angular: true, cookie: { options: cookieFlags } });
  const csrfExclude = [
    '/api/v1/auth/send_code',
    '/api/v1/auth/verify_code',
    '/api/v1/csrf',
    '/api/v1/optimizer',
    '/api/v1/maps/expand',
  ];
  const csrfExcludePrefix = ['/api/tma'];
  app.use((req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl.split('?')[0];
    if (process.env.DISABLE_CSRF === '1') {
      if (!(globalThis as Record<string, unknown>).csrfWarn) {
        console.warn('CSRF middleware disabled');
        (globalThis as Record<string, unknown>).csrfWarn = true;
      }
      return next();
    }
    if (
      csrfExclude.includes(url) ||
      csrfExcludePrefix.some((p) => url.startsWith(p)) ||
      req.headers.authorization
    )
      return next();
    return csrf(req, res, next);
  });

  app.use(cors());
  const prefix = '/api/v1';
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  app.use(requestLogger);
  app.use('/api', globalLimiter);

  const taskStatusRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 50,
    name: 'task-status',
  });
  const spaRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 50,
    name: 'spa',
  });
  const tmaLoginRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    name: 'tma-login',
  });
  const tmaTasksRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 50,
    name: 'tma-tasks',
  });

  const tmaAuthGuard = container.resolve<RequestHandler>(TOKENS.TmaAuthGuard);

  /**
   * @openapi
   * /api/auth/tma-login:
   *   post:
   *     summary: Вход через Telegram Mini App
   *     responses:
   *       200:
   *         description: Токен доступа
   *       401:
   *         $ref: '#/components/responses/Problem'
   */
  app.post(
    '/api/auth/tma-login',
    tmaLoginRateLimiter,
    tmaAuthGuard,
    asyncHandler(async (_req: Request, res: Response) => {
      const token = await authService.verifyTmaLogin(res.locals.initData);
      res.json({ token });
    }),
  );

  app.get('/health', (_req: Request, res: Response) =>
    res.json({ status: 'ok' }),
  );
  app.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
  app.get(`${prefix}/csrf`, csrf, (req: Request, res: Response) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  app.use(
    express.static(path.join(__dirname, '../../public'), {
      maxAge: '1y',
      immutable: true,
    }),
  );
  const initAdmin = (await import('../admin/customAdmin')).default;
  initAdmin(app);

  app.use(`${prefix}/users`, usersRouter);
  app.use(`${prefix}/roles`, rolesRouter);
  app.use(`${prefix}/logs`, logsRouter);
  app.use(`${prefix}/auth`, authUserRouter);
  app.use(`${prefix}/maps`, mapsRouter);
  app.use(`${prefix}/route`, routeRouter);
  app.use(`${prefix}/optimizer`, optimizerRouter);
  app.use(`${prefix}/routes`, routesRouter);
  app.use(`${prefix}/tasks`, tasksRouter);
  app.use(`${prefix}/task-templates`, taskTemplatesRouter);

  app.get(
    '/api/tma/tasks',
    tmaTasksRateLimiter,
    tmaAuthGuard,
    asyncHandler(async (req: Request, res: Response) => {
      const initData = res.locals.initData as { user?: { id?: number } };
      const userId = Number(initData.user?.id);
      if (!userId) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Ошибка авторизации',
          status: 401,
          detail: 'invalid user',
        });
        return;
      }
      const tasks = await listMentionedTasks(userId);
      res.json(tasks);
    }),
  );

  app.patch(
    '/api/tma/tasks/:id/status',
    tmaTasksRateLimiter,
    tmaAuthGuard,
    [param('id').isMongoId()],
    validate([
      body('status').isIn(['Новая', 'В работе', 'Выполнена', 'Отменена']),
    ]),
    asyncHandler(async (req: Request, res: Response) => {
      const initData = res.locals.initData as { user?: { id?: number } };
      const userId = Number(initData.user?.id);
      if (!userId) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Ошибка авторизации',
          status: 401,
          detail: 'invalid user',
        });
        return;
      }
      const task = await getTask(req.params.id);
      if (!task) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Задача не найдена',
          status: 404,
          detail: 'Not Found',
        });
        return;
      }
      const ids = [
        task.assigned_user_id,
        task.controller_user_id,
        ...(task.controllers || []),
        ...(task.assignees || []),
        task.created_by,
      ].map((id) => Number(id));
      if (!ids.includes(userId)) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Доступ запрещён',
          status: 403,
          detail: 'Forbidden',
        });
        return;
      }
      await updateTaskStatus(req.params.id, req.body.status);
      await writeLog(
        `Статус задачи ${req.params.id} -> ${req.body.status} пользователем ${userId}`,
      );
      res.json({ status: 'ok' });
    }),
  );

  app.patch(
    `${prefix}/tasks/:id/status`,
    taskStatusRateLimiter,
    verifyToken,
    [param('id').isMongoId()],
    checkTaskAccess,
    validate([
      body('status').isIn(['Новая', 'В работе', 'Выполнена', 'Отменена']),
    ]),
    asyncHandler(async (req: Request, res: Response) => {
      await updateTaskStatus(req.params.id, req.body.status);
      await writeLog(`Статус задачи ${req.params.id} -> ${req.body.status}`);
      res.json({ status: 'ok' });
    }),
  );

  app.get('/', spaRateLimiter, (_req: Request, res: Response) => {
    res.sendFile(path.join(pub, 'index.html'));
  });

  app.get('/*splat', spaRateLimiter, (_req: Request, res: Response) => {
    res.sendFile(path.join(pub, 'index.html'));
  });

  app.use(errorMiddleware);
}
