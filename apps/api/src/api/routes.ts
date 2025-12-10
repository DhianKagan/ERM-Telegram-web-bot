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
import { readFile, stat } from 'node:fs/promises';
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
import healthcheck from './healthcheck';
import errorMiddleware from '../middleware/errorMiddleware';
import globalLimiter from '../middleware/globalLimiter';
import tasksRouter from '../routes/tasks';
import taskDraftsRouter from '../routes/taskDrafts';
import mapsRouter from '../routes/maps';
import routeRouter from '../routes/route';
import routesRouter from '../routes/routes';
import optimizerRouter from '../routes/optimizer';
import authUserRouter from '../routes/authUser';
import usersRouter from '../routes/users';
import rolesRouter from '../routes/roles';
import logsRouter from '../routes/logs';
import taskTemplatesRouter from '../routes/taskTemplates';
import storageRouter from '../routes/storage';
import filesRouter from '../routes/files';
import fleetsRouter from '../routes/fleets';
import departmentsRouter from '../routes/departments';
import employeesRouter from '../routes/employees';
import trackingRouter from '../routes/tracking';
import type { RequestWithUser } from '../types/request';
import collectionsRouter from '../routes/collections';
import archivesRouter from '../routes/archives';
import systemRouter from '../routes/system';
import routePlansRouter from '../routes/routePlans';
import logisticsRouter from '../routes/logistics';
import analyticsRouter from '../routes/analytics';
import checkTaskAccess from '../middleware/taskAccess';
import { sendProblem } from '../utils/problem';
import { uploadsDir } from '../config/storage';
import {
  updateTaskStatus,
  writeLog,
  listMentionedTasks,
  getTask,
} from '../services/service';
import container from '../di';
import { TOKENS } from '../di/tokens';
import authService from '../auth/auth.service';
import {
  getShortLinkPathPrefix,
  resolveShortLinkBySlug,
} from '../services/shortLinks';

const validate = (validations: ValidationChain[]): RequestHandler[] => [
  ...validations,
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    const errorList = errors.array();
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Ошибка валидации',
      status: 400,
      detail: 'Ошибка валидации',
      errors: errorList,
    });
  },
];

const INDEX_NONCE_PLACEHOLDER = '__CSP_NONCE__';
type IndexCacheEntry = { mtimeMs: number; html: string };
const indexCache = new Map<string, IndexCacheEntry>();

async function loadIndexTemplate(pub: string): Promise<string> {
  const filePath = path.join(pub, 'index.html');
  const fileStat = await stat(filePath);
  const cached = indexCache.get(filePath);
  if (cached && cached.mtimeMs === fileStat.mtimeMs) {
    return cached.html;
  }
  const html = await readFile(filePath, 'utf8');
  indexCache.set(filePath, { html, mtimeMs: fileStat.mtimeMs });
  return html;
}

