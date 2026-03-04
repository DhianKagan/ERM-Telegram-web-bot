/**
 * Назначение файла: интеграционные тесты POST /api/v1/collections.
 * Основные модули: express, supertest, mongoose.
 */
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { strict as assert } from 'assert';

declare const beforeAll: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const afterAll: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const describe: (name: string, suite: (this: unknown) => void) => void;
declare const it: (
  name: string,
  test: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const beforeEach: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;

describe('POST /api/v1/collections', function () {
  let skipSuite = false;
  jest.setTimeout(60000);
  let app: express.Express;
  let authHeader: string;

  beforeAll(async function () {
    jest.setTimeout(60000);
    const uri = process.env.MONGO_DATABASE_URL;
    if (!uri) {
      throw new Error('MONGO_DATABASE_URL не задан для collections.post.spec');
    }
    process.env.MONGO_DATABASE_URL = uri;
    delete process.env.MONGODB_URI;
    delete process.env.DATABASE_URL;
    process.env.SESSION_SECRET ||= 'test-session-secret';

    try {
      await mongoose.connect(uri);
    } catch (error) {
      skipSuite = true;
      console.warn('MongoDB недоступна, пропускаем collections.post.spec', {
        error,
      });
      return;
    }
    const router = (await import('../../apps/api/src/routes/collections'))
      .default;

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

  afterAll(async () => {
    if (skipSuite) return;
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    if (skipSuite) return;
    const connection = mongoose.connection;
    if (connection.readyState === 1) {
      const db = connection.db;
      if (db) {
        await db.dropDatabase();
      }
    }
  });

  it('создаёт департамент без отделов', async () => {
    if (skipSuite) return;
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
    assert.ok(
      response.body._id,
      'Не получен идентификатор созданного департамента',
    );
  });

  it('возвращает 400 для других типов с пустым value', async () => {
    if (skipSuite) return;
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
