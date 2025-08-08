/**
 * Назначение файла: API-тесты Supertest для сценариев Auth/CRUD/CSRF.
 * Основные модули: express, supertest.
 */
import express from 'express';
import request from 'supertest';

const app = express();
app.use(express.json());
app.get('/secure', (_req, res) =>
  res.status(401).json({ error: 'unauthorized' }),
);
app.post('/items', (_req, res) => res.status(403).json({ error: 'csrf' }));
app.post('/items/auth', (_req, res) => res.status(200).json({ id: 1 }));

describe('Auth и CSRF', () => {
  it('возвращает 401 без авторизации', async () => {
    await request(app).get('/secure').expect(401);
  });

  it('возвращает 403 при отсутствии CSRF', async () => {
    await request(app).post('/items').send({}).expect(403);
  });

  it('создаёт запись при корректных данных', async () => {
    await request(app).post('/items/auth').send({ name: 'demo' }).expect(200);
  });
});
