// Тесты middleware authMiddleware
// Модули: jest, express
import type { NextFunction, Request, Response } from 'express';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 's';

jest.mock('../src/api/middleware', () => ({
  verifyToken: jest.fn(
    (_req: unknown, _res: unknown, next: NextFunction) => next(),
  ),
}));

const { default: authMiddleware } = require('../src/middleware/auth');
const { verifyToken } = require('../src/api/middleware');

test('authMiddleware вызывает verifyToken', () => {
  const req = {} as Request;
  const res = {} as Response;
  const next: NextFunction = jest.fn();
  const mw = authMiddleware();
  mw(req, res, next);
  expect(verifyToken).toHaveBeenCalledWith(req, res, next);
});
