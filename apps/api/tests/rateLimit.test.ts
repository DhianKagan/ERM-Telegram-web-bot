// Назначение: автотесты. Модули: jest, supertest.
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const router = require('../src/routes/tasks.ts').default;
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

jest.mock('../src/db/model', () => ({
  Task: {
    find: jest.fn(async () => []),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    aggregate: jest.fn(),
  },
}));

jest.mock('../src/api/middleware', () => ({
  verifyToken: (_req, _res, next) => next(),
  errorHandler: (err, _req, res, _next) =>
    res.status(500).json({ error: err.message }),
  checkRole: () => (_req, _res, next) => next(),
}));

test('лимитер detailLimiter возвращает 429', async () => {
  const app = express();
  app.use('/api/v1/tasks', router);
  for (let i = 0; i < 100; i++) await request(app).get('/api/v1/tasks/1');
  const res = await request(app).get('/api/v1/tasks/1');
  expect(res.status).toBe(429);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
