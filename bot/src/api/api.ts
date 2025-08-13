// Назначение файла: HTTP API и мини-приложение.
// Основные модули: express, express-rate-limit, сервисы, middleware
import dotenv from 'dotenv';
import config from '../config';
import express, {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';
import createRateLimiter from '../utils/rateLimiter';
import applySecurity from '../security';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import lusca from 'lusca';
import {
  body,
  validationResult,
  param,
  ValidationChain,
} from 'express-validator';
import path from 'path';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
import { register } from '../metrics';
import { swaggerUi, specs } from './swagger';
import tasksRouter from '../routes/tasks';
import mapsRouter from '../routes/maps';
import routeRouter from '../routes/route';
import routesRouter from '../routes/routes';
import optimizerRouter from '../routes/optimizer';
import authUserRouter from '../routes/authUser';
import {
  updateTaskStatus,
  writeLog,
  listMentionedTasks,
  getTask,
} from '../services/service';
import { verifyToken, asyncHandler, requestLogger } from './middleware';
import errorMiddleware from '../middleware/errorMiddleware';
import globalLimiter from '../middleware/globalLimiter';
import { sendProblem } from '../utils/problem';
import usersRouter from '../routes/users';
import rolesRouter from '../routes/roles';
import logsRouter from '../routes/logs';
import checkTaskAccess from '../middleware/taskAccess';
import container from '../di';
import { TOKENS } from '../di/tokens';
import authService from '../auth/auth.service';

dotenv.config();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection in API:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in API:', err);
  process.exit(1);
});

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

(async () => {
  const { default: connect } = await import('../db/connection');
  await connect();
  await import('../db/model');

  const app = express();
  const ext = process.env.NODE_ENV === 'test' ? '.ts' : '.js';
  const tmaAuthGuard = container.resolve<RequestHandler>(TOKENS.TmaAuthGuard);
  const traceModule = await import('../middleware/trace' + ext);
  const loggingModule = await import('../middleware/logging' + ext);
  const metricsModule = await import('../middleware/metrics' + ext);
  const trace = (traceModule.default || traceModule) as RequestHandler;
  const logging = (loggingModule.default || loggingModule) as RequestHandler;
  const metrics = (metricsModule.default || metricsModule) as RequestHandler;
  applySecurity(app);
  app.use(trace);
  app.use(logging);
  app.use(metrics);

  const root = path.join(__dirname, '../..');
  const pub = path.join(root, 'public');
  const indexFile = path.join(pub, 'index.html');
  let needBuild = false;
  try {
    const st = await fs.stat(indexFile);
    if (st.size === 0) needBuild = true;
  } catch {
    needBuild = true;
  }
  if (needBuild) {
    console.log('Сборка интерфейса...');
    await execAsync('npm run build-client', { cwd: root });
  }

  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use(compression());

  const domain =
    process.env.NODE_ENV === 'production'
      ? config.cookieDomain || new URL(config.appUrl).hostname
      : undefined;
  const cookieFlags: session.CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    ...(domain ? { domain } : {}),
  };
  const sessionOpts: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'session_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { ...cookieFlags, maxAge: 7 * 24 * 60 * 60 * 1000 },
  };
  if (process.env.NODE_ENV !== 'test') {
    sessionOpts.store = MongoStore.create({
      mongoUrl: config.mongoUrl,
      collectionName: 'sessions',
    });
  }
  app.use(session(sessionOpts));

  const csrf = lusca.csrf({
    angular: true,
    cookie: { options: cookieFlags },
  });
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
      // Используем каст, чтобы избежать обращения к несуществующему полю globalThis
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
  app.use(globalLimiter);

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
  }); // 20 запросов за 15 минут
  const tmaTasksRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 50,
    name: 'tma-tasks',
  });

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

  app.use(express.static(path.join(__dirname, '../../public')));

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

  app.get(
    '/api/tma/tasks',
    tmaTasksRateLimiter,
    tmaAuthGuard,
    asyncHandler(async (req: Request, res: Response) => {
      const initData = res.locals.initData as string;
      let userId: number;
      try {
        const params = new URLSearchParams(initData);
        const user = JSON.parse(params.get('user') || '{}');
        userId = Number(user.id);
      } catch {
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
      const initData = res.locals.initData as string;
      let userId: number;
      try {
        const params = new URLSearchParams(initData);
        const user = JSON.parse(params.get('user') || '{}');
        userId = Number(user.id);
      } catch {
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

  const port: number = config.port;
  app.listen(port, '0.0.0.0', () => {
    console.log(`API запущен на порту ${port}`);
    console.log(
      `Окружение: ${process.env.NODE_ENV || 'development'}, Node ${process.version}`,
    );
  });
})();
