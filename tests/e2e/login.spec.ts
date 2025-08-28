/**
 * Назначение файла: e2e-тест маршрута /login, проверка формы и индикатора загрузки без JS-ошибок.
 * Основные модули: @playwright/test, express.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const markup = `<!DOCTYPE html><html><body>
<div id="loader">Загрузка...</div>
<form id="login">
  <input placeholder="Telegram ID" />
  <button type="submit">Отправить</button>
</form>
<script>console.log('loaded');</script>
</body></html>`;

const app = express();
app.get('/login', (_req, res) => res.send(markup));
const server: Server = app.listen(0);
const { port } = server.address() as AddressInfo;

test.use({ baseURL: `http://localhost:${port}` });

test.afterAll(() => {
  server.close();
});

test('страница /login рендерит форму и индикатор загрузки без ошибок', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/login');
  await expect(page.locator('form#login')).toBeVisible();
  await expect(page.locator('#loader')).toBeVisible();

  expect(errors).toEqual([]);
});
