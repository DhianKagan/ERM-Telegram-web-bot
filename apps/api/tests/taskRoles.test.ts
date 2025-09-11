// Назначение: проверка прав на создание задач через Roles
// Основные модули: express, supertest, roles.decorator, roles.guard
import express = require('express');
import request = require('supertest');
import { Roles } from '../src/auth/roles.decorator';
import rolesGuard from '../src/auth/roles.guard';
import { ACCESS_MANAGER } from '../src/utils/accessMask';

const app = express();
app.post(
  '/tasks',
  (req, _res, next) => {
    (req as any).user = { access: Number(req.headers['x-access'] || 1) };
    next();
  },
  Roles(ACCESS_MANAGER) as any,
  rolesGuard as any,
  (_req, res) => res.sendStatus(201),
);

describe('Права менеджера', () => {
  test('обычному пользователю запрещено', async () => {
    const res = await request(app).post('/tasks').set('x-access', '1');
    expect(res.status).toBe(403);
  });
  test('менеджеру разрешено', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('x-access', String(ACCESS_MANAGER));
    expect(res.status).toBe(201);
  });
});
