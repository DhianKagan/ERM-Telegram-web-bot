// Назначение: автотесты. Модули: jest, supertest.
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 'secret';
process.env.APP_URL = 'https://localhost';

import express from 'express';
import request from 'supertest';

jest.mock('../src/auth/auth.controller.ts', () => ({
  sendCode: jest.fn((_req, res) => res.json({ status: 'ok' })),
  verifyCode: jest.fn((_req, res) => res.json({ token: 't' })),
  passwordLogin: jest.fn((_req, res) => res.json({ token: 't' })),
  login: jest.fn((_req, res) => res.json({ accessToken: 'a' })),
  verifyInitData: jest.fn((_req, res) => res.json({ ok: true })),
  profile: jest.fn((_req, res) => res.json({ ok: true })),
  updateProfile: jest.fn((_req, res) => res.json({ ok: true })),
  logout: jest.fn((_req, res) => res.json({ status: 'ok' })),
  refresh: jest.fn((_req, res) => res.json({ accessToken: 'new-token' })),
}));

jest.mock('../src/api/middleware', () => ({
  verifyToken: jest.fn((_req, res) =>
    res.status(401).json({ detail: 'verifyToken-called' }),
  ),
  asyncHandler: jest.fn((handler) => handler),
  requestLogger: jest.fn((_req, _res, next) => next()),
}));

import authRouter from '../src/routes/authUser';
import { stopScheduler } from '../src/services/scheduler';
import { stopQueue } from '../src/services/messageQueue';

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRouter);

afterAll(() => {
  stopScheduler();
  stopQueue();
});

test('POST /api/v1/auth/refresh доступен без access-токена', async () => {
  const res = await request(app).post('/api/v1/auth/refresh');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ accessToken: 'new-token' });
});
