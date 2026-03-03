// Назначение: проверка режима авторизации для админского SPA-роутера.
// Модули: jest, express, middleware/auth
import express from 'express';

const authMiddlewareMock = jest.fn(
  () => (_req: unknown, _res: unknown, next: () => void) => next(),
);

jest.mock('../src/middleware/auth', () => ({
  __esModule: true,
  default: (options?: { bearerOnly?: boolean }) => authMiddlewareMock(options),
}));

import initCustomAdmin from '../src/admin/customAdmin';

test('customAdmin всегда использует cookie-совместимый authMiddleware для /cp и /mg', () => {
  const app = express();

  initCustomAdmin(app);

  expect(authMiddlewareMock).toHaveBeenCalledWith({ bearerOnly: false });
});
