// Назначение: автотесты. Модули: jest, supertest.
// Тест эндпойнта /api/v1/route с проверкой CSRF
import type { Express, NextFunction, Request, Response } from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'https';
import type { RequestWithCsrf } from './helpers/express';

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const lusca = require('lusca');
const https = require('https');
const fs = require('fs');
const request = require('supertest');

const routeRouter = require('../src/routes/route').default;
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

const key = fs.readFileSync(__dirname + '/test-key.pem');
const cert = fs.readFileSync(__dirname + '/test-cert.pem');

jest.mock('../src/api/middleware', () => ({
  verifyToken: (_req: Request, _res: Response, next: NextFunction) => next(),
  asyncHandler: (fn: (...args: unknown[]) => unknown) => fn,
  errorHandler: (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => res.status(500).json({ error: err.message }),
}));

jest.mock('../src/services/route', () => ({
  clearRouteCache: jest.fn(),
}));

jest.mock('../src/geo/osrm', () => ({
  getOsrmDistance: jest.fn(async () => 0.1),
}));

const errorMiddleware = require('../src/middleware/errorMiddleware').default;

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
          cookie: { secure: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
        }),
      );
      const csrf = lusca.csrf({
        angular: true,
        cookie: { options: { sameSite: 'lax', domain: 'localhost' } },
      });
      app.use((req: Request, res: Response, next: NextFunction) => {
        const url = req.originalUrl.split('?')[0];
        if (['/api/v1/csrf'].includes(url)) return next();
        return csrf(req, res, next);
      });
      app.get('/api/v1/csrf', csrf, (req: RequestWithCsrf, res: Response) =>
        res.json({ csrfToken: req.csrfToken() }),
      );
      app.use('/api/v1/route', routeRouter);
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

test('POST /api/v1/route принимает CSRF-токен', async () => {
  const agent = request.agent(baseUrl, { ca: cert });
  const resCsrf = await agent
    .get('/api/v1/csrf')
    .set('X-Forwarded-Proto', 'https');
  const token = resCsrf.body.csrfToken;
  const res = await agent
    .post('/api/v1/route')
    .set('X-Forwarded-Proto', 'https')
    .set('X-XSRF-TOKEN', token)
    .send({ start: { lat: 1, lng: 2 }, end: { lat: 3, lng: 4 } });
  expect(res.status).toBeLessThan(500);
});
