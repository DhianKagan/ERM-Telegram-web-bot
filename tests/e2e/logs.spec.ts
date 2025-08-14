/**
 * Назначение файла: e2e-тесты журнала /logs с проверкой авторизации и фильтров.
 * Основные модули: express, supertest, @playwright/test.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import request from 'supertest';

const app = express();

interface Log {
  id: number;
  level: string;
}

const logs: Log[] = [
  { id: 1, level: 'info' },
  { id: 2, level: 'error' },
];

app.get('/logs', (req, res) => {
  if (!req.headers.authorization) {
    return res.sendStatus(401);
  }
  const { level } = req.query;
  let result = logs;
  if (typeof level === 'string') {
    result = logs.filter((l) => l.level === level);
  }
  res.json(result);
});

test.describe('/logs', () => {
  test('неавторизованный запрос отклоняется', async () => {
    await request(app).get('/logs').expect(401);
  });

  test('применяет фильтр уровня', async () => {
    const res = await request(app)
      .get('/logs?level=error')
      .set('Authorization', 'Bearer demo');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].level).toBe('error');
  });
});
