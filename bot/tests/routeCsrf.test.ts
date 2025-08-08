// Назначение: автотесты. Модули: jest, supertest.
// Тест эндпойнта /api/v1/route с проверкой CSRF
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
  verifyToken: (_req, _res, next) => next(),
  asyncHandler: (fn) => fn,
  errorHandler: (err, _req, res, _next) =>
    res.status(500).json({ error: err.message }),
}));

jest.mock('../src/services/route', () => ({
  getRouteDistance: jest.fn(async () => ({ distance: 100, waypoints: [] })),
}));

const errorMiddleware = require('../src/middleware/errorMiddleware').default;

let app;
let server;
let baseUrl;
beforeAll(
  () =>
    new Promise((res) => {
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
      app.use((req, res, next) => {
        const url = req.originalUrl.split('?')[0];
        if (['/api/v1/csrf'].includes(url)) return next();
        return csrf(req, res, next);
      });
      app.get('/api/v1/csrf', csrf, (req, res) =>
        res.json({ csrfToken: req.csrfToken() }),
      );
      app.use('/api/v1/route', routeRouter);
      app.use(errorMiddleware);
      server = https.createServer({ key, cert }, app);
      server.listen(0, 'localhost', () => {
        baseUrl = `https://localhost:${server.address().port}`;
        res();
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
