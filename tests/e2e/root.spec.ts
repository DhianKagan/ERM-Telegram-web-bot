/**
 * Назначение файла: e2e-тесты корневого URL и защиты статических файлов.
 * Основные модули: @playwright/test, express, path.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import path from 'path';
import type { Server } from 'http';

let server: Server;
const port = 3002;
const base = `http://localhost:${port}`;

const pub = path.join(__dirname, '../../apps/api/public');

test.beforeAll(() => {
  const app = express();
  app.use((req, res, next) => {
    if (req.path.includes('..')) {
      res.status(404).end();
      return;
    }
    next();
  });
  app.use(express.static(pub, { dotfiles: 'deny' }));
  server = app.listen(port);
});

test.afterAll(() => {
  server.close();
});

test.describe('Статическая раздача', () => {
  test('корень отдаёт HTML и не 403', async ({ request }) => {
    const res = await request.get(`${base}/`);
    expect(res.status()).not.toBe(403);
    const body = await res.text();
    expect(body).toContain('<html');
  });

  test('доступ к скрытым файлам запрещён', async ({ request }) => {
    const res = await request.get(`${base}/../../.env`);
    expect(res.status()).toBe(404);
  });
});
