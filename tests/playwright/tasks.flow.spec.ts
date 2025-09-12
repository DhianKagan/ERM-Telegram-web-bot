/**
 * Назначение файла: сценарий списка задач с эмуляцией Telegram initData.
 * Основные модули: @playwright/test, express.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const tasks = ['первая', 'вторая'];
const app = express();
app.get('/api/tasks', (_req, res) => {
  res.json(tasks);
});
app.get('/tasks', (_req, res) => {
  res.send(`<!DOCTYPE html><html><body>
  <ul id="list"></ul>
  <script>
    fetch('/api/tasks')
      .then(r => r.json())
      .then(ts => {
        const list = document.getElementById('list');
        ts.forEach(t => {
          const li = document.createElement('li');
          li.textContent = t;
          list.appendChild(li);
        });
      });
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

test('показывает список задач', async ({ page }) => {
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: { initDataUnsafe: { user: { id: 1 } } },
    } as any;
  });
  await page.goto(`${base}/tasks`);
  await expect(page.locator('#list li')).toHaveCount(2);
});
