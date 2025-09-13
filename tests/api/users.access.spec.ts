/**
 * Назначение файла: проверка доступа менеджера и администратора к маршрутам пользователей.
 * Основные модули: express, supertest, middleware Roles и rolesGuard.
 */
import express = require('express');
import request = require('supertest');
import { Roles } from '../../apps/api/src/auth/roles.decorator';
import rolesGuard from '../../apps/api/src/auth/roles.guard';
import {
  ACCESS_ADMIN,
  ACCESS_MANAGER,
} from '../../apps/api/src/utils/accessMask';

const app = express();
const auth = (req: any, _res: any, next: any) => {
  const role = req.headers['x-role'];
  const access = role === 'admin' ? 6 : role === 'manager' ? 4 : 1;
  req.user = { access };
  next();
};

app.get('/users', auth, Roles(ACCESS_MANAGER), rolesGuard, (_req, res) =>
  res.sendStatus(200),
);
app.post('/users', auth, Roles(ACCESS_ADMIN), rolesGuard, (_req, res) =>
  res.sendStatus(200),
);
app.patch('/users/:id', auth, Roles(ACCESS_ADMIN), rolesGuard, (_req, res) =>
  res.sendStatus(200),
);

describe('доступ к роутам пользователей', () => {
  it('менеджер может получать список', async () => {
    await request(app).get('/users').set('x-role', 'manager').expect(200);
  });
  it('админ может получать список', async () => {
    await request(app).get('/users').set('x-role', 'admin').expect(200);
  });
  it('менеджер не может создавать', async () => {
    await request(app).post('/users').set('x-role', 'manager').expect(403);
  });
  it('админ может создавать', async () => {
    await request(app).post('/users').set('x-role', 'admin').expect(200);
  });
  it('менеджер не может обновлять', async () => {
    await request(app).patch('/users/1').set('x-role', 'manager').expect(403);
  });
  it('админ может обновлять', async () => {
    await request(app).patch('/users/1').set('x-role', 'admin').expect(200);
  });
});
