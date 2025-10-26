// Назначение: автотесты. Модули: jest, supertest.
// Тест маршрута /api/auth/tma-login
export {};

process.env.BOT_TOKEN = 'x';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const tmaAuthGuard = require('../src/auth/tmaAuth.guard').default;
const createRateLimiter = require('../src/utils/rateLimiter').default;
const tmaLoginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  name: 'tma-login',
});

function buildInitData(ts) {
  const data = {
    query_id: '1',
    user: JSON.stringify({ id: 1, first_name: 'a' }),
    auth_date: String(ts),
    signature: 'sig',
  };
  const str = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update('x').digest();
  const hash = crypto.createHmac('sha256', secret).update(str).digest('hex');
  return `query_id=1&user=%7B%22id%22%3A1%2C%22first_name%22%3A%22a%22%7D&auth_date=${ts}&hash=${hash}&signature=sig`;
}

test('валидный initData возвращает 200', async () => {
  const app = express();
  app.post(
    '/api/auth/tma-login',
    tmaLoginRateLimiter,
    tmaAuthGuard,
    (_req, res) => res.json({ token: 'ok' }),
  );
  const now = Math.floor(Date.now() / 1000);
  const initData = buildInitData(now);
  await request(app)
    .post('/api/auth/tma-login')
    .set('Authorization', `tma ${initData}`)
    .expect(200);
});

test('неверный hash возвращает 401', async () => {
  const app = express();
  app.post(
    '/api/auth/tma-login',
    tmaLoginRateLimiter,
    tmaAuthGuard,
    (_req, res) => res.json({ token: 'ok' }),
  );
  const now = Math.floor(Date.now() / 1000);
  const bad = `query_id=1&user=%7B%22id%22%3A1%2C%22first_name%22%3A%22a%22%7D&auth_date=${now}&hash=bad&signature=sig`;
  await request(app)
    .post('/api/auth/tma-login')
    .set('Authorization', `tma ${bad}`)
    .expect(401);
});

test('просроченный auth_date возвращает 401', async () => {
  const app = express();
  app.post(
    '/api/auth/tma-login',
    tmaLoginRateLimiter,
    tmaAuthGuard,
    (_req, res) => res.json({ token: 'ok' }),
  );
  const old = Math.floor(Date.now() / 1000) - 600;
  const initData = buildInitData(old);
  await request(app)
    .post('/api/auth/tma-login')
    .set('Authorization', `tma ${initData}`)
    .expect(401);
});
