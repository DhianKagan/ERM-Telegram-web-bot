// Назначение: автотесты. Модули: jest, supertest.
// Тест обработчика ошибок API. Проверяем ответ на request.aborted
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 'secret';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const errorMiddleware = require('../src/middleware/errorMiddleware').default;
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

let app;
beforeAll(() => {
  app = express();
  app.get('/aborted', (_req, _res, next) => {
    const err = new Error('aborted');
    err.type = 'request.aborted';
    next(err);
  });
  app.use(errorMiddleware);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});

test('errorMiddleware возвращает проблему для request.aborted', async () => {
  const res = await request(app).get('/aborted');
  expect(res.status).toBe(400);
  expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  expect(res.body.type).toBe('about:blank');
  expect(res.body.title).toBe('Некорректный запрос');
  expect(res.body.instance).toBeDefined();
});

test('errorMiddleware возвращает проблему при ошибке CSRF', async () => {
  const appCsrf = express();
  appCsrf.use(express.json());
  appCsrf.use(cookieParser());
  appCsrf.use(
    session({
      secret: 't',
      resave: false,
      saveUninitialized: true,
      // Для продакшена cookie передаются только по HTTPS
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  const csrf = require('lusca').csrf({ angular: true });
  appCsrf.use(csrf);
  appCsrf.post('/csrf', (_req, res) => res.json({ ok: true }));
  appCsrf.use(errorMiddleware);
  const res = await request(appCsrf).post('/csrf');
  expect(res.status).toBe(403);
  expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  expect(res.body.type).toBe('about:blank');
  expect(res.body.title).toBe('Ошибка CSRF');
  expect(res.body.instance).toBeDefined();
});
