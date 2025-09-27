/**
 * Назначение файла: интеграционные тесты POST /api/v1/collections.
 * Основные модули: express, supertest, mongodb-memory-server, mongoose.
 */
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { strict as assert } from 'assert';

declare const before: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const after: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const describe: (
  name: string,
  suite: (this: unknown) => void,
) => void;
declare const it: (
  name: string,
  test: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const beforeEach: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;

describe('POST /api/v1/collections', function () {
  const suite = this as { timeout?: (ms: number) => void };
  suite.timeout?.(60000);
  let app: express.Express;
  let mongod: MongoMemoryServer;
  let authHeader: string;

  before(async function () {
    const hook = this as { timeout?: (ms: number) => void };
    hook.timeout?.(60000);
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGO_DATABASE_URL = uri;
    delete process.env.MONGODB_URI;
    delete process.env.DATABASE_URL;
    process.env.SESSION_SECRET ||= 'test-session-secret';

    await mongoose.connect(uri);
    const router = (await import('../../apps/api/src/routes/collections')).default;

    app = express();
    app.use(express.json());
    app.use('/api/v1/collections', router);

    const token = jwt.sign(
      {
        id: 501,
        role: 'admin',
        username: 'api-test-admin',
      },
      process.env.JWT_SECRET || 'test-secret',
      { algorithm: 'HS256' },
    );
    authHeader = `Bearer ${token}`;
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  beforeEach(async () => {
    const connection = mongoose.connection;
    if (connection.readyState === 1) {
      const db = connection.db;
      if (db) {
        await db.dropDatabase();
      }
    }
  });

  it('создаёт департамент без отделов', async () => {
    const response = await request(app)
      .post('/api/v1/collections')
      .set('Authorization', authHeader)
      .send({
        type: 'departments',
        name: 'Без отдела',
        value: '',
      });

    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.type, 'departments');
    assert.equal(response.body.name, 'Без отдела');
    assert.equal(response.body.value, '');
    assert.ok(typeof response.body._id === 'string' && response.body._id.length > 0);
  });

  it('возвращает 400 для других типов с пустым value', async () => {
    const response = await request(app)
      .post('/api/v1/collections')
      .set('Authorization', authHeader)
      .send({
        type: 'divisions',
        name: 'Дивизион без кода',
        value: '',
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.status, 400);
    assert.equal(response.body.title, 'Ошибка валидации');
    assert.equal(
      response.body.detail,
      'Поля: value — Значение элемента обязательно',
    );
    if (Array.isArray(response.body.errors) && response.body.errors.length) {
      const messages = response.body.errors
        .map((error: { msg?: string }) => error?.msg)
        .filter((msg: string | undefined): msg is string => Boolean(msg));
      assert.ok(messages.length > 0, 'Нет сообщений об ошибках');
    }
  });
});
