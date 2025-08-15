/**
 * Назначение файла: unit-тесты CRUD задач через Express и Supertest.
 * Основные модули: express, supertest.
 */
import express from 'express';
import request from 'supertest';

const app = express();
app.use(express.json());

interface Task {
  id: number;
  title: string;
  custom?: Record<string, unknown>;
}
const tasks: Task[] = [];
let counter = 1;

app.post('/tasks', (req, res) => {
  const task: Task = { id: counter++, title: req.body.title, custom: req.body.custom };
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
  if (req.body.title) task.title = req.body.title;
  if (req.body.custom) task.custom = req.body.custom;
  res.json(task);
});

app.delete('/tasks/:id', (req, res) => {
  const idx = tasks.findIndex((t) => t.id === Number(req.params.id));
  if (idx === -1) return res.sendStatus(404);
  tasks.splice(idx, 1);
  res.sendStatus(204);
});

describe('CRUD задач', () => {
  let created: Task;

  test('создаёт задачу', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'demo', custom: { foo: 'bar' } });
    expect(res.status).toBe(201);
    created = res.body;
    expect(created.title).toBe('demo');
    expect(created.custom).toEqual({ foo: 'bar' });
  });

  test('читает задачу', async () => {
    const res = await request(app).get(`/tasks/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('demo');
  });

  test('обновляет задачу', async () => {
    const res = await request(app)
      .patch(`/tasks/${created.id}`)
      .send({ title: 'upd', custom: { foo: 'baz' } });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('upd');
    expect(res.body.custom).toEqual({ foo: 'baz' });
  });

  test('удаляет задачу', async () => {
    await request(app).delete(`/tasks/${created.id}`).expect(204);
    await request(app).get(`/tasks/${created.id}`).expect(404);
  });
});
