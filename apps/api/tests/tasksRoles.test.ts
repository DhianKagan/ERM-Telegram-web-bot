/**
 * Назначение файла: проверка доступа менеджера к созданию задач.
 * Основные модули: express, supertest, Roles, rolesGuard.
 */
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

import express from 'express';
import request from 'supertest';
import { Roles } from '../src/auth/roles.decorator';
import rolesGuard from '../src/auth/roles.guard';
import { ACCESS_MANAGER, ACCESS_USER } from '../src/utils/accessMask';
import { stopScheduler } from '../src/services/scheduler';
import { stopQueue } from '../src/services/messageQueue';

function appWithMask(mask: number) {
  const app = express();
  app.post(
    '/tasks',
    (req, _res, next) => {
      (req as any).user = { access: mask, id: 1, username: 'u' };
      next();
    },
    Roles(ACCESS_MANAGER) as unknown as express.RequestHandler,
    rolesGuard as unknown as express.RequestHandler,
    (_req, res) => res.sendStatus(201),
  );
  return app;
}

describe('Roles(ACCESS_MANAGER) для задач', () => {
  test('менеджер создаёт задачу', async () => {
    const res = await request(appWithMask(ACCESS_MANAGER)).post('/tasks');
    expect(res.status).toBe(201);
  });

  test('обычный пользователь получает 403', async () => {
    const res = await request(appWithMask(ACCESS_USER)).post('/tasks');
    expect(res.status).toBe(403);
  });
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
