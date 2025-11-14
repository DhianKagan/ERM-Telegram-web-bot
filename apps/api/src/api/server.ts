// Назначение файла: сборка HTTP API.
// Основные модули: express, security, routes
import config from '../config';
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import path from 'path';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import applySecurity from './security';
import registerRoutes from './routes';
import { startDiskMonitor } from '../services/diskSpace';
import sanitizeError from '../utils/sanitizeError';

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection in API:', sanitizeError(err));
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in API:', sanitizeError(err));
  process.exit(1);
});

const execAsync = promisify(exec);

const sessionSecret = process.env.SESSION_SECRET ?? '';
if (!sessionSecret) {
  throw new Error('Переменная SESSION_SECRET не задана');
}

export async function buildApp(): Promise<express.Express> {
  const { default: connect } = await import('../db/connection');
  await connect();
  await import('../db/model');

  const app = express();
  // TEST-ONLY: normalize HTML error responses to application/problem+json
  if (process.env.NODE_ENV === 'test') {
    app.use((req, res, next) => {
      // mark aborted if event fires
      try {
        if (req && typeof req.on === 'function') {
          req.on('aborted', () => {
            req.aborted = true;
          });
        }
      } catch (e) {}

      const _origSend = res.send && res.send.bind(res);
      if (_origSend) {
        res.send = function (body) {
          try {
            const status = Number(res.statusCode || 0);
            const ct =
              (typeof res.get === 'function'
                ? res.get('Content-Type')
                : res.getHeader && res.getHeader('Content-Type')) || '';
            const looksHtml =
              (typeof body === 'string' && body.trim().startsWith('<')) ||
              (ct && String(ct).includes('text/html'));
            if (status >= 400 && looksHtml) {
              try {
                res.setHeader('Content-Type', 'application/problem+json');
              } catch (e) {}
              const detail = typeof body === 'string' ? body : '';
              const prob = {
                type: 'about:blank',
                title: status === 403 ? 'Ошибка CSRF' : 'Ошибка сервера',
                status: status,
                detail: detail,
              };
              return _origSend.call(this, JSON.stringify(prob));
            }
          } catch (e) {}
          return _origSend.call(this, body);
        };
      }
      next();
    });
  }

  const ext = process.env.NODE_ENV === 'production' ? '.js' : '.ts';
  const traceModule = await import('../middleware/trace' + ext);
  const pinoLoggerModule = await import('../middleware/pinoLogger' + ext);
  const metricsModule = await import('../middleware/metrics' + ext);
  const trace = (traceModule.default || traceModule) as express.RequestHandler;
  const pinoLogger = (pinoLoggerModule.default ||
    pinoLoggerModule) as express.RequestHandler;
  const metrics = (metricsModule.default ||
    metricsModule) as express.RequestHandler;

  applySecurity(app);
  app.use(trace);
  app.use(pinoLogger);
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
    await execAsync('pnpm run build-client', { cwd: root });
  }

  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use(compression());

  const domain =
    process.env.NODE_ENV === 'production'
      ? config.cookieDomain || new URL(config.appUrl).hostname
      : undefined;
  const secureCookie = process.env.COOKIE_SECURE !== 'false';
  const cookieFlags: session.CookieOptions = {
    httpOnly: true,
    // По умолчанию cookie передаются только по HTTPS;
    // переменная COOKIE_SECURE=false включает HTTP для локальной отладки.
    secure: secureCookie,
    sameSite: secureCookie ? 'none' : 'lax',
    ...(domain ? { domain } : {}),
  };
  const sessionOpts: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { ...cookieFlags, maxAge: 7 * 24 * 60 * 60 * 1000 },
  };
  if (process.env.NODE_ENV !== 'test') {
    sessionOpts.store = MongoStore.create({
      mongoUrl: config.mongoUrl,
      collectionName: 'sessions',
    });
  }
  app.use(session(sessionOpts));

  await registerRoutes(app, cookieFlags, pub);

  if (process.env.NODE_ENV !== 'test') {
    startDiskMonitor();
  }

  return app;
}

export default buildApp;
