/**
 * Назначение файла: e2e-тест видимости корневого компонента без TypeError в консоли.
 * Основные модули: @playwright/test, express.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const app = express();
const staticDir = resolve(__dirname, '../../apps/api/public');
app.use(express.static(staticDir));
const indexHtml = readFileSync(
  resolve(staticDir, 'index.html'),
  'utf8',
).replace(/\s+integrity="[^"]+"/g, '');
app.get('*', (_req, res) => res.send(indexHtml));
const server: Server = app.listen(0);
const { port } = server.address() as AddressInfo;

test.use({ baseURL: `http://localhost:${port}` });

test.afterAll(() => {
  server.close();
});

test('корневой компонент отображается без TypeError в консоли', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => {
    if (e.message.includes('TypeError')) errors.push(e.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && msg.text().includes('TypeError')) {
      errors.push(msg.text());
    }
  });
  await page.goto('/');
  const root = page.locator('#root');
  await expect(root).toHaveJSProperty('hidden', false);
  expect(errors).toEqual([]);
});
