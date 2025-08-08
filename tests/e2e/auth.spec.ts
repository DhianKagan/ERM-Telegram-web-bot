/**
 * Назначение файла: e2e-тесты Playwright для проверки авторизации и CSRF.
 * Основные модули: @playwright/test, express, фикстуры initData и mock OSRM.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import initData from '../fixtures/initData';

let server: Server;
const base = 'http://localhost:3001';

test.beforeAll(() => {
  const app = express();
  app.get('/401', (_req, res) => res.sendStatus(401));
  app.post('/403', (_req, res) => res.sendStatus(403));
  app.get('/200', (_req, res) => res.sendStatus(200));
  server = app.listen(3001);
});

test.afterAll(() => {
  server.close();
});

test.describe('Регрессия авторизации и CSRF', () => {
  test('неавторизованный запрос возвращает 401', async ({ request }) => {
    const response = await request.get(`${base}/401`);
    expect(response.status()).toBe(401);
  });

  test('POST без CSRF возвращает 403', async ({ request }) => {
    const response = await request.post(`${base}/403`);
    expect(response.status()).toBe(403);
  });

  test('успешный запрос проходит', async ({ request }) => {
    const response = await request.get(`${base}/200`);
    expect(response.status()).toBe(200);
    expect(initData.user).toBe('demo');
  });
});
