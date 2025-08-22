// Назначение: автотесты. Модули: jest, supertest.
// Тесты проверки CSRF-маршрутов аутентификации.
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

jest.mock('../src/auth/auth.controller.ts', () => ({
  sendCode: jest.fn((_req, res) => res.json({ status: 'ok' })),
  verifyCode: jest.fn((_req, res) => res.json({ token: 't' })),
  profile: jest.fn((_req, res) => res.json({ ok: true })),
  updateProfile: jest.fn((_req, res) => res.json({ ok: true })),
}));

const authRouter = require('../src/routes/authUser').default;
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
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
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
});

test('send_code без CSRF возвращает 200', async () => {
  const res = await request(app)
    .post('/api/v1/auth/send_code')
    .send({ telegramId: 1 });
  expect(res.status).toBe(200);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
