// Назначение: проверка агрегации коллекций с данными Department и Employee.
// Основные модули: jest, supertest, express, mongodb-memory-server.
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

jest.setTimeout(30000);

import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Department } from '../src/db/models/department';
import { Employee } from '../src/db/models/employee';
import { CollectionItem } from '../src/db/models/CollectionItem';
import collectionsRouter from '../src/routes/collections';

jest.mock(
  '../src/utils/rateLimiter',
  () => () => (_req: unknown, _res: unknown, next: () => void) => next(),
);
jest.mock(
  '../src/middleware/auth',
  () => () => (_req: unknown, _res: unknown, next: () => void) => next(),
);
jest.mock(
  '../src/middleware/requireRole',
  () => () => (_req: unknown, _res: unknown, next: () => void) => next(),
);

let app: express.Express;
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app = express();
  app.use(express.json());
  app.use('/api/v1/collections', collectionsRouter);

  const fleetId = new mongoose.Types.ObjectId();
  await Department.create({ name: 'Легаси департамент', fleetId });
  await CollectionItem.create({
    type: 'departments',
    name: 'Каталог департаментов',
    value: 'div-legacy',
  });

  const department = await Department.create({ name: 'Цех', fleetId });
  await Employee.create({
    name: 'Иван Петров',
    departmentId: department._id,
  });
  await CollectionItem.create({
    type: 'employees',
    name: 'Сотрудник каталога',
    value: 'active',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

describe('Агрегация коллекций', () => {
  it('возвращает департаменты из CollectionItem и Department', async () => {
    const res = await request(app)
      .get('/api/v1/collections')
      .query({ type: 'departments' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    const names = res.body.items.map((item: { name: string }) => item.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'Каталог департаментов',
        'Легаси департамент',
        'Цех',
      ]),
    );
    const legacy = res.body.items.find(
      (item: { name: string }) => item.name === 'Легаси департамент',
    );
    expect(legacy.meta.legacy).toBe(true);
    expect(legacy.meta.readonly).toBe(true);
    expect(legacy.meta.source).toBe('departments');
  });

  it('возвращает сотрудников из CollectionItem и Employee', async () => {
    const res = await request(app)
      .get('/api/v1/collections')
      .query({ type: 'employees' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const names = res.body.items.map((item: { name: string }) => item.name);
    expect(names).toEqual(
      expect.arrayContaining(['Сотрудник каталога', 'Иван Петров']),
    );
    const legacy = res.body.items.find(
      (item: { name: string }) => item.name === 'Иван Петров',
    );
    expect(legacy.meta.source).toBe('employees');
    expect(legacy.meta.departmentId).toBeDefined();
  });
});
