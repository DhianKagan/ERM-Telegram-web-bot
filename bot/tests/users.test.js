// Тесты маршрута /api/v1/users
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');
const { ACCESS_ADMIN } = require('../src/utils/accessMask');

jest.mock('../src/db/queries', () => ({
  listUsers: jest.fn(async () => [{ telegram_id: 1, username: 'test' }]),
}));

jest.mock('../src/api/middleware', () => ({
  verifyToken: (req, _res, next) => {
    req.user = {
      role: req.headers['x-role'],
      access: Number(req.headers['x-access']) || 1,
    };
    next();
  },
  checkRole: (expected) => (req, res, next) => {
    if (typeof expected === 'number') {
      return req.user.access === expected ? next() : res.sendStatus(403);
    }
    return req.user.role === expected ? next() : res.sendStatus(403);
  },
  asyncHandler: (fn) => fn,
  errorHandler: (err, _req, res, _next) =>
    res.status(500).json({ error: err.message }),
}));

const { listUsers } = require('../src/db/queries');
const {
  verifyToken,
  checkRole,
  asyncHandler,
} = require('../src/api/middleware');

const app = express();
app.use(express.json());
app.get(
  '/api/v1/users',
  verifyToken,
  checkRole(ACCESS_ADMIN),
  asyncHandler(async (_req, res) => {
    res.json(await listUsers());
  }),
);

afterAll(() => {
  stopScheduler();
  stopQueue();
});

test('админ получает список пользователей', async () => {
  const res = await request(app)
    .get('/api/v1/users')
    .set('x-role', 'admin')
    .set('x-access', '2');
  expect(res.status).toBe(200);
  expect(res.body[0].username).toBe('test');
});

test('обычный пользователь получает 403', async () => {
  const res = await request(app)
    .get('/api/v1/users')
    .set('x-role', 'user')
    .set('x-access', '1');
  expect(res.status).toBe(403);
});