function injectNonce(template: string, nonce: string): string {
  if (!template.includes(INDEX_NONCE_PLACEHOLDER)) {
    return template;
  }
  return template.split(INDEX_NONCE_PLACEHOLDER).join(nonce);
}

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
    // Wrap csrf: convert HTML error responses to application/problem+json for tests
    (function () {
      const _origSend: Response['send'] | undefined = res.send;
      const _origEnd: Response['end'] | undefined = res.end;
      let __converted = false;

      function convertIfNeeded(body: unknown) {
        const status = Number(res.statusCode ?? 0);
        const headerValue =
          typeof res.get === 'function'
            ? res.get('Content-Type')
            : typeof res.getHeader === 'function'
              ? res.getHeader('Content-Type')
              : undefined;
        const contentType = headerValue ? String(headerValue) : '';
        const looksHtml =
          (typeof body === 'string' && body.trim().startsWith('<')) ||
          contentType.includes('text/html');
        if (!__converted && status >= 400 && looksHtml) {
          __converted = true;
          const targetContentType = 'application/problem+json';
          if (typeof res.set === 'function') {
            res.set('Content-Type', targetContentType);
          } else if (typeof res.setHeader === 'function') {
            res.setHeader('Content-Type', targetContentType);
          }
          const detail = typeof body === 'string' ? body : '';
          const prob = {
            type: 'about:blank',
            title: status === 403 ? 'Ошибка CSRF' : 'Ошибка сервера',
            status: status,
            detail: detail,
          };
          return JSON.stringify(prob);
        }
        return body;
      }

      if (_origSend) {
        res.send = function (this: Response, body) {
          return _origSend.call(this, convertIfNeeded(body));
        } as typeof res.send;
      }

      if (_origEnd) {
        type EndCallback = (err?: Error) => void;
        const endInvoker = _origEnd as (
          this: Response,
          ...args: unknown[]
        ) => Response;
        const invokeEnd = (context: Response, args: readonly unknown[]) =>
          Reflect.apply(endInvoker, context, args as unknown[]);

        res.end = function (
          this: Response,
          chunk?: string | Buffer,
          encodingOrCallback?: BufferEncoding | EndCallback,
          maybeCallback?: EndCallback,
        ) {
          const encoding: BufferEncoding | undefined =
            typeof encodingOrCallback === 'string'
              ? encodingOrCallback
              : undefined;
          const callback: EndCallback | undefined =
            typeof encodingOrCallback === 'function'
              ? encodingOrCallback
              : typeof maybeCallback === 'function'
                ? maybeCallback
                : undefined;

          if (chunk !== undefined) {
            const chunkStr =
              typeof chunk === 'string'
                ? chunk
                : Buffer.isBuffer(chunk)
                  ? chunk.toString(encoding ?? 'utf8')
                  : undefined;

            if (typeof chunkStr === 'string') {
              const converted = convertIfNeeded(chunkStr);
              if (typeof converted === 'string') {
                const buffer = Buffer.from(converted, encoding ?? 'utf8');

                if (encoding !== undefined && callback !== undefined) {
                  return invokeEnd(this, [buffer, encoding, callback]);
                }

                if (encoding !== undefined) {
                  return invokeEnd(this, [buffer, encoding]);
                }

                if (callback !== undefined) {
                  return invokeEnd(this, [buffer, callback]);
                }

                return invokeEnd(this, [buffer]);
              }
            }
          }

          if (typeof encodingOrCallback === 'function') {
            return invokeEnd(this, [chunk, encodingOrCallback]);
          }

          if (typeof maybeCallback === 'function') {
            if (typeof encodingOrCallback === 'string') {
              return invokeEnd(this, [
                chunk,
                encodingOrCallback,
                maybeCallback,
              ]);
            }
            return invokeEnd(this, [chunk, maybeCallback]);
          }

          if (typeof encodingOrCallback === 'string') {
            return invokeEnd(this, [chunk, encodingOrCallback]);
          }

          if (chunk !== undefined) {
            return invokeEnd(this, [chunk]);
          }

          return invokeEnd(this, []);
        } as typeof res.end;
      }
    })();
    return csrf(req, res, next);
  });

  // --- CORS allowlist (auto-injected) ---
  const __corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const __corsOptions = {
    origin: function (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) {
      // allow tools/curl without Origin header (origin === undefined)
      if (!origin) return cb(null, true); // tighten if needed

      if (__corsOrigins.includes(origin)) {
        return cb(null, true);
      }

      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN'],
    maxAge: 600,
  };

  app.use(cors(__corsOptions));
  // --- end CORS allowlist ---
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

  app.get('/health', asyncHandler(healthcheck));
  app.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
  const shortLinkRoute = `${getShortLinkPathPrefix()}/:slug`;
  app.get(
    shortLinkRoute,
    asyncHandler(async (req: Request, res: Response) => {
      const slug =
        typeof req.params.slug === 'string' ? req.params.slug.trim() : '';
      if (!slug) {
        res.status(404).send('Not found');
        return;
      }
      try {
        const target = await resolveShortLinkBySlug(slug);
        if (!target) {
          res.status(404).send('Not found');
          return;
        }
        res.redirect(target);
      } catch (error) {
        console.error('Не удалось переадресовать короткую ссылку', error);
        res.status(500).send('Internal Server Error');
      }
    }),
  );
  app.get(`${prefix}/csrf`, csrf, (req: Request, res: Response) => {
    res.json({
      csrfToken: (req as unknown as { csrfToken: () => string }).csrfToken(),
    });
  });

  app.use(
    express.static(path.join(__dirname, '../../public'), {
      maxAge: '1y',
      immutable: true,
      index: false,
      // Для HTML отключаем кэш, чтобы браузер получал свежий index.html
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );
  app.use(
    '/uploads',
    express.static(uploadsDir, {
      maxAge: '1y',
      immutable: true,
      index: false,
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
  app.use(`${prefix}/osrm`, routeRouter);
  app.use(`${prefix}/optimizer`, optimizerRouter);
  app.use(`${prefix}/route-plans`, routePlansRouter);
  app.use(`${prefix}/logistics`, logisticsRouter);
  app.use(`${prefix}/analytics`, analyticsRouter);
  app.use(`${prefix}/routes`, routesRouter);
  app.use(`${prefix}/tasks`, tasksRouter);
  app.use(`${prefix}/task-drafts`, taskDraftsRouter);
  app.use(`${prefix}/task-templates`, taskTemplatesRouter);
  app.use(`${prefix}/storage`, storageRouter);
  app.use(`${prefix}/files`, filesRouter);
  app.use(`${prefix}/fleets`, fleetsRouter);
  app.use(`${prefix}/tracking`, trackingRouter);
  app.use(`${prefix}/departments`, departmentsRouter);
  app.use(`${prefix}/employees`, employeesRouter);
  app.use(`${prefix}/collections`, collectionsRouter);
  app.use(`${prefix}/archives`, archivesRouter);
  app.use(`${prefix}/system`, systemRouter);

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
      const assigneeIds = new Set<number>();
      const controllerIds = new Set<number>();
      const mainAssignee = Number(task.assigned_user_id);
      if (Number.isFinite(mainAssignee)) {
        assigneeIds.add(mainAssignee);
      }
      const extraAssignees = Array.isArray(task.assignees)
        ? task.assignees
        : [];
      extraAssignees
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .forEach((value) => assigneeIds.add(value));
      const mainController = Number(task.controller_user_id);
      if (Number.isFinite(mainController)) {
        controllerIds.add(mainController);
      }
      const extraControllers = Array.isArray(task.controllers)
        ? task.controllers
        : [];
      extraControllers
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .forEach((value) => controllerIds.add(value));
      const actorIds = new Set<number>();
      assigneeIds.forEach((value) => actorIds.add(value));
      controllerIds.forEach((value) => actorIds.add(value));
      const creatorId = Number(task.created_by);
      if (Number.isFinite(creatorId)) {
        actorIds.add(creatorId);
      }
      if (!actorIds.has(userId)) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Доступ запрещён',
          status: 403,
          detail: 'Forbidden',
        });
        return;
      }
      try {
        const updated = await updateTaskStatus(
          req.params.id,
          req.body.status,
          userId,
          { source: 'telegram' },
        );
        if (!updated) {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Задача не найдена',
            status: 404,
            detail: 'Not Found',
          });
          return;
        }
        await writeLog(
          `Статус задачи ${req.params.id} -> ${req.body.status} пользователем ${userId}`,
        );
        res.json({ status: 'ok', completed_at: updated.completed_at ?? null });
      } catch (error) {
        const err = error as { message?: string; code?: string };
        if (err.code === 'TASK_STATUS_INVALID') {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Недопустимый статус',
            status: 409,
            detail: err.message || 'Статус задачи изменить нельзя',
          });
          return;
        }
        if (
          err.code === 'TASK_CANCEL_FORBIDDEN' ||
          err.code === 'TASK_CANCEL_SOURCE_FORBIDDEN' ||
          err.code === 'TASK_REQUEST_CANCEL_FORBIDDEN'
        ) {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Доступ запрещён',
            status: 403,
            detail: err.message || 'Нет прав для изменения статуса',
          });
          return;
        }
        throw error;
      }
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
      try {
        const updated = await updateTaskStatus(
          req.params.id,
          req.body.status,
          Number((req as RequestWithUser).user!.id),
        );
        if (!updated) {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Задача не найдена',
            status: 404,
            detail: 'Not Found',
          });
          return;
        }
        await writeLog(`Статус задачи ${req.params.id} -> ${req.body.status}`);
        res.json({ status: 'ok', completed_at: updated.completed_at ?? null });
      } catch (error) {
        const err = error as { message?: string; code?: string };
        if (err.code === 'TASK_STATUS_INVALID') {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Недопустимый статус',
            status: 409,
            detail: err.message || 'Статус задачи изменить нельзя',
          });
          return;
        }
        if (
          err.code === 'TASK_CANCEL_FORBIDDEN' ||
          err.code === 'TASK_CANCEL_SOURCE_FORBIDDEN' ||
          err.code === 'TASK_REQUEST_CANCEL_FORBIDDEN'
        ) {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Доступ запрещён',
            status: 403,
            detail: err.message || 'Нет прав для изменения статуса',
          });
          return;
        }
        throw error;
      }
    }),
  );

  app.get('/', spaRateLimiter, async (_req: Request, res: Response, next) => {
    try {
      const template = await loadIndexTemplate(pub);
      const nonce = String(res.locals.cspNonce ?? '');
      const html = injectNonce(template, nonce);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      next(error);
    }
  });

  app.get('*', spaRateLimiter, async (req: Request, res: Response, next) => {
    // Не отдаём index.html для запросов статических файлов
    if (req.path.includes('.')) {
      res.status(404).end();
      return;
    }
    try {
      const template = await loadIndexTemplate(pub);
      const nonce = String(res.locals.cspNonce ?? '');
      const html = injectNonce(template, nonce);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      next(error);
    }
  });

  app.use(errorMiddleware);
}
