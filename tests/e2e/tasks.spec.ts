/**
 * Назначение файла: e2e-тесты CRUD задач через HTTP.
 * Основные модули: @playwright/test, express.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';

let server: Server;
const base = 'http://localhost:3002';

const app = express();
app.use(express.json());
interface Task {
  id: number;
  title: string;
}
const tasks: Task[] = [];
let counter = 1;

app.post('/tasks', (req, res) => {
  const task = { id: counter++, title: req.body.title };
  tasks.push(task);
  res.status(201).json(task);
});
app.get('/tasks/:id', (req, res) => {
  const task = tasks.find((t) => t.id === Number(req.params.id));
  if (!task) return res.sendStatus(404);
  res.json(task);
});
app.patch('/tasks/:id', (req, res) => {
  const task = tasks.find((t) => t.id === Number(req.params.id));
  if (!task) return res.sendStatus(404);
  task.title = req.body.title;
  res.json(task);
});
app.delete('/tasks/:id', (req, res) => {
  const idx = tasks.findIndex((t) => t.id === Number(req.params.id));
  if (idx === -1) return res.sendStatus(404);
  tasks.splice(idx, 1);
  res.sendStatus(204);
});

test.beforeAll(() => {
  server = app.listen(3002);
});

test.afterAll(() => {
  server.close();
});

test.describe('E2E CRUD задач', () => {
  let id: number;

  test('создаёт задачу', async ({ request }) => {
    const res = await request.post(`${base}/tasks`, {
      data: { title: 'demo' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    id = body.id;
    expect(body.title).toBe('demo');
  });

  test('читает задачу', async ({ request }) => {
    const res = await request.get(`${base}/tasks/${id}`);
    expect(res.status()).toBe(200);
  });

  test('обновляет задачу', async ({ request }) => {
    const res = await request.patch(`${base}/tasks/${id}`, {
      data: { title: 'upd' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('upd');
  });

  test('удаляет задачу', async ({ request }) => {
    const res = await request.delete(`${base}/tasks/${id}`);
    expect(res.status()).toBe(204);
    const after = await request.get(`${base}/tasks/${id}`);
    expect(after.status()).toBe(404);
  });
});
