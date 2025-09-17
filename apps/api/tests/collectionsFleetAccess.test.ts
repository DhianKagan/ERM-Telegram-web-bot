// Назначение: проверка доступа к чтению автопарка в коллекциях
// Основные модули: jest, supertest, express, router collections
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

import express, { type Request } from 'express';
import request from 'supertest';
import { stopScheduler } from '../src/services/scheduler';
import { stopQueue } from '../src/services/messageQueue';

jest.mock('../src/utils/rateLimiter', () => () => (_req, _res, next) => next());
const roleState: { current: 'user' | 'manager' | 'admin' } = { current: 'user' };
jest.mock('../src/middleware/auth', () => ({
  __esModule: true,
  default: () => (req, _res, next) => {
    (req as Request & { user?: { id: number; role: string } }).user = {
      id: 1,
      role: roleState.current,
    };
    next();
  },
}));
jest.mock('../src/middleware/requireRole', () => () => (_req, _res, next) => next());

jest.mock('../src/db/repos/collectionRepo', () => ({
  __esModule: true,
  list: jest.fn(),
}));

const repo = require('../src/db/repos/collectionRepo') as {
  list: jest.MockedFunction<typeof import('../src/db/repos/collectionRepo')['list']>;
};
const collectionsRouter = require('../src/routes/collections').default;

describe('Доступ к автопарку в коллекциях', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/collections', collectionsRouter);

  afterAll(() => {
    stopScheduler();
    stopQueue();
  });

  beforeEach(() => {
    roleState.current = 'user';
    repo.list.mockReset();
    repo.list.mockResolvedValue({
      items: [
        {
          _id: 'fleet-1',
          type: 'fleets',
          name: 'Автопарк №1',
          value: 'https://hosting.wialon.com/locator?t=dG9rZW4=',
        },
      ],
      total: 1,
    });
  });

  test('пользователь без прав получает 403 для списка автопарка', async () => {
    const res = await request(app).get('/api/v1/collections?type=fleets');
    expect(res.status).toBe(403);
    expect(res.body.detail).toBe('Недостаточно прав для просмотра автопарка');
    expect(repo.list).not.toHaveBeenCalled();
  });

  test('менеджер видит токены автопарка', async () => {
    roleState.current = 'manager';
    const res = await request(app).get('/api/v1/collections?type=fleets');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].value).toBe('https://hosting.wialon.com/locator?t=dG9rZW4=');
    expect(repo.list).toHaveBeenCalledTimes(1);
    expect(repo.list.mock.calls[0][0]).toEqual({
      type: 'fleets',
      name: undefined,
      value: undefined,
      search: undefined,
    });
    expect(repo.list.mock.calls[0][1]).toBe(1);
    expect(repo.list.mock.calls[0][2]).toBe(20);
  });

  test('администратор также получает полный ответ', async () => {
    roleState.current = 'admin';
    const res = await request(app).get('/api/v1/collections?type=fleets');
    expect(res.status).toBe(200);
    expect(res.body.items[0].value).toBe('https://hosting.wialon.com/locator?t=dG9rZW4=');
  });
});
