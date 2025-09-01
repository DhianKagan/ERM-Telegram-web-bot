/**
 * Назначение файла: e2e-тест отсутствия ошибок в консоли на главной странице.
 * Основные модули: @playwright/test, express.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const markup = `<!DOCTYPE html><html><body>
<h1>Главная</h1>
<script>console.log('ready');</script>
</body></html>`;

const app = express();
app.get('/', (_req, res) => res.send(markup));
const server: Server = app.listen(0);
const { port } = server.address() as AddressInfo;

test.use({ baseURL: `http://localhost:${port}` });

test.afterAll(() => {
  server.close();
});

test('главная страница не содержит ошибок консоли', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  expect(errors).toEqual([]);
});
