// Назначение файла: HTTP API и мини-приложение.
// Основные модули: express, сервисы, middleware
import dotenv from 'dotenv';
import config from '../config';
import express, {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';
import createRateLimiter from '../utils/rateLimiter';
import helmet from 'helmet';
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
import client from 'prom-client';
import { swaggerUi, specs } from './swagger';
import tasksRouter from '../routes/tasks';
import mapsRouter from '../routes/maps';
import routeRouter from '../routes/route';
import routesRouter from '../routes/routes';
import optimizerRouter from '../routes/optimizer';
import authUserRouter from '../routes/authUser';
import { updateTaskStatus, writeLog } from '../services/service';
import {
  verifyToken,
  asyncHandler,
  errorHandler,
  requestLogger,
} from './middleware';
import usersRouter from '../routes/users';
import rolesRouter from '../routes/roles';
import logsRouter from '../routes/logs';
import checkTaskAccess from '../middleware/taskAccess';

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
    res.status(400).json({ errors: errors.array() });
  },
];

(async () => {
  const { default: connect } = await import('../db/connection');
  await connect();
  await import('../db/model');

  const app = express();
  const ext = process.env.NODE_ENV === 'test' ? '.ts' : '.js';
  const loggingModule = await import('../middleware/logging' + ext);
  const metricsModule = await import('../middleware/metrics' + ext);
  const logging = (loggingModule.default || loggingModule) as RequestHandler;
  const metrics = (metricsModule.default || metricsModule) as RequestHandler;
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
  const sessionOpts: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'session_secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      ...(domain ? { domain } : {}),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
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
    cookie: {
      options: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        ...(domain ? { domain } : {}),
      },
    },
  });
  const csrfExclude = [
    '/api/v1/auth/send_code',
    '/api/v1/auth/verify_code',
    '/api/v1/csrf',
    '/api/v1/optimizer',
    '/api/v1/maps/expand',
  ];
  app.use((req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl;
    if (process.env.DISABLE_CSRF === '1') {
      if (!globalThis.csrfWarn) {
        console.warn('CSRF middleware disabled');
        (globalThis as any).csrfWarn = true;
      }
      return next();
    }
    if (csrfExclude.includes(url) || req.headers.authorization) return next();
    return csrf(req, res, next);
  });

  const connectSrc = ["'self'"];
  try {
    connectSrc.push(new URL(config.routingUrl).origin);
  } catch {}
  connectSrc.push('https://router.project-osrm.org');
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'frame-src': ["'self'", 'https://oauth.telegram.org'],
          'script-src': ["'self'", "'unsafe-eval'", 'https://telegram.org'],
          'media-src': ["'self'", 'data:'],
          'img-src': [
            "'self'",
            'data:',
            'https://a.tile.openstreetmap.org',
            'https://b.tile.openstreetmap.org',
            'https://c.tile.openstreetmap.org',
          ],
          'connect-src': connectSrc,
        },
      },
    }),
  );
  app.use(cors());
  const prefix = '/api/v1';
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  app.use(requestLogger);

  app.get('/health', (_req: Request, res: Response) =>
    res.json({ status: 'ok' }),
  );
  client.collectDefaultMetrics();
  app.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });
  app.get(`${prefix}/csrf`, csrf, (req: Request, res: Response) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  const taskStatusRateLimiter = createRateLimiter(15 * 60 * 1000, 50);
  const spaRateLimiter = createRateLimiter(60 * 1000, 50);
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

  app.post(
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

  app.use(errorHandler);

  const port = config.port;
  app.listen(port, '0.0.0.0', () => {
    console.log(`API запущен на порту ${port}`);
    console.log(
      `Окружение: ${process.env.NODE_ENV || 'development'}, Node ${process.version}`,
    );
  });
})();
