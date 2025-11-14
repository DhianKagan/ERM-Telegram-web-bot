/**
 * Назначение файла: централизованный обработчик ошибок Express.
 * Основные модули: express, fs, path.
 */
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import sanitizeError from '../utils/sanitizeError';
import { writeLog } from '../services/service';

type KnownError = Error & {
  status?: number;
  statusCode?: number;
  code?: string;
  type?: string;
};

type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  traceId?: string;
};

const LOG_DIR = path.join(process.cwd(), 'logs');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');
const PROBLEM_CONTENT_TYPE = 'application/problem+json';

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function appendErrorLog(entry: string): void {
  try {
    ensureLogDir();
    fs.appendFileSync(ERROR_LOG_FILE, entry + '\n', { encoding: 'utf8' });
  } catch (e) {
    console.error('Не удалось записать в error.log:', e);
  }
}

function isRequestAborted(err: unknown, req: Request): boolean {
  if (req.aborted) {
    return true;
  }
  if (!err || typeof err !== 'object') {
    return false;
  }
  const candidate = err as Partial<KnownError> & { message?: string };
  const type = typeof candidate.type === 'string' ? candidate.type : '';
  if (type === 'request.aborted') {
    return true;
  }
  const name = typeof candidate.name === 'string' ? candidate.name : '';
  if (/AbortError/i.test(name)) {
    return true;
  }
  const message =
    typeof candidate.message === 'string' ? candidate.message : '';
  return /aborted/i.test(message);
}

function isCsrfError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const candidate = err as Partial<KnownError> & { message?: string };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  if (code === 'EBADCSRFTOKEN') {
    return true;
  }
  const type = typeof candidate.type === 'string' ? candidate.type : '';
  if (type === 'EBADCSRFTOKEN') {
    return true;
  }
  const name = typeof candidate.name === 'string' ? candidate.name : '';
  const message =
    typeof candidate.message === 'string' ? candidate.message : '';
  return /csrf/i.test(name) || /csrf/i.test(message);
}

function resolveStatus(
  err: unknown,
  aborted: boolean,
  csrf: boolean,
  currentStatus?: number,
): number {
  if (aborted) {
    return 400;
  }
  if (csrf) {
    return 403;
  }
  if (err && typeof err === 'object') {
    const candidate = err as Partial<KnownError>;
    if (
      typeof candidate.status === 'number' &&
      Number.isFinite(candidate.status)
    ) {
      return candidate.status;
    }
    if (
      typeof candidate.statusCode === 'number' &&
      Number.isFinite(candidate.statusCode)
    ) {
      return candidate.statusCode;
    }
  }
  if (
    typeof currentStatus === 'number' &&
    Number.isFinite(currentStatus) &&
    currentStatus >= 400
  ) {
    return currentStatus;
  }
  return 500;
}

function resolveTitle(status: number, aborted: boolean, csrf: boolean): string {
  if (csrf) {
    return 'Ошибка CSRF';
  }
  if (aborted) {
    return 'Некорректный запрос';
  }
  if (status >= 500) {
    return 'Ошибка сервера';
  }
  return 'Некорректный запрос';
}

function buildProblem(
  status: number,
  title: string,
  detail: string | undefined,
  instance: string,
  traceId?: string,
): ProblemDetails {
  const result: ProblemDetails = {
    type: 'about:blank',
    title,
    status,
    instance,
  };
  if (detail) {
    result.detail = detail;
  }
  if (traceId) {
    result.traceId = traceId;
  }
  return result;
}

function getRequestBody(req: Request): string {
  try {
    return JSON.stringify(req.body);
  } catch {
    return String(req.body);
  }
}

function getStack(err: unknown, fallback: string): string {
  if (err instanceof Error && typeof err.stack === 'string') {
    return err.stack;
  }
  return fallback;
}

export default function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  void _next;
  const aborted = isRequestAborted(err, req);
  const csrfError = isCsrfError(err);
  const status = resolveStatus(err, aborted, csrfError, res.statusCode);
  const clean = sanitizeError(err);
  const traceId =
    (res.locals && (res.locals.traceId || res.locals.trace)) || undefined;
  const userId =
    (res.locals && res.locals.user && res.locals.user.id) || undefined;

  const time = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const ip =
    req.ip ||
    (req.connection && 'remoteAddress' in req.connection
      ? String(
          (req.connection as { remoteAddress?: unknown }).remoteAddress ?? '',
        )
      : undefined);

  const body = getRequestBody(req);
  const stack = getStack(err, clean);

  const logObject = {
    time,
    traceId: traceId ?? null,
    method,
    url,
    ip: ip ?? null,
    userId: userId ?? null,
    clean,
    body,
    headers: {
      origin: req.headers.origin,
      referer: req.headers.referer,
      'user-agent': req.headers['user-agent'],
    },
  };

  appendErrorLog(JSON.stringify(logObject));
  appendErrorLog(
    '--- ' +
      time +
      ' ' +
      method +
      ' ' +
      url +
      ' trace:' +
      (traceId ?? '-') +
      ' user:' +
      (userId ?? '-') +
      ' ip:' +
      (ip ?? '-') +
      ' ---',
  );
  appendErrorLog(stack);
  appendErrorLog('');

  console.error('API error:', clean);
  try {
    writeLog(
      'Ошибка ' +
        clean +
        ' path:' +
        url +
        ' ip:' +
        (ip ?? '-') +
        ' trace:' +
        (traceId ?? '-'),
      'error',
    );
  } catch (writeErr) {
    console.error('writeLog error:', writeErr);
  }

  if (res.headersSent) {
    return;
  }

  const detail = aborted ? 'request aborted' : clean;
  const title = resolveTitle(status, aborted, csrfError);
  const instance = req.originalUrl || req.url || req.path || '/';
  const problem = buildProblem(status, title, detail, instance, traceId);

  try {
    res.type(PROBLEM_CONTENT_TYPE);
  } catch (typeErr) {
    console.error('Не удалось выставить content-type для ошибки:', typeErr);
  }

  res.status(problem.status).json(problem);
}
