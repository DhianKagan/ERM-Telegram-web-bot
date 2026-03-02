// Middleware авторизации: обёртка verifyToken
// Модули: express, api/middleware
import type { RequestHandler } from 'express';
import { verifyToken } from '../api/middleware';
import { authBearerEnabled } from '../config';
import type { RequestWithUser } from '../types/request';

interface AuthMiddlewareOptions {
  bearerOnly?: boolean;
}

export default function authMiddleware(
  options: AuthMiddlewareOptions = {},
): RequestHandler {
  return (req, res, next) => {
    const bearerOnly = options.bearerOnly ?? authBearerEnabled;
    if (bearerOnly) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          type: 'about:blank',
          title: 'Ошибка авторизации',
          status: 401,
          detail: 'Требуется Authorization: Bearer <accessToken>.',
        });
        return;
      }
    }
    verifyToken(req as RequestWithUser, res, next);
  };
}
