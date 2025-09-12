/**
 * Назначение файла: сценарий входа с эмуляцией Telegram initData.
 * Основные модули: @playwright/test, express.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const app = express();
app.get('/login', (_req, res) => {
  res.send(`<!DOCTYPE html><html><body>
  <div id="user"></div>
  <script>
    const el = document.getElementById('user');
    el.textContent = window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? 'нет данных';
  </script>
  </body></html>`);
});

let server: Server;
let base = '';

test.beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      base = `http://localhost:${port}`;
      resolve();
    });
  });
});

test.afterAll(() => {
  server.close();
});

test('отображает id пользователя из initData', async ({ page }) => {
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: { initDataUnsafe: { user: { id: 7 } } },
    } as any;
  });
  await page.goto(`${base}/login`);
  await expect(page.locator('#user')).toHaveText('7');
});
