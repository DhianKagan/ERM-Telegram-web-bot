// Интеграционные тесты админских маршрутов
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

jest.mock('../src/services/service', () => ({
  listLogs: jest.fn(async () => [{ _id: '1', message: 'log' }]),
  writeLog: jest.fn(async () => ({})),
  listRoles: jest.fn(async () => [{ _id: 'r1', name: 'admin' }]),
  updateRole: jest.fn(async (id, p) => ({ _id: id, permissions: p })),
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

const {
  listLogs,
  writeLog,
  listRoles,
  updateRole,
} = require('../src/services/service');
const {
  verifyToken,
  checkRole,
  asyncHandler,
} = require('../src/api/middleware');

const app = express();
app.use(express.json());

const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api/v1/', apiLimiter);

app.get(
  '/api/v1/logs',
  verifyToken,
  checkRole(ACCESS_ADMIN),
  asyncHandler(async (_req, res) => {
    res.json(await listLogs());
  }),
);
app.post(
  '/api/v1/logs',
  verifyToken,
  asyncHandler(async (req, res) => {
    if (typeof req.body.message === 'string') await writeLog(req.body.message);
    res.json({ status: 'ok' });
  }),
);
app.get(
  '/api/v1/roles',
  verifyToken,
  checkRole(ACCESS_ADMIN),
  asyncHandler(async (_req, res) => {
    res.json(await listRoles());
  }),
);
app.patch(
  '/api/v1/roles/:id',
  verifyToken,
  checkRole(ACCESS_ADMIN),
  asyncHandler(async (req, res) => {
    res.json(await updateRole(req.params.id, req.body.permissions));
  }),
);

test('получение логов доступно админу', async () => {
  const res = await request(app)
    .get('/api/v1/logs')
    .set('x-role', 'admin')
    .set('x-access', '2');
  expect(res.body[0].message).toBe('log');
});

test('обычный пользователь получает 403 при доступе к логам', async () => {
  const res = await request(app)
    .get('/api/v1/logs')
    .set('x-role', 'user')
    .set('x-access', '1');
  expect(res.status).toBe(403);
});

test('запись лога вызывает writeLog', async () => {
  await request(app)
    .post('/api/v1/logs')
    .set('x-role', 'admin')
    .set('x-access', '2')
    .send({ message: 'm' });
  expect(writeLog).toHaveBeenCalledWith('m');
});

test('получение ролей', async () => {
  const res = await request(app)
    .get('/api/v1/roles')
    .set('x-role', 'admin')
    .set('x-access', '2');
  expect(res.body[0].name).toBe('admin');
});

test('обновление роли', async () => {
  const res = await request(app)
    .patch('/api/v1/roles/1')
    .set('x-role', 'admin')
    .set('x-access', '2')
    .send({ permissions: ['tasks'] });
  expect(res.body.permissions).toEqual(['tasks']);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
