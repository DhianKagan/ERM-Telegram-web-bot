// Назначение: автотесты. Модули: jest, supertest.
// Тесты маршрута /api/v1/users
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const rateLimit = require('express-rate-limit');
const request = require('supertest');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');
const { ACCESS_ADMIN } = require('../src/utils/accessMask');

jest.mock('../src/db/queries', () => ({
  listUsers: jest.fn(async () => [{ telegram_id: 1, username: 'test' }]),
  createUser: jest.fn(async () => ({ telegram_id: 1, username: 'test' })),
  updateUser: jest.fn(async () => ({ telegram_id: 1, username: 'new' })),
}));

jest.mock('../src/api/middleware', () => ({
  verifyToken: (req, _res, next) => {
    req.user = {
      role: req.headers['x-role'],
      access: Number(req.headers['x-access']) || 1,
      telegram_id: 1,
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

const { listUsers, createUser, updateUser } = require('../src/db/queries');
const {
  verifyToken,
  checkRole,
  asyncHandler,
} = require('../src/api/middleware');
const validateDto = require('../src/middleware/validateDto.ts').default;
const { CreateUserDto, UpdateUserDto } = require('../src/dto/users.dto.ts');

const app = express();
app.use(express.json());
const usersRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.get(
  '/api/v1/users',
  usersRateLimiter,
  verifyToken,
  checkRole(ACCESS_ADMIN),
  asyncHandler(async (_req, res) => {
    res.json(await listUsers());
  }),
);
app.post(
  '/api/v1/users',

  usersRateLimiter,

  verifyToken,
  checkRole(ACCESS_ADMIN),
  ...validateDto(CreateUserDto),
  asyncHandler(async (req, res) => {
    res.json(await createUser(req.body.id, req.body.username, req.body.roleId));
  }),
);
app.patch(
  '/api/v1/users/:id',
  usersRateLimiter,
  verifyToken,
  checkRole(ACCESS_ADMIN),
  ...validateDto(UpdateUserDto),
  asyncHandler(async (req, res) => {
    res.json(await updateUser(req.params.id, req.body));
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

test('создание пользователя с ошибкой данных', async () => {
  const res = await request(app)
    .post('/api/v1/users')
    .set('x-role', 'admin')
    .set('x-access', '2')
    .send({ username: 'a' });
  expect(res.status).toBe(400);
});

test('обновление пользователя', async () => {
  const res = await request(app)
    .patch('/api/v1/users/1')
    .set('x-role', 'admin')
    .set('x-access', '2')
    .send({ username: 'new' });
  expect(res.status).toBe(200);
  expect(updateUser).toHaveBeenCalled();
});
