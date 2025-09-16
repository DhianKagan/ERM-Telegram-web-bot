// Назначение: автотесты. Модули: jest, supertest.
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const lusca = require('lusca');

jest.mock('../src/auth/auth.controller.ts', () => ({
  sendCode: jest.fn((_req, res) => res.json({ ok: true })),
  verifyCode: jest.fn((_req, res) => res.json({ token: 't' })),
  verifyInitData: jest.fn((_req, res) => res.json({ ok: true })),
  profile: jest.fn((_req, res) => res.json({ ok: true })),
  updateProfile: jest.fn((_req, res) => res.json({ ok: true })),
  logout: jest.fn((_req, res) => res.json({ status: 'ok' })),
  refresh: jest.fn((_req, res) => res.json({ token: 't' })),
}));

jest.mock('../src/api/middleware', () => ({
  verifyToken: (_req, _res, next) => next(),
  asyncHandler: (fn) => fn,
  requestLogger: (_req, _res, next) => next(),
}));

jest.mock('../src/services/route', () => ({
  getRouteDistance: jest.fn(async () => ({ distance: 1 })),
  table: jest.fn(async () => ({ durations: [] })),
  nearest: jest.fn(async () => ({})),
  match: jest.fn(async () => ({})),
  trip: jest.fn(async () => ({})),
}));

const authRouter = require('../src/routes/authUser').default;
const routeRouter = require('../src/routes/route').default;
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    session({
      secret: 'test',
      resave: false,
      saveUninitialized: true,
    }),
  );
  const csrf = lusca.csrf({ angular: true });
  app.use((req, res, next) => {
    const url = req.originalUrl.split('?')[0];
    if (['/api/v1/auth/send_code', '/api/v1/auth/verify_code'].includes(url)) {
      return next();
    }
    return csrf(req, res, next);
  });
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/route', routeRouter);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});

test('лимитер auth возвращает 429 и затем 200', async () => {
  for (let i = 0; i < 2; i++) {
    const r = await request(app)
      .post('/api/v1/auth/send_code')
      .send({ telegramId: 1 });
    expect(r.status).toBe(200);
  }
  let res = await request(app)
    .post('/api/v1/auth/send_code')
    .send({ telegramId: 1 });
  expect(res.status).toBe(429);
  expect(res.body.title).toBe('Превышен лимит запросов');
  await new Promise((r) => setTimeout(r, 250));
  res = await request(app)
    .post('/api/v1/auth/send_code')
    .send({ telegramId: 1 });
  expect(res.status).toBe(200);
});

test('валидная капча пропускает лимитер auth', async () => {
  process.env.CAPTCHA_TOKEN = 'ok';
  for (let i = 0; i < 3; i++) {
    const res = await request(app)
      .post('/api/v1/auth/send_code')
      .set('X-Captcha-Token', 'ok')
      .send({ telegramId: 1 });
    expect(res.status).toBe(200);
  }
});

test('подтверждённый запрос обходит лимитер auth', async () => {
  delete process.env.CAPTCHA_TOKEN;
  for (let i = 0; i < 2; i++) {
    const r = await request(app)
      .post('/api/v1/auth/send_code')
      .send({ telegramId: 2 });
    expect(r.status).toBe(200);
  }
  const limited = await request(app)
    .post('/api/v1/auth/send_code')
    .send({ telegramId: 2 });
  expect(limited.status).toBe(429);
  const confirmed = await request(app)
    .post('/api/v1/auth/send_code')
    .set('X-Confirmed-Action', 'true')
    .send({ telegramId: 2 });
  expect(confirmed.status).toBe(200);
});

test('лимитер table возвращает 429 и затем 200', async () => {
  let res = await request(app).get('/api/v1/route/table?points=1,1;2,2');
  expect(res.status).toBe(200);
  res = await request(app).get('/api/v1/route/table?points=1,1;2,2');
  expect(res.status).toBe(429);
  expect(res.body.title).toBe('Превышен лимит запросов');
  await new Promise((r) => setTimeout(r, 250));
  res = await request(app).get('/api/v1/route/table?points=1,1;2,2');
  expect(res.status).toBe(200);
});
