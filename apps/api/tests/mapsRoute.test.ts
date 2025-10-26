// Назначение: автотесты. Модули: jest, supertest, shared.
// Тест маршрута /api/maps/expand
export {};

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

jest.mock('../src/services/maps', () => ({
  expandMapsUrl: jest.fn(async () => 'https://maps.google.com/full'),
}));
jest.mock('shared', () => ({
  ...jest.requireActual('shared'),
  extractCoords: jest.fn(() => ({ lat: 1, lng: 2 })),
}));
jest.mock('../src/services/shortLinks', () => ({
  ensureShortLink: jest.fn(async () => ({
    shortUrl: 'https://localhost/l/demo',
    slug: 'demo',
  })),
  resolveShortLink: jest.fn(async () => null),
  isShortLink: jest.fn(() => false),
}));
jest.mock('../src/services/taskLinks', () => ({
  normalizeManagedShortLink: jest.fn((value: string) => value),
}));

jest.mock('../src/api/middleware', () => ({
  verifyToken: (_req, _res, next) => next(),
  asyncHandler: (fn) => fn,
  errorHandler: (err, _req, res, _next) =>
    res.status(500).json({ error: err.message }),
}));

const router = require('../src/routes/maps').default;
const { expandMapsUrl } = require('../src/services/maps');
const {
  ensureShortLink,
  resolveShortLink,
  isShortLink,
} = require('../src/services/shortLinks');
const { normalizeManagedShortLink } = require('../src/services/taskLinks');

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/v1/maps', router);
});

test('POST /api/v1/maps/expand возвращает url и coords', async () => {
  const res = await request(app).post('/api/v1/maps/expand').send({ url: 'u' });
  expect(res.body.url).toBe('https://maps.google.com/full');
  expect(res.body.coords).toEqual({ lat: 1, lng: 2 });
  expect(expandMapsUrl).toHaveBeenCalledWith('u');
  expect(ensureShortLink).toHaveBeenCalledWith('https://maps.google.com/full');
  expect(res.body.short).toBe('https://localhost/l/demo');
  expect(isShortLink).toHaveBeenCalledWith('u');
  expect(resolveShortLink).not.toHaveBeenCalled();
});

test('POST /api/v1/maps/expand обрабатывает управляемую короткую ссылку', async () => {
  (isShortLink as jest.Mock).mockReturnValueOnce(true);
  (resolveShortLink as jest.Mock).mockResolvedValueOnce(
    'https://maps.google.com/expanded',
  );
  const res = await request(app)
    .post('/api/v1/maps/expand')
    .send({ url: 'https://localhost/l/demo' });
  expect(resolveShortLink).toHaveBeenCalledWith('https://localhost/l/demo');
  expect(expandMapsUrl).toHaveBeenCalledWith('https://maps.google.com/expanded');
  expect(res.body.short).toBe('https://localhost/l/demo');
  expect(normalizeManagedShortLink).toHaveBeenCalledWith('https://localhost/l/demo');
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
