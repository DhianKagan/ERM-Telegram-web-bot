// Назначение: автотесты. Модули: jest, supertest.
// Тест оптимизации маршрута /api/v1/optimizer
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

jest.mock('../src/api/middleware', () => ({
  verifyToken: (_req, _res, next) => next(),
  asyncHandler: (fn) => fn,
  errorHandler: (err, _req, res, _next) =>
    res.status(500).json({ error: err.message }),
}));

const { optimize } = require('../src/services/optimizer');
jest.mock('../src/services/optimizer', () => ({
  optimize: jest.fn(async () => [['1']]),
}));
const router = require('../src/routes/optimizer').default;

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/v1/optimizer', router);
});

test('POST /api/v1/optimizer возвращает маршрут', async () => {
  const res = await request(app)
    .post('/api/v1/optimizer')
    .send({ tasks: ['1'], count: 1 });
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.routes)).toBe(true);
  expect(optimize).toHaveBeenCalledWith(['1'], 1, undefined);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
