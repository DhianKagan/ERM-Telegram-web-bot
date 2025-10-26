// Назначение: тесты маршрутов архива задач
import type { Express, NextFunction, Request, Response } from 'express';

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const request = require('supertest');
const express = require('express');
const { Types } = require('mongoose');
const {
  hasAccess,
  ACCESS_ADMIN,
  ACCESS_MANAGER,
  ACCESS_TASK_DELETE,
} = require('../src/utils/accessMask');

const serviceMock = {
  list: jest.fn(),
  purge: jest.fn(),
};

const requireAccess = (mask: number) => (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers['x-access'];
  const access = Number(Array.isArray(header) ? header[0] : header ?? 0);
  if (!hasAccess(access, mask)) {
    res.sendStatus(403);
    return;
  }
  next();
};

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());

  app.get(
    '/api/v1/archives',
    requireAccess(ACCESS_ADMIN | ACCESS_MANAGER),
    async (req: Request, res: Response) => {
      const data = await serviceMock.list({
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      });
      res.json(data);
    },
  );

  app.post(
    '/api/v1/archives/purge',
    requireAccess(ACCESS_TASK_DELETE),
    async (req: Request, res: Response) => {
      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids
            .map((value: unknown) =>
              (typeof value === 'string' ? value : String(value ?? '')).trim(),
            )
            .filter((value: string) => value.length > 0)
        : [];
      if (!ids.length || !ids.every((id: string) => Types.ObjectId.isValid(id))) {
        res.status(400).json({ error: 'invalid_ids' });
        return;
      }
      const removed = await serviceMock.purge(ids);
      res.json({ removed });
    },
  );
});

beforeEach(() => {
  serviceMock.list.mockReset();
  serviceMock.purge.mockReset();
  serviceMock.list.mockResolvedValue({ items: [], total: 0, page: 1, pages: 1 });
  serviceMock.purge.mockResolvedValue(0);
});

test('архив доступен пользователям с маской 6', async () => {
  serviceMock.list.mockResolvedValueOnce({
      items: [
        {
          _id: '507f1f77bcf86cd799439011',
          task_number: 'ERM_000001-DEL',
          title: 'Архивная задача',
          status: 'Выполнена',
          archived_at: new Date('2024-01-01T00:00:00.000Z'),
        },
      ],
      total: 1,
      page: 1,
      pages: 1,
    });
  const res = await request(app)
    .get('/api/v1/archives')
    .set('x-access', String(ACCESS_ADMIN | ACCESS_MANAGER));
  expect(res.status).toBe(200);
  expect(res.body.total).toBe(1);
  expect(Array.isArray(res.body.items)).toBe(true);
  expect(res.body.items[0].task_number).toBe('ERM_000001-DEL');
});

test('архив недоступен без прав 6', async () => {
  const res = await request(app)
    .get('/api/v1/archives')
    .set('x-access', '4');
  expect(res.status).toBe(403);
});

test('полное удаление требует маску 8', async () => {
  serviceMock.purge.mockResolvedValueOnce(2);
  const res = await request(app)
    .post('/api/v1/archives/purge')
    .set('x-access', String(ACCESS_TASK_DELETE))
    .send({ ids: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'] });
  expect(res.status).toBe(200);
  expect(res.body.removed).toBe(2);
  expect(serviceMock.purge).toHaveBeenCalledWith([
    '507f1f77bcf86cd799439011',
    '507f1f77bcf86cd799439012',
  ]);
});

test('полное удаление запрещено без маски 8', async () => {
  const res = await request(app)
    .post('/api/v1/archives/purge')
    .set('x-access', String(ACCESS_ADMIN))
    .send({ ids: ['507f1f77bcf86cd799439011'] });
  expect(res.status).toBe(403);
});

test('валидация полного удаления проверяет идентификаторы', async () => {
  const res = await request(app)
    .post('/api/v1/archives/purge')
    .set('x-access', '8')
    .send({ ids: ['not-valid'] });
  expect(res.status).toBe(400);
});
