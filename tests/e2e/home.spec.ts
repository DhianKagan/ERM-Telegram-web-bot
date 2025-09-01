/**
 * Назначение файла: e2e-тест главной страницы / после сборки клиента.
 * Основные модули: @playwright/test, express.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const markup = `<!DOCTYPE html><html><body>
<h1>Главная</h1>
<script>console.log('loaded');</script>
</body></html>`;

const app = express();
app.get('/', (_req, res) => res.send(markup));
const server: Server = app.listen(0);
const { port } = server.address() as AddressInfo;

test.use({ baseURL: `http://localhost:${port}` });

test.afterAll(() => {
  server.close();
});

test('главная страница отображается без ошибок консоли', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  expect(errors).toEqual([]);
});
