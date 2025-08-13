// Назначение: интеграционный тест эндпойнта /metrics
// Модули: jest, supertest
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 'secret';
process.env.APP_URL = 'https://localhost';

const request = require('supertest');
const express = require('express');
const { register } = require('../src/metrics');
const trace = require('../src/middleware/trace').default;
const pinoLogger = require('../src/middleware/pinoLogger').default;
const metrics = require('../src/middleware/metrics').default;

let app;
beforeAll(() => {
  app = express();
  app.use(trace);
  app.use(pinoLogger);
  app.use(metrics);
  app.get('/ping', (_req, res) => res.send('pong'));
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
});

test('metrics contain http histogram', async () => {
  await request(app).get('/ping');
  const res = await request(app).get('/metrics');
  expect(res.text).toMatch(/http_request_duration_seconds_bucket/);
});
