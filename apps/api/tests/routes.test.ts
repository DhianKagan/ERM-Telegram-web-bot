// Назначение: автотесты. Модули: jest, supertest.
// Тест эндпойнта /api/v1/routes/all
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const request = require('supertest');
const express = require('express');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

jest.mock('../src/db/queries', () => ({
  listRoutes: jest.fn(async () => [{ _id: '1' }]),
  getUser: jest.fn(async () => ({})),
}));

const { listRoutes } = require('../src/db/queries');
jest.mock('../src/api/middleware', () => ({
  verifyToken: (req, _res, next) => {
    req.user = { id: 1, telegram_id: 1 };
    next();
  },
  asyncHandler: (fn) => fn,
  errorHandler: (err, _req, res, _next) =>
    res.status(500).json({ error: err.message }),
}));
const errorMiddleware = require('../src/middleware/errorMiddleware').default;
const routesRouter = require('../src/routes/routes').default;

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/v1/routes', routesRouter);
  app.use(errorMiddleware);
});

afterAll(() => {
  jest.clearAllMocks();
  stopScheduler();
  stopQueue();
});

test('GET /api/v1/routes/all возвращает массив', async () => {
  const res = await request(app).get('/api/v1/routes/all');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(listRoutes).toHaveBeenCalled();
});

test('GET /api/v1/routes/all отклоняет массив в статусе', async () => {
  const res = await request(app).get('/api/v1/routes/all?status=a&status=b');
  expect(res.status).toBe(400);
});

test('GET /api/v1/routes/all передаёт статус строкой', async () => {
  await request(app).get('/api/v1/routes/all?status=Выполнена');
  expect(listRoutes).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: 'Выполнена' }),
  );
});
