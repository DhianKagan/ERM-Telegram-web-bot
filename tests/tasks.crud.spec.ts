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

describe('CRUD задач', () => {
  let created: Task;

  test('создаёт задачу', async () => {
    const res = await request(app).post('/tasks').send({ title: 'demo' });
    expect(res.status).toBe(201);
    created = res.body;
    expect(created.title).toBe('demo');
  });

  test('читает задачу', async () => {
    const res = await request(app).get(`/tasks/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('demo');
  });

  test('обновляет задачу', async () => {
    const res = await request(app)
      .patch(`/tasks/${created.id}`)
      .send({ title: 'upd' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('upd');
  });

  test('удаляет задачу', async () => {
    await request(app).delete(`/tasks/${created.id}`).expect(204);
    await request(app).get(`/tasks/${created.id}`).expect(404);
  });
});
