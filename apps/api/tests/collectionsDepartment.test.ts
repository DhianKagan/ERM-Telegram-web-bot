// Назначение: проверка удаления департамента с проверкой ссылок
// Основные модули: jest, supertest, express, router collections
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

jest.mock('../src/utils/rateLimiter', () => () => (_req, _res, next) => next());
jest.mock('../src/middleware/auth', () => () => (req, _res, next) => {
  req.user = { role: 'admin', access: 2 };
  next();
});
jest.mock(
  '../src/middleware/requireRole',
  () => () => (_req, _res, next) => next(),
);

const item = { _id: 'd1', type: 'departments', deleteOne: jest.fn() };
const { CollectionItem } = require('../src/db/models/CollectionItem');
const { Task } = require('../src/db/model');
const { Employee } = require('../src/db/models/employee');
((CollectionItem.findById = jest.fn()),
  (Task.exists = jest.fn()),
  (Employee.exists = jest.fn()));

const collectionsRouter = require('../src/routes/collections').default;

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/v1/collections', collectionsRouter);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});

test('возвращает 409 при связанных данных', async () => {
  CollectionItem.findById.mockResolvedValue(item);
  Task.exists.mockResolvedValue({ _id: 't1' });
  Employee.exists.mockResolvedValue(null);
  const res = await request(app).delete(
    '/api/v1/collections/507f1f77bcf86cd799439011',
  );
  expect(res.status).toBe(409);
});

test('удаляет департамент без ссылок', async () => {
  CollectionItem.findById.mockResolvedValue(item);
  Task.exists.mockResolvedValue(null);
  Employee.exists.mockResolvedValue(null);
  item.deleteOne.mockResolvedValue({});
  const res = await request(app).delete(
    '/api/v1/collections/507f1f77bcf86cd799439011',
  );
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});
