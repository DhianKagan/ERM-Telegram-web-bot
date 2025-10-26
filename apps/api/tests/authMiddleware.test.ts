// Тесты middleware authMiddleware
// Модули: jest, express
export {};

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 's';

jest.mock('../src/api/middleware', () => ({
  verifyToken: jest.fn((_req: unknown, _res: unknown, next: () => void) =>
    next(),
  ),
}));

const { default: authMiddleware } = require('../src/middleware/auth');
const { verifyToken } = require('../src/api/middleware');

test('authMiddleware вызывает verifyToken', () => {
  const req = {};
  const res = {};
  const next = jest.fn();
  const mw = authMiddleware();
  mw(req, res, next);
  expect(verifyToken).toHaveBeenCalledWith(req, res, next);
});
