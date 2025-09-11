/**
 * Назначение файла: e2e-тесты проверки правил intake.
 * Основные модули: @playwright/test, express, intake/rules.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { applyIntakeRules } from '../../apps/api/src/intake/rules';
import type { TaskDocument } from '../../apps/api/src/db/model';

let server: Server;
let base: string;

const app = express();
app.use(express.json());

let counter = 1;
app.post('/tasks', (req, res) => {
  const data = req.body as Partial<TaskDocument>;
  applyIntakeRules(data);
  const task = { id: counter++, ...data };
  res.status(201).json(task);
});

test.beforeAll(() => {
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  base = `http://localhost:${port}`;
});

test.afterAll(() => {
  server.close();
});

test.describe('Правила intake', () => {
  test('устанавливает приоритет по ключевому слову', async ({ request }) => {
    const res = await request.post(`${base}/tasks`, {
      data: { title: 'Срочно доставить отчёт' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.priority).toBe('Срочно');
  });
});
