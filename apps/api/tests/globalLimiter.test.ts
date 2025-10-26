// Назначение: автотесты. Модули: jest, supertest.
// Тест глобального лимитера запросов
import type { Request, Response } from 'express';

const express = require('express');
const request = require('supertest');
const globalLimiter = require('../src/middleware/globalLimiter').default;

test('первый запрос проходит', async () => {
  const app = express();
  app.use(globalLimiter);
  app.get('/', (_req: Request, res: Response) => res.send('ok'));
  const res = await request(app).get('/');
  expect(res.status).toBe(200);
});

test('превышение лимита возвращает 429', async () => {
  const app = express();
  app.use(globalLimiter);
  app.get('/', (_req: Request, res: Response) => res.send('ok'));
  for (let i = 0; i < 100; i++) {
    // eslint-disable-next-line no-await-in-loop
    await request(app).get('/');
  }
  const res = await request(app).get('/');
  expect(res.status).toBe(429);
});
