// Тесты работы CSRF-токена и счётчика ошибок.
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
const { errorHandler } = require('../src/api/middleware');
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
      cookie: { secure: process.env.NODE_ENV === 'production' },
    }),
  );
  const csrf = lusca.csrf({
    angular: true,
    cookie: { options: { sameSite: 'lax', domain: 'localhost' } },
  });
  const csrfExclude = ['/api/v1/csrf'];
  app.use((req, res, next) => {
    const url = req.originalUrl.split('?')[0];
    if (csrfExclude.includes(url)) return next();
    return csrf(req, res, next);
  });
  app.get('/api/v1/csrf', csrf, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });
  app.post('/api/protected', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});

test('GET /api/v1/csrf выдаёт токен и cookie', async () => {
  const res = await request(app).get('/api/v1/csrf');
  expect(res.status).toBe(200);
  expect(res.headers['set-cookie'][0]).toMatch(/XSRF-TOKEN/);
  expect(res.headers['set-cookie'][0]).toMatch(/SameSite=Lax/);
  expect(res.body.csrfToken).toBeDefined();
});

test('запрос без CSRF токена получает 403', async () => {
  const res = await request(app).post('/api/protected');
  expect(res.status).toBe(403);
});
