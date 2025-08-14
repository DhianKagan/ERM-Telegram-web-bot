/**
 * Назначение файла: e2e-тесты маршрутов /routes с проверкой авторизации и фильтров.
 * Основные модули: express, supertest, @playwright/test.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import request from 'supertest';

const app = express();

interface Route {
  id: number;
  type: string;
}

const routes: Route[] = [
  { id: 1, type: 'bus' },
  { id: 2, type: 'car' },
];

app.get('/routes', (req, res) => {
  if (!req.headers.authorization) {
    return res.sendStatus(401);
  }
  const { type } = req.query;
  let result = routes;
  if (typeof type === 'string') {
    result = routes.filter((r) => r.type === type);
  }
  res.json(result);
});

test.describe('/routes', () => {
  test('отклоняет запрос без авторизации', async () => {
    await request(app).get('/routes').expect(401);
  });

  test('фильтрует маршруты по типу', async () => {
    const res = await request(app)
      .get('/routes?type=bus')
      .set('Authorization', 'Bearer demo');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].type).toBe('bus');
  });
});
