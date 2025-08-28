/**
 * Назначение файла: e2e-тест удаления cookie при выходе.
 * Основные модули: @playwright/test, express.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

process.env.BOT_TOKEN = 'test';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 'secret';
process.env.APP_URL = 'https://example.org';
process.env.MONGO_DATABASE_URL =
  'mongodb://admin:admin@localhost:27017/ermdb?authSource=admin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { logout } =
  require('../../apps/api/src/auth/auth.controller') as typeof import('../../apps/api/src/auth/auth.controller');

test('выход удаляет cookie', async ({ request }) => {
  const app = express();
  app.post('/api/v1/auth/logout', logout);
  const server: Server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const base = `http://localhost:${port}`;
  const res = await request.post(`${base}/api/v1/auth/logout`, {
    headers: { cookie: 'token=abc' },
  });
  const cookieHeader = res.headers()['set-cookie'] || '';
  expect(cookieHeader).toContain('token=');
  server.close();
});
