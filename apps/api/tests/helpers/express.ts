// Назначение файла: общие типы и вспомогательные функции для Express в тестах.
// Основные модули: express.
import type { NextFunction, Request, Response } from 'express';

type AnyFn = (...args: unknown[]) => unknown;

export type TestUser = {
  id?: number;
  role?: string;
  access?: number;
  telegram_id?: number;
};

export type RequestWithUser = Request & { user?: TestUser };
export type RequestWithCsrf = Request & { csrfToken(): string };

export const passThrough = <Fn extends AnyFn>(fn: Fn): Fn => fn;

export const callNext: (
  req: Request,
  res: Response,
  next: NextFunction,
) => void = (_req, _res, next) => {
  next();
};

export const respondWithError = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) =>
  res.status(500).json({
    error: err instanceof Error ? err.message : String(err),
  });
