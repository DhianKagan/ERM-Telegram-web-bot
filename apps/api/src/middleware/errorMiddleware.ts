/**
 * Универсальный error middleware.
 * Записывает детальный JSON + human-readable стек в ./logs/error.log
 */
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
// Путь к sanitizeError и writeLog зависит от структуры репо — эти модули у вас уже есть
import { sanitizeError } from '../utils/sanitizeError';
import { writeLog } from '../services/service';

const LOG_DIR = path.join(process.cwd(), 'logs');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Не удалось создать logs/:', e);
  }
}

function appendErrorLog(entry: string) {
  try {
    ensureLogDir();
    fs.appendFileSync(ERROR_LOG_FILE, entry + '\n', { encoding: 'utf8' });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Не удалось записать в error.log:', e);
  }
}

export default function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const clean = sanitizeError(err as Error);

  const traceId = (res.locals && (res.locals.traceId || res.locals.trace)) || null;
  const userId = (res.locals && res.locals.user && res.locals.user.id) || null;

  const time = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const ip = req.ip || (req.connection && (req.connection as any).remoteAddress) || null;

  const bodyStr = (() => {
    try {
      return JSON.stringify(req.body);
    } catch {
      return String(req.body);
    }
  })();

  const stack = err instanceof Error && ((err as Error).stack || (err as Error).message)
    ? (err as Error).stack
    : String(clean);

  const logObject = {
    time,
    traceId,
    method,
    url,
    ip,
    userId,
    clean,
    body: bodyStr,
    headers: {
      origin: req.headers.origin,
      referer: req.headers.referer,
      'user-agent': req.headers['user-agent'],
    },
  };

  // JSON-представление (машинно-удобно)
  appendErrorLog(JSON.stringify(logObject));
  // Human-readable запись
  appendErrorLog(`--- ${time} ${method} ${url} trace:${traceId || '-'} user:${userId || '-'} ip:${ip || '-'} ---`);
  appendErrorLog(stack || '');
  appendErrorLog(''); // пустая строка для разделения записей

  // Дублируем в console.error + центральный лог
  // eslint-disable-next-line no-console
  console.error('API error:', clean);
  try {
    writeLog(
      `Ошибка ${typeof clean === 'string' ? clean : JSON.stringify(clean)} path:${url} ip:${ip} trace:${traceId}`,
      'error',
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('writeLog error:', e);
  }

  const status =
    (err && typeof err === 'object' && 'status' in (err as any) && (err as any).status) || 500;

  res.status(typeof status === 'number' ? status : 500).json({
    error: (err && (err as any).message) || 'Internal Server Error',
    traceId: traceId || undefined,
  });
}
