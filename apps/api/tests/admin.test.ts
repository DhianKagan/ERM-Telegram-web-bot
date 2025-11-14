// Назначение: автотесты. Модули: jest, supertest.
// Интеграционные тесты админских маршрутов
import type { NextFunction, Request, Response } from 'express';
import type { RequestWithUser } from './helpers/express';

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');
const { ACCESS_ADMIN, ACCESS_MANAGER } = require('../src/utils/accessMask');

jest.mock('../src/services/service', () => {
  const { ACCESS_ADMIN, ACCESS_MANAGER } = require('../src/utils/accessMask');
  return {
    listLogs: jest.fn(async () => [{ _id: '1', message: 'log' }]),
    writeLog: jest.fn(async () => ({})),
    listRoles: jest.fn(async () => [
      { _id: 'r1', name: 'admin', access: ACCESS_ADMIN | ACCESS_MANAGER },
    ]),
    updateRole: jest.fn(async (id, p) => ({ _id: id, permissions: p })),
  };
});

jest.mock('../src/api/middleware', () => {
  const asyncHandler = jest.fn(
    (handler: (req: Request, res: Response, next: NextFunction) => unknown) =>
      handler,
  );
  const errorHandler = jest.fn((err: unknown, _req: Request, res: Response) =>
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  return {
    verifyToken: (req: RequestWithUser, _res: Response, next: NextFunction) => {
      const rawRole = req.headers['x-role'];
      const role = Array.isArray(rawRole) ? rawRole[0] : rawRole;
      const rawAccess = req.headers['x-access'];
      const accessValue = Array.isArray(rawAccess) ? rawAccess[0] : rawAccess;
      req.user = {
        role: typeof role === 'string' ? role : undefined,
        access: accessValue !== undefined ? Number(accessValue) : 1,
        telegram_id: 1,
      };
      next();
    },
    checkRole:
      (expected: number | string) =>
      (req: RequestWithUser, res: Response, next: NextFunction) => {
        const user = req.user ?? { access: 0 };
        if (typeof expected === 'number') {
          return user.access !== undefined &&
            (user.access & expected) === expected
            ? next()
            : res.sendStatus(403);
        }
        return user.role === expected ? next() : res.sendStatus(403);
      },
    asyncHandler,
    errorHandler,
  };
});

const {
  listLogs,
  writeLog,
  listRoles,
  updateRole,
} = require('../src/services/service');
const {
  verifyToken,
  checkRole,
  asyncHandler,
} = require('../src/api/middleware');

const app = express();
app.use(express.json());

const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api/v1/', apiLimiter);

app.get(
  '/api/v1/logs',
  verifyToken,
  checkRole(ACCESS_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await listLogs(req.query));
  }),
);
app.post(
  '/api/v1/logs',
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    if (typeof req.body.message === 'string') await writeLog(req.body.message);
    res.json({ status: 'ok' });
  }),
);
app.get(
  '/api/v1/roles',
  verifyToken,
  checkRole(ACCESS_ADMIN),
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await listRoles());
  }),
);
app.patch(
  '/api/v1/roles/:id',
  verifyToken,
  checkRole(ACCESS_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await updateRole(req.params.id, req.body.permissions));
  }),
);

test('получение логов доступно админу', async () => {
  const res = await request(app)
    .get('/api/v1/logs')
    .set('x-role', 'admin')
    .set('x-access', String(ACCESS_ADMIN | ACCESS_MANAGER));
  expect(res.body[0].message).toBe('log');
  expect(listLogs).toHaveBeenCalledWith({});
});

test('фильтры логов передаются в сервис', async () => {
  await request(app)
    .get(
      '/api/v1/logs?level=error&message=t&from=2024-01-01&to=2024-01-02&sort=date_asc',
    )
    .set('x-role', 'admin')
    .set('x-access', String(ACCESS_ADMIN | ACCESS_MANAGER));
  expect(listLogs).toHaveBeenCalledWith(
    expect.objectContaining({
      level: 'error',
      message: 't',
      from: '2024-01-01',
      to: '2024-01-02',
      sort: 'date_asc',
    }),
  );
});

test('некорректный уровень логов игнорируется', async () => {
  await request(app)
    .get('/api/v1/logs?level=bad')
    .set('x-role', 'admin')
    .set('x-access', String(ACCESS_ADMIN | ACCESS_MANAGER));
  expect(listLogs).toHaveBeenCalledWith({ level: undefined });
});

test('обычный пользователь получает 403 при доступе к логам', async () => {
  const res = await request(app)
    .get('/api/v1/logs')
    .set('x-role', 'user')
    .set('x-access', '1');
  expect(res.status).toBe(403);
});

test('запись лога вызывает writeLog', async () => {
  await request(app)
    .post('/api/v1/logs')
    .set('x-role', 'admin')
    .set('x-access', String(ACCESS_ADMIN | ACCESS_MANAGER))
    .send({ message: 'm' });
  expect(writeLog).toHaveBeenCalledWith('m');
});

test('получение ролей', async () => {
  const res = await request(app)
    .get('/api/v1/roles')
    .set('x-role', 'admin')
    .set('x-access', String(ACCESS_ADMIN | ACCESS_MANAGER));
  expect(res.body[0].name).toBe('admin');
});

test('обновление роли', async () => {
  const res = await request(app)
    .patch('/api/v1/roles/1')
    .set('x-role', 'admin')
    .set('x-access', String(ACCESS_ADMIN | ACCESS_MANAGER))
    .send({ permissions: ['tasks'] });
  expect(res.body.permissions).toEqual(['tasks']);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
