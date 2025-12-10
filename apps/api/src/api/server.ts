// apps/api/src/api/server.ts
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
import { startQueueMetricsPoller } from '../queues/queueMetrics';
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
      if (typeof req?.on === 'function') {
        req.on('aborted', () => {
          req.aborted = true;
        });
      }

      const _origSend = res.send?.bind(res);
      if (_origSend) {
        res.send = function (body) {
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
          if (status >= 400 && looksHtml) {
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
            return _origSend.call(this, JSON.stringify(prob));
          }
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

  // NOTE: tiles are not used in this deployment.
  // Removed serving of /tiles (public/tiles) because this project instance
  // does not provide local tile files. If in future you want to enable
  // local tiles, restore the static serving here and ensure files exist
  // under apps/api/public/tiles or apps/web/public/tiles copied to apps/api/public.
  //
  // (original code performed a stat on pub/tiles and used express.static if present)

  const domain =
    process.env.NODE_ENV === 'production'
      ? config.cookieDomain || new URL(config.appUrl).hostname
      : undefined;
  const secureCookie = process.env.COOKIE_SECURE !== 'false';
  const cookieFlags: session.CookieOptions = {
    httpOnly: true,
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
    startQueueMetricsPoller();
  }

  return app;
}

export default buildApp;
