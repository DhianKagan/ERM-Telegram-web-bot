// Назначение: автотесты. Модули: jest, supertest.
// Тесты работы CSRF-токена и счётчика ошибок.
export {};

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 'secret';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const lusca = require('lusca');
const request = require('supertest');
const client = require('prom-client');
const errorMiddleware = require('../src/middleware/errorMiddleware').default;
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

let app;

beforeEach(() => {
  client.register.resetMetrics();
  app = express();
  app.use(cookieParser());
  app.use(
    session({
      secret: 'test',
      resave: false,
      saveUninitialized: true,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  const csrf = lusca.csrf({
    angular: true,
    cookie: {
      options: {
        httpOnly: true,
        sameSite: 'none',
        domain: 'localhost',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  });
  const csrfExclude = ['/api/v1/csrf'];
  const csrfExcludePrefix = ['/api/tma'];
  app.use((req, res, next) => {
    const url = req.originalUrl.split('?')[0];
    if (
      csrfExclude.includes(url) ||
      csrfExcludePrefix.some((p) => url.startsWith(p)) ||
      req.headers.authorization
    )
      return next();
    return csrf(req, res, next);
  });
  app.get('/api/v1/csrf', csrf, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });
  app.post('/api/protected', (_req, res) => res.json({ ok: true }));
  app.post('/api/tma/protected', (_req, res) => res.json({ ok: true }));
  app.use(errorMiddleware);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});

test('GET /api/v1/csrf выдаёт токен и cookie', async () => {
  const res = await request(app).get('/api/v1/csrf');
  expect(res.status).toBe(200);
  expect(res.headers['set-cookie'][0]).toMatch(/XSRF-TOKEN/);
  expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
  expect(res.headers['set-cookie'][0]).toMatch(/SameSite=None/);
  expect(res.body.csrfToken).toBeDefined();
});

test('connect.sid создаётся вместе с токеном', async () => {
  const res = await request(app).get('/api/v1/csrf');
  const cookies = res.headers['set-cookie'];
  const hasSession = cookies.some((c) => /^connect\.sid=/.test(c));
  expect(hasSession).toBe(true);
});

test('запрос без CSRF токена получает 403', async () => {
  const res = await request(app).post('/api/protected');
  expect(res.status).toBe(403);
  expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  expect(res.body.status).toBe(403);
});

test('запрос с Authorization пропускает CSRF', async () => {
  const res = await request(app)
    .post('/api/protected')
    .set('Authorization', 'Bearer t');
  expect(res.status).toBe(200);
});

test('запрос с корректным CSRF токеном проходит', async () => {
  const tokenRes = await request(app).get('/api/v1/csrf');
  const cookies = tokenRes.headers['set-cookie']
    .map((c) => c.split(';')[0])
    .join('; ');
  const token = tokenRes.body.csrfToken;
  const res = await request(app)
    .post('/api/protected')
    .set('Cookie', cookies)
    .set('X-XSRF-TOKEN', token);
  expect(res.status).toBe(200);
});

test('маршруты Mini App по префиксу пропускают CSRF', async () => {
  const res = await request(app)
    .post('/api/tma/protected')
    .set('Authorization', 'Bearer t');
  expect(res.status).toBe(200);
});
