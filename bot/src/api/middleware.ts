// Middleware проверки JWT и базовая обработка ошибок.
// Модули: jsonwebtoken, config, prom-client
import jwt from 'jsonwebtoken';
import { writeLog } from '../services/service';
import client from 'prom-client';
import {
  Request,
  Response,
  NextFunction,
  RequestHandler,
  CookieOptions,
} from 'express';
import config from '../config';
import type { RequestWithUser } from '../types/request';

const csrfErrors = new client.Counter({
  name: 'csrf_errors_total',
  help: 'Количество ошибок CSRF',
});

const apiErrors = new client.Counter({
  name: 'api_errors_total',
  help: 'Количество ошибок API',
  labelNames: ['method', 'path', 'status'],
});

export const asyncHandler = (
  fn: (req: Request, res: Response, next?: NextFunction) => Promise<void> | void,
): RequestHandler => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      next(e);
    }
  };
};

export function errorHandler(
  err: unknown,
  _req: RequestWithUser,
  res: Response,
  _next: NextFunction, // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  const error = err as { [key: string]: unknown; message: string };
  if (error.type === 'request.aborted') {
    res.status(400).json({ error: 'request aborted' });
    return;
  }
  if (error.code === 'EBADCSRFTOKEN' || /CSRF token/.test(error.message)) {
    if (process.env.NODE_ENV !== 'test') {
      csrfErrors.inc();
      const header = _req.headers['x-xsrf-token']
        ? String(_req.headers['x-xsrf-token']).slice(0, 8)
        : 'none';
      const cookie =
        _req.cookies && _req.cookies['XSRF-TOKEN']
          ? String(_req.cookies['XSRF-TOKEN']).slice(0, 8)
          : 'none';
      const uid = _req.user ? `${_req.user.id}/${_req.user.username}` : 'anon';
      writeLog(
        `Ошибка CSRF-токена header:${header} cookie:${cookie} user:${uid}`,
      ).catch(() => {});
    }
    res.status(403).json({
      error:
        'Ошибка CSRF: токен недействителен или отсутствует. Обновите страницу и попробуйте ещё раз.',
    });
    apiErrors.inc({ method: _req.method, path: _req.originalUrl, status: 403 });
    return;
  }
  console.error(error);
  writeLog(
    `Ошибка ${error.message} path:${_req.originalUrl} ip:${_req.ip}`,
    'error',
  ).catch(() => {});
  const status = res.statusCode >= 400 ? res.statusCode : 500;
  res.status(status).json({ error: error.message });
  apiErrors.inc({ method: _req.method, path: _req.originalUrl, status });
}

const { jwtSecret } = config;
// Строго задаём тип секретного ключа JWT
const secretKey: string = jwtSecret || '';

export function verifyToken(
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
): void {
  const auth = req.headers['authorization'];
  let token: string | undefined;
  if (auth) {
    if (auth.startsWith('Bearer ')) {
      token = auth.slice(7).trim();
      if (!token) {
        writeLog(
          `Неверный формат токена ${req.method} ${req.originalUrl} ip:${req.ip}`,
        ).catch(() => {});
        apiErrors.inc({
          method: req.method,
          path: req.originalUrl,
          status: 403,
        });
        res.status(403).json({ message: 'Неверный формат токена авторизации' });
        return;
      }
    } else if (auth.includes(' ')) {
      const part = auth.slice(0, 8);
      writeLog(`Неверный формат токена ${part} ip:${req.ip}`).catch(() => {});
      apiErrors.inc({ method: req.method, path: req.originalUrl, status: 403 });
      res.status(403).json({ message: 'Неверный формат токена авторизации' });
      return;
    } else {
      token = auth;
    }
  } else if (req.cookies && (req.cookies as Record<string, string>).token) {
    token = (req.cookies as Record<string, string>).token;
  } else {
    writeLog(
      `Отсутствует токен ${req.method} ${req.originalUrl} ip:${req.ip}`,
    ).catch(() => {});
    apiErrors.inc({ method: req.method, path: req.originalUrl, status: 403 });
    res.status(403).json({
      message: 'Токен авторизации отсутствует. Выполните вход заново.',
    });
    return;
  }

  const preview = token ? String(token).slice(0, 8) : 'none';
  jwt.verify(
    token,
    secretKey,
    { algorithms: ['HS256'] },
    (
      err: jwt.VerifyErrors | null,
      decoded: jwt.JwtPayload | string | undefined,
    ) => {
      if (err) {
        writeLog(`Неверный токен ${preview} ip:${req.ip}`).catch(() => {});
        apiErrors.inc({
          method: req.method,
          path: req.originalUrl,
          status: 401,
        });
        res
          .status(401)
          .json({ message: 'Недействительный токен. Выполните вход заново.' });
        return;
      }
      req.user = decoded as RequestWithUser['user'];
      const cookieOpts: CookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      };
      if (cookieOpts.secure) {
        cookieOpts.domain =
          config.cookieDomain || new URL(config.appUrl).hostname;
      }
      res.cookie('token', token, cookieOpts);
      next();
    },
  );
}

export function requestLogger(
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
): void {
  const { method, originalUrl, headers, cookies, ip } = req;
  const tokenVal =
    cookies && (cookies as Record<string, string>).token
      ? (cookies as Record<string, string>).token.slice(0, 8)
      : 'no-token';
  const csrfVal = headers['x-xsrf-token']
    ? String(headers['x-xsrf-token']).slice(0, 8)
    : 'no-csrf';
  const auth = headers.authorization;
  let authVal = 'no-auth';
  if (auth) {
    authVal = auth.startsWith('Bearer ') ? auth.slice(7, 15) : auth.slice(0, 8);
  }
  const ua = headers['user-agent']
    ? String(headers['user-agent']).slice(0, 40)
    : 'unknown';
  writeLog(
    `API запрос ${method} ${originalUrl} token:${tokenVal} auth:${authVal} csrf:${csrfVal} ip:${ip} ua:${ua}`,
  ).catch(() => {});
  res.on('finish', () => {
    writeLog(
      `API ответ ${method} ${originalUrl} ${res.statusCode} ip:${ip}`,
    ).catch(() => {});
  });
  next();
}

export default { verifyToken, asyncHandler, errorHandler, requestLogger };
