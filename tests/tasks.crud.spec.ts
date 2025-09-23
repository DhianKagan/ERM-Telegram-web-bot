/**
 * Назначение файла: unit-тесты CRUD задач через Express и Supertest.
 * Основные модули: express, supertest.
 */
import express = require('express');
import request = require('supertest');

const app = express();
app.use(express.json());

interface Task {
  id: number;
  title: string;
  custom?: Record<string, unknown>;
  transport_type?: string;
}
const tasks: Task[] = [];
let counter = 1;

app.post('/tasks', (req, res) => {
  const task: Task = {
    id: counter++,
    title: req.body.title,
    custom: req.body.custom,
    transport_type: req.body.transport_type ?? 'Без транспорта',
  };
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
  if (req.body.transport_type) task.transport_type = req.body.transport_type;
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

  test("поддерживает транспорт 'Без транспорта'", async () => {
    const createRes = await request(app)
      .post('/tasks')
      .send({ title: 'logistics', transport_type: 'Без транспорта' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.transport_type).toBe('Без транспорта');

    const updateRes = await request(app)
      .patch(`/tasks/${createRes.body.id}`)
      .send({ transport_type: 'Без транспорта' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.transport_type).toBe('Без транспорта');
  });

  test('удаляет задачу', async () => {
    await request(app).delete(`/tasks/${created.id}`).expect(204);
    await request(app).get(`/tasks/${created.id}`).expect(404);
  });
});
