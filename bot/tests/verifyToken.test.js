// Тесты middleware verifyToken: доступ без и с JWT
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
jest.unmock('jsonwebtoken');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../src/api/middleware');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

let app;
beforeAll(() => {
  app = express();
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
  app.use(lusca.csrf());
  app.get('/secure', verifyToken, (_req, res) => res.send('OK'));
});

test('без токена возвращает 403', async () => {
  const res = await request(app).get('/secure');
  expect(res.status).toBe(403);
});

test('с валидным токеном 200', async () => {
  const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
  const res = await request(app).get('/secure').set('Cookie', `token=${token}`);
  expect(res.status).toBe(200);
});

test('токен с другим алгоритмом отклоняется', async () => {
  const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, {
    algorithm: 'HS512',
  });
  const res = await request(app).get('/secure').set('Cookie', `token=${token}`);
  expect(res.status).toBe(401);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
