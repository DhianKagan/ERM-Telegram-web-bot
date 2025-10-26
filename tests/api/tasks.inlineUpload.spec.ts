/*
 * Назначение файла: интеграционные тесты загрузки изображений через upload-inline.
 * Основные модули: express, supertest, mongodb-memory-server, mongoose.
 */
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import fs from 'fs';
import os from 'os';
import path from 'path';
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

describe('POST /api/v1/tasks/upload-inline', function () {
  const suite = this as { timeout?: (ms: number) => void };
  suite.timeout?.(60000);

  let app: express.Express;
  let mongod: MongoMemoryServer;
  let token: string;
  let uploadsDir: string;
  let FileModel: typeof import('../../apps/api/src/db/model').File;
  let UserModel: typeof import('../../apps/api/src/db/model').User;

  before(async function () {
    const hook = this as { timeout?: (ms: number) => void };
    hook.timeout?.(60000);
    uploadsDir = path.join(os.tmpdir(), `erm-inline-${Date.now()}`);
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    fs.mkdirSync(uploadsDir, { recursive: true });
    process.env.STORAGE_DIR = uploadsDir;
    process.env.JWT_SECRET = 'test-secret';
    process.env.BOT_TOKEN = 'test-bot-token';
    process.env.CHAT_ID = '0';
    process.env.APP_URL = 'https://localhost';
    mongod = await MongoMemoryServer.create();
    const baseUri = new URL(mongod.getUri());
    baseUri.pathname = '/ermdb';
    const uri = baseUri.toString();
    process.env.MONGO_DATABASE_URL = uri;
    await mongoose.connect(uri);

    const tasksRouter = (await import('../../apps/api/src/routes/tasks')).default;
    const models = await import('../../apps/api/src/db/model');
    FileModel = models.File;
    UserModel = models.User;

    app = express();
    app.use(express.json());
    app.use('/api/v1/tasks', tasksRouter);

    token = jwt.sign(
      {
        id: 500,
        telegram_id: 500,
        username: 'manager',
        role: 'admin',
        access: 4,
      },
      process.env.JWT_SECRET!,
    );
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const connection = mongoose.connection;
    if (connection.readyState === 1 && connection.db) {
      await connection.db.dropDatabase();
    }
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    fs.mkdirSync(uploadsDir, { recursive: true });
  });

  it('принимает изображения AVIF', async () => {
    await UserModel.create({
      telegram_id: 500,
      username: 'manager',
      name: 'Администратор',
      role: 'admin',
      access: 4,
      email: 'admin@example.com',
    });

    const response = await request(app)
      .post('/api/v1/tasks/upload-inline')
      .set('Authorization', `Bearer ${token}`)
      .attach('upload', Buffer.from('fake-image'), 'photo.avif');

    assert.equal(response.status, 200, 'ожидали успешную загрузку');
    assert.ok(response.body?.url, 'ответ должен содержать ссылку');
    assert.ok(
      response.body.url?.includes('?mode=inline'),
      'ссылка должна содержать параметр mode=inline',
    );
    const stored = await FileModel.findOne({ name: 'photo.avif' }).lean();
    assert.ok(stored, 'файл должен быть сохранён в базе');
    assert.equal(
      stored?.type,
      'image/avif',
      'ожидали сохранённый MIME-тип image/avif',
    );
  });
});
