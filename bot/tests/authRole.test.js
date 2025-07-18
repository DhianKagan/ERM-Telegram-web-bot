// Тесты middleware checkRole: проверка доступа по ролям
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const checkRole = require('../src/middleware/checkRole');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

function appWithRole(role) {
  const app = express();
  app.get(
    '/cp',
    (req, res, next) => {
      req.user = { role };
      next();
    },
    checkRole('admin'),
    (_req, res) => res.sendStatus(200),
  );
  return app;
}

test('admin имеет доступ', async () => {
  const res = await request(appWithRole('admin')).get('/cp');
  expect(res.status).toBe(200);
});

test('пользователь получает 403', async () => {
  const res = await request(appWithRole('user')).get('/cp');
  expect(res.status).toBe(403);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
