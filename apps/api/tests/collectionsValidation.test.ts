// Назначение: проверка валидации создания элементов коллекции.
// Основные модули: jest, supertest, express, router collections.
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
jest.mock('../src/middleware/auth', () => () => (_req, _res, next) => next());
jest.mock(
  '../src/middleware/requireRole',
  () => () => (_req, _res, next) => next(),
);

jest.mock('../src/db/repos/collectionRepo', () => ({
  create: jest.fn(),
  update: jest.fn(),
}));

const repo = require('../src/db/repos/collectionRepo');
const collectionsRouter = require('../src/routes/collections').default;

let app;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/v1/collections', collectionsRouter);
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});

test('создаёт департамент без привязанных отделов', async () => {
  repo.create.mockResolvedValue({
    _id: '507f1f77bcf86cd799439011',
    type: 'departments',
    name: 'Финансы',
    value: '',
  });
  const response = await request(app)
    .post('/api/v1/collections')
    .send({ type: 'departments', name: 'Финансы', value: '' });
  expect(response.status).toBe(201);
  expect(repo.create).toHaveBeenCalledWith({
    type: 'departments',
    name: 'Финансы',
    value: '',
  });
});

test('возвращает 400 при пустом value для других коллекций', async () => {
  const response = await request(app)
    .post('/api/v1/collections')
    .send({ type: 'divisions', name: 'Продажи', value: '' });
  expect(response.status).toBe(400);
  expect(repo.create).not.toHaveBeenCalled();
  expect(String(response.body.detail)).toContain('value');
});
