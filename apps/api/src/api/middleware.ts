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
import { buildTokenCookieOptions } from '../utils/setTokenCookie';
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

function sendAuthProblem(res: Response, status: number, detail: string): void {
  const payload = {
    type: 'about:blank',
    title: 'Ошибка авторизации',
    status,
    detail,
  };
  res
    .status(status)
    .type('application/problem+json')
    .send(JSON.stringify(payload));
}

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
        sendAuthProblem(
          res,
          403,
          'Заголовок авторизации не содержит токен после Bearer.',
        );
        return;
      }
      fromHeader = true;
    } else if (auth.includes(' ')) {
      const part = auth.slice(0, 8);
      writeLog(`Неверный формат токена ${part} ip:${req.ip}`).catch(() => {});
      apiErrors.inc({ method: req.method, path: req.originalUrl, status: 403 });
      sendAuthProblem(
        res,
        403,
        'Заголовок авторизации содержит недопустимые пробелы.',
      );
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
    apiErrors.inc({ method: req.method, path: req.originalUrl, status: 401 });
    sendAuthProblem(res, 401, 'Токен авторизации отсутствует.');
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
        sendAuthProblem(
          res,
          401,
          'Токен авторизации недействителен или использует неподдерживаемый алгоритм.',
        );
        return;
      }
      req.user = decoded as RequestWithUser['user'];
      const cookieOpts: CookieOptions = buildTokenCookieOptions(config);
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
  const { method, originalUrl, ip } = req;
  const actorId = req.user?.telegram_id ?? req.user?.id ?? 'anonymous';
  const role = req.user?.role ?? 'unknown';
  const baseMetadata = {
    source: 'user_action',
    actorId,
    role,
    method,
    endpoint: originalUrl,
    ip,
  };
  writeLog(
    `Действие пользователя: ${method} ${originalUrl} trace:${traceId}`,
    'info',
    baseMetadata,
  ).catch(() => {});
  res.on('finish', () => {
    writeLog(
      `Результат действия: ${method} ${originalUrl} ${res.statusCode} trace:${traceId}`,
      res.statusCode >= 400 ? 'warn' : 'info',
      {
        ...baseMetadata,
        statusCode: res.statusCode,
      },
    ).catch(() => {});
  });
  next();
}
export default { verifyToken, asyncHandler, requestLogger, apiErrors };
