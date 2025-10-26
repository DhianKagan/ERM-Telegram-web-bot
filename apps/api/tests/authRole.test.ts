// Назначение: автотесты. Модули: jest, supertest.
// Тесты middleware checkRole: проверка доступа по ролям
import type { Express, NextFunction, Request, Response } from 'express';

interface AuthedRequest extends Request {
  user?: {
    role: string;
    access: number;
    telegram_id: number;
  };
}

process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const checkRole = require('../src/middleware/checkRole').default;
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');
const {
  ACCESS_ADMIN,
  ACCESS_MANAGER,
  ACCESS_USER,
} = require('../src/utils/accessMask');

function appWithRole(role: string): Express {
  const app = express();
  app.get(
    '/cp',
    (req: AuthedRequest, _res: Response, next: NextFunction) => {
      req.user = {
        role,
        access:
          role === 'admin'
            ? ACCESS_ADMIN | ACCESS_MANAGER
            : ACCESS_USER,
        telegram_id: 1,
      };
      next();
    },
    checkRole(ACCESS_ADMIN),
    (_req: Request, res: Response) => res.sendStatus(200),
  );
  return app;
}

function appWithMask(mask: number): Express {
  const app = express();
  app.get(
    '/mask',
    (req: AuthedRequest, _res: Response, next: NextFunction) => {
      req.user = { role: 'user', access: mask, telegram_id: 1 };
      next();
    },
    checkRole(ACCESS_MANAGER),
    (_req: Request, res: Response) => res.sendStatus(200),
  );
  return app;
}

test('admin имеет доступ', async () => {
  const res = await request(appWithRole('admin')).get('/cp');
  expect(res.status).toBe(200);
});

test('пользователь получает 403', async () => {
  const res = await request(appWithRole('user')).get('/cp');
  expect(res.status).toBe(403);
});

test('комбинированная маска даёт доступ к /mask', async () => {
  const res = await request(appWithMask(ACCESS_USER | ACCESS_MANAGER)).get(
    '/mask',
  );
  expect(res.status).toBe(200);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
