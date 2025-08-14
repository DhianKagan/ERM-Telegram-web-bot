// Middleware авторизации: обёртка verifyToken
// Модули: express, api/middleware
import type { RequestHandler } from 'express';
import { verifyToken } from '../api/middleware';
import type { RequestWithUser } from '../types/request';

export default function authMiddleware(): RequestHandler {
  return (req, res, next) => verifyToken(req as RequestWithUser, res, next);
}
