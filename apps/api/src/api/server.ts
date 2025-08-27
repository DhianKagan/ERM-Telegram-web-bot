// Назначение файла: сборка HTTP API.
// Основные модули: express, security, routes
import dotenv from 'dotenv';
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

dotenv.config();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection in API:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in API:', err);
  process.exit(1);
});

const execAsync = promisify(exec);

export async function buildApp(): Promise<express.Express> {
  const { default: connect } = await import('../db/connection');
  await connect();
  await import('../db/model');

  const app = express();
  const ext = process.env.NODE_ENV === 'test' ? '.ts' : '.js';
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
    sameSite: 'none',
    ...(domain ? { domain } : {}),
  };
  const sessionOpts: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'session_secret',
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

  startDiskMonitor();

  return app;
}

export default buildApp;
