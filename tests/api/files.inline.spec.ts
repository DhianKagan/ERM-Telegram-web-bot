/**
 * Назначение файла: тесты доступа к просмотру файлов в режиме inline.
 * Основные модули: express, supertest, mongodb-memory-server, mongoose, jsonwebtoken.
 */
import path from 'path';
import fs from 'fs/promises';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { strict as assert } from 'assert';
import { MongoMemoryServer } from 'mongodb-memory-server';

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

describe('GET /api/v1/files/:id?mode=inline', function () {
  const suite = this as { timeout?: (ms: number) => void };
  suite.timeout?.(60000);

  let app: express.Express;
  let mongod: MongoMemoryServer;
  let File: typeof import('../../apps/api/src/db/model').File;
  let uploadsDir: string;

  before(async function () {
    const hook = this as { timeout?: (ms: number) => void };
    hook.timeout?.(60000);
    const tempUploads = path.resolve(__dirname, '../tmp/uploads-inline');
    process.env.STORAGE_DIR = tempUploads;
    mongod = await MongoMemoryServer.create();
    const uri = `${mongod.getUri()}ermdb`;
    process.env.MONGO_DATABASE_URL = uri;
    delete process.env.MONGODB_URI;
    delete process.env.DATABASE_URL;
    await mongoose.connect(uri);
    ({ File } = await import('../../apps/api/src/db/model'));
    const storageConfig = await import('../../apps/api/src/config/storage');
    uploadsDir = path.resolve(
      process.env.STORAGE_DIR || storageConfig.uploadsDir,
    );
    const { default: filesRouter } = await import('../../apps/api/src/routes/files');
    app = express();
    app.use('/api/v1/files', filesRouter);
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
    if (uploadsDir) {
      await fs.rm(uploadsDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  beforeEach(async () => {
    await File.deleteMany({});
    await fs.rm(uploadsDir, { recursive: true, force: true }).catch(() => undefined);
    await fs.mkdir(uploadsDir, { recursive: true });
  });

  const createFileWithThumbnail = async (
    userId: number,
  ): Promise<string> => {
    const baseDir = path.join(uploadsDir, String(userId));
    await fs.mkdir(baseDir, { recursive: true });
    const filePath = path.join(baseDir, 'source.txt');
    const thumbPath = path.join(baseDir, 'thumb_source.jpg');
    await fs.writeFile(filePath, 'payload');
    await fs.writeFile(thumbPath, 'thumb');
    const created = await File.create({
      userId,
      name: 'source.txt',
      path: path.relative(uploadsDir, filePath),
      thumbnailPath: path.relative(uploadsDir, thumbPath),
      type: 'text/plain',
      size: 7,
      uploadedAt: new Date(),
    });
    return String(created._id);
  };

  it('отклоняет запрос без авторизации', async () => {
    const userId = 501;
    const fileId = await createFileWithThumbnail(userId);
    await request(app)
      .get(`/api/v1/files/${fileId}?mode=inline&variant=thumbnail`)
      .expect(401);
  });

  it('возвращает миниатюру авторизованному пользователю', async () => {
    const userId = 777;
    const fileId = await createFileWithThumbnail(userId);
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET ?? 'test-secret');
    const response = await request(app)
      .get(`/api/v1/files/${fileId}?mode=inline&variant=thumbnail`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.ok(
      response.headers['content-type']?.includes('image/jpeg'),
      'ожидается ответ image/jpeg',
    );
    assert.ok(
      response.headers['content-disposition']?.includes('inline'),
      'ожидается заголовок inline',
    );
  });
});
