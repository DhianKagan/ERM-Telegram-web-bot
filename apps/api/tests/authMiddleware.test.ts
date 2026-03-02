// Тесты middleware authMiddleware
// Модули: jest, express
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 's';

jest.mock('../src/api/middleware', () => ({
  verifyToken: jest.fn((_req: unknown, _res: unknown, next: () => void) =>
    next(),
  ),
}));

jest.mock('../src/config', () => ({
  authBearerEnabled: false,
}));

import authMiddleware from '../src/middleware/auth';
import { verifyToken } from '../src/api/middleware';

beforeEach(() => {
  jest.clearAllMocks();
});

test('authMiddleware вызывает verifyToken', () => {
  const req = {};
  const res = {};
  const next = jest.fn();
  const mw = authMiddleware();
  mw(req, res, next);
  expect(verifyToken).toHaveBeenCalledWith(req, res, next);
});

test('authMiddleware в bearer-only режиме возвращает 401 без Authorization', () => {
  const req = { headers: {} };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();

  const mw = authMiddleware({ bearerOnly: true });
  mw(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json).toHaveBeenCalledWith({
    type: 'about:blank',
    title: 'Ошибка авторизации',
    status: 401,
    detail: 'Требуется Authorization: Bearer <accessToken>.',
  });
  expect(verifyToken).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});

test('authMiddleware в bearer-only режиме пропускает запрос с Bearer токеном', () => {
  const req = { headers: { authorization: 'Bearer token' } };
  const res = {};
  const next = jest.fn();

  const mw = authMiddleware({ bearerOnly: true });
  mw(req, res, next);

  expect(verifyToken).toHaveBeenCalledWith(req, res, next);
});

test('authMiddleware по умолчанию включает bearer-only из config', async () => {
  jest.resetModules();
  jest.doMock('../src/api/middleware', () => ({
    verifyToken: jest.fn((_req: unknown, _res: unknown, next: () => void) =>
      next(),
    ),
  }));
  jest.doMock('../src/config', () => ({ authBearerEnabled: true }));

  const authModule = (await import('../src/middleware/auth')) as {
    default: typeof authMiddleware;
  };
  const middlewareModule = (await import('../src/api/middleware')) as {
    verifyToken: jest.Mock;
  };

  const req = { headers: {} };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();

  authModule.default()(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(middlewareModule.verifyToken).not.toHaveBeenCalled();
});
