// Middleware проверки JWT и вспомогательные функции.
// Модули: jsonwebtoken, config
import jwt from 'jsonwebtoken';
import { writeLog } from '../services/service';
import {
  Request,
  Response,
  NextFunction,
  RequestHandler,
  CookieOptions,
} from 'express';
import config from '../config';
import type { RequestWithUser } from '../types/request';
import shouldLog from '../utils/shouldLog';

import client from 'prom-client';

export const apiErrors = new client.Counter({
  name: 'api_errors_total',
  help: 'Количество ошибок API',
  labelNames: ['method', 'path', 'status'],
});

export const asyncHandler = (
  fn: (
    req: Request,
    res: Response,
    next?: NextFunction,
  ) => Promise<void> | void,
): RequestHandler => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      next(e);
    }
  };
};

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
  let fromHeader = false;
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
        res.redirect('/login');
        return;
      }
      fromHeader = true;
    } else if (auth.includes(' ')) {
      const part = auth.slice(0, 8);
      writeLog(`Неверный формат токена ${part} ip:${req.ip}`).catch(() => {});
      apiErrors.inc({ method: req.method, path: req.originalUrl, status: 403 });
      res.redirect('/login');
      return;
    } else {
      token = auth;
      fromHeader = true;
    }
  } else if (req.cookies && (req.cookies as Record<string, string>).token) {
    token = (req.cookies as Record<string, string>).token;
  } else {
    writeLog(
      `Отсутствует токен ${req.method} ${req.originalUrl} ip:${req.ip}`,
    ).catch(() => {});
    apiErrors.inc({ method: req.method, path: req.originalUrl, status: 403 });
    res.redirect('/login');
    return;
  }

  const preview = token ? String(token).slice(0, 8) : 'none';
  jwt.verify(
    token as string,
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
        res.redirect('/login');
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
      if (!fromHeader) {
        res.cookie('token', token, cookieOpts);
      }
      next();
    },
  );
}

export function requestLogger(
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
): void {
  if (!shouldLog(req)) {
    return next();
  }
  const traceId = (req as unknown as Record<string, string>).traceId;
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
    `API запрос ${method} ${originalUrl} trace:${traceId} token:${tokenVal} auth:${authVal} csrf:${csrfVal} ip:${ip} ua:${ua}`,
  ).catch(() => {});
  res.on('finish', () => {
    writeLog(
      `API ответ ${method} ${originalUrl} ${res.statusCode} trace:${traceId} ip:${ip}`,
    ).catch(() => {});
  });
  next();
}
export default { verifyToken, asyncHandler, requestLogger, apiErrors };
