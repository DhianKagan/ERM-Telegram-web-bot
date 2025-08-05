// Назначение: автотесты. Модули: jest, supertest.
// Интеграционные тесты HTTP API: проверяем /health и /api/tasks.
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 'secret';
process.env.APP_URL = 'https://localhost';

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const lusca = require('lusca');
jest.mock('../src/services/tasks', () => ({ get: jest.fn() }));
const tasksService = require('../src/services/tasks');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');
jest.unmock('jsonwebtoken');

let app;
beforeAll(async () => {
  tasksService.get.mockResolvedValue({ tasks: [{ id: 1 }], users: {} });
  const {
    verifyToken,
    asyncHandler,
    errorHandler,
  } = require('../src/api/middleware');
  const { generateToken } = require('../src/auth/auth');
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    session({
      secret: 'test',
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(lusca.csrf());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  const token = generateToken({ id: 1, username: 'test', isAdmin: true });
  app.get(
    '/api/v1/tasks',
    verifyToken,
    asyncHandler(async (_req, res) => {
      res.json(await tasksService.get());
    }),
  );
  app.use(errorHandler);
  app.locals.token = token;
});

afterAll(() => {
  jest.clearAllMocks();
  stopScheduler();
  stopQueue();
});

test('GET /health', async () => {
  const res = await request(app).get('/health');
  expect(res.body.status).toBe('ok');
});

test('GET /api/v1/tasks отдает список задач', async () => {
  const token = app.locals.token;
  const res = await request(app)
    .get('/api/v1/tasks')
    .set('Cookie', `token=${token}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.tasks)).toBe(true);
});
