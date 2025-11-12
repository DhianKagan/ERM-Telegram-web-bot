// Назначение: автотесты. Модули: jest, supertest.
// Тест полного цикла логина и создания задачи
// Модули: express, cookie-parser, express-session, lusca, supertest
import type { Express, NextFunction, Request, Response } from 'express';
import type { RequestWithCsrf } from './helpers/express';
import type { Server } from 'https';
import type { AddressInfo } from 'net';

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 'secret';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const { Types } = require('mongoose');
const mockAdminRoleId = new Types.ObjectId('64b000000000000000000001');
const mockManagerRoleId = new Types.ObjectId('64b000000000000000000002');

jest.mock('../src/db/roleCache', () => ({
  resolveRoleId: jest.fn(async (name: string) => {
    if (name === 'admin') return mockAdminRoleId;
    if (name === 'manager') return mockManagerRoleId;
    return new (require('mongoose').Types.ObjectId)('64b000000000000000000003');
  }),
  clearRoleCache: jest.fn(),
}));

const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const lusca = require('lusca');
const https = require('https');
const fs = require('fs');
const request = require('supertest');
jest.unmock('jsonwebtoken');

jest.mock('../src/services/telegramApi', () => ({ call: jest.fn() }));
jest.mock('../src/services/userInfoService', () => ({
  getMemberStatus: jest.fn(async () => 'member'),
}));

jest.mock('../src/services/tasks', () => ({
  create: jest.fn(async (d) => ({ _id: '1', ...d })),
  get: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
  addTime: jest.fn(),
  bulk: jest.fn(),
  remove: jest.fn(),
  summary: jest.fn(),
  mentioned: jest.fn(),
}));

jest.mock(
  '../src/middleware/taskAccess',
  () => (_req: unknown, _res: unknown, next: NextFunction) => next(),
);

jest.mock('../src/db/queries', () => ({
  getUser: jest.fn(async () => ({ roleId: mockManagerRoleId })),
  createUser: jest.fn(async () => ({
    username: 'u',
    role: 'manager',
    roleId: mockManagerRoleId,
  })),
  updateUser: jest.fn(async () => ({})),
  accessByRole: (r: string) => (r === 'admin' ? 6 : r === 'manager' ? 4 : 1),
}));

const authRouter = require('../src/routes/authUser').default;
const tasksRouter = require('../src/routes/tasks').default;
const errorMiddleware = require('../src/middleware/errorMiddleware').default;
const { codes } = require('../src/services/otp');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

const key = fs.readFileSync(__dirname + '/test-key.pem');
const cert = fs.readFileSync(__dirname + '/test-cert.pem');

let app: Express;
let server: Server;
let baseUrl: string;
beforeAll(
  () =>
    new Promise<void>((resolve) => {
      app = express();
      app.use(express.json());
      app.use(cookieParser());
      app.set('trust proxy', 1);
      app.use(
        session({
          secret: 'test',
          resave: false,
          saveUninitialized: true,
          cookie: {
            secure: true,
            sameSite: 'none',
            domain: 'localhost',
            maxAge: 7 * 24 * 60 * 60 * 1000,
          },
        }),
      );
      const csrf = lusca.csrf({
        angular: true,
        cookie: { options: { sameSite: 'none', domain: 'localhost' } },
      });
      app.use((req: Request, res: Response, next: NextFunction) => {
        const url = req.originalUrl.split('?')[0];
        if (
          [
            '/api/v1/auth/send_code',
            '/api/v1/auth/verify_code',
            '/api/v1/csrf',
          ].includes(url)
        ) {
          return next();
        }
        if (req.headers.authorization) return next();
        return csrf(req, res, next);
      });
      app.get('/api/v1/csrf', csrf, (req: RequestWithCsrf, res: Response) => {
        res.json({ csrfToken: req.csrfToken() });
      });
      app.use('/api/v1/auth', authRouter);
      app.use('/api/v1/tasks', tasksRouter);
      app.use(errorMiddleware);
      server = https.createServer({ key, cert }, app);
      server.listen(0, 'localhost', () => {
        const address = server.address() as AddressInfo | string | null;
        if (!address || typeof address === 'string') {
          throw new Error('Не удалось получить порт сервера');
        }
        baseUrl = `https://localhost:${address.port}`;
        resolve();
      });
    }),
);

afterAll(() => {
  server.close();
  stopScheduler();
  stopQueue();
});

test('полный цикл логина и создания задачи', async () => {
  const agent = request.agent(baseUrl, { ca: cert });
  const csrfRes = await agent
    .get('/api/v1/csrf')
    .set('X-Forwarded-Proto', 'https');
  const token = csrfRes.body.csrfToken;
  expect(token).toBeDefined();
  await agent
    .post('/api/v1/auth/send_code')
    .set('X-Forwarded-Proto', 'https')
    .send({ telegramId: 1 });
  const code = codes.get('1').code;
  const verifyRes = await agent
    .post('/api/v1/auth/verify_code')
    .set('X-Forwarded-Proto', 'https')
    .set('X-XSRF-TOKEN', token)
    .send({ telegramId: 1, code, username: 'u' });
  const res = await agent
    .post('/api/v1/tasks')
    .set('X-Forwarded-Proto', 'https')
    .set('Authorization', `Bearer ${verifyRes.body.token}`)
    .send({ formVersion: 1, title: 'T' });
  expect(res.status).toBe(201);
});
