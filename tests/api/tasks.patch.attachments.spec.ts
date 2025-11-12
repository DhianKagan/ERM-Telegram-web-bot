/**
 * Назначение файла: интеграционный тест обновления задачи с вложениями.
 * Основные модули: express, supertest, mongodb-memory-server, mongoose.
 */
import express from 'express';
import request from 'supertest';
declare const before: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const after: (
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

import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { strict as assert } from 'assert';
import {
  ACCESS_ADMIN,
  ACCESS_MANAGER,
  ACCESS_USER,
} from '../../apps/api/src/utils/accessMask';

describe('PATCH /api/v1/tasks/:id с вложениями', function () {
  const suite = this as { timeout?: (ms: number) => void };
  suite.timeout?.(60000);
  let app: express.Express;
  let mongod: MongoMemoryServer;
  let Task: typeof import('../../apps/api/src/db/model').Task;
  let File: typeof import('../../apps/api/src/db/model').File;
  let User: typeof import('../../apps/api/src/db/model').User;
  let updateTask: typeof import('../../apps/api/src/db/queries').updateTask;

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
    const models = await import('../../apps/api/src/db/model');
    Task = models.Task;
    File = models.File;
    User = models.User;
    ({ updateTask } = await import('../../apps/api/src/db/queries'));

    app = express();
    app.use(express.json());
    app.patch('/api/v1/tasks/:id', async (req, res) => {
      try {
        const task = await updateTask(req.params.id, req.body, 111);
        if (!task) {
          res.status(404).json({ error: 'not found' });
          return;
        }
        res.json(task);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });
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

  it('привязывает файлы к задаче через File.updateMany', async () => {
    await User.create({
      telegram_id: 111,
      username: 'admin-user',
      name: 'Администратор',
      email: 'admin@example.com',
      role: 'admin',
      access: ACCESS_ADMIN | ACCESS_MANAGER | ACCESS_USER,
    });

    const task = await Task.create({
      title: 'Тестовая задача',
      created_by: 111,
      request_id: 'ERM_TEST',
      task_number: 'ERM_TEST',
    });
    const taskId = (task._id as Types.ObjectId).toHexString();
    const fileId = new Types.ObjectId();
    await File.create({
      _id: fileId,
      userId: 111,
      name: 'report.pdf',
      path: 'uploads/report.pdf',
      type: 'application/pdf',
      size: 1024,
      uploadedAt: new Date(),
    });

    const foreignFileId = new Types.ObjectId();
    await File.create({
      _id: foreignFileId,
      userId: 222,
      name: 'invoice.pdf',
      path: 'uploads/invoice.pdf',
      type: 'application/pdf',
      size: 2048,
      uploadedAt: new Date(),
    });

    const payload = {
      attachments: [
        {
          name: 'report.pdf',
          url: `/api/v1/files/${fileId.toHexString()}`,
          thumbnailUrl: `/api/v1/files/${fileId.toHexString()}?mode=inline&variant=thumbnail`,
          uploadedBy: 111,
          uploadedAt: new Date().toISOString(),
          type: 'application/pdf',
          size: 1024,
        },
        {
          name: 'invoice.pdf',
          url: `/api/v1/files/${foreignFileId.toHexString()}`,
          thumbnailUrl: `/api/v1/files/${foreignFileId.toHexString()}?mode=inline&variant=thumbnail`,
          uploadedBy: 222,
          uploadedAt: new Date().toISOString(),
          type: 'application/pdf',
          size: 2048,
        },
      ],
    };

    const response = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .send(payload);

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.attachments));
    assert.equal(response.body.attachments.length, 2);
    assert.equal(response.body.attachments[0].url, payload.attachments[0].url);
    assert.equal(response.body.attachments[1].url, payload.attachments[1].url);

    const updatedFile = await File.findById(fileId).lean();
    assert.ok(updatedFile?.taskId, 'ожидали установленный taskId у файла');
    assert.equal(
      updatedFile?.taskId?.toString(),
      taskId,
      'taskId файла должен совпадать с обновляемой задачей',
    );

    const updatedForeignFile = await File.findById(foreignFileId).lean();
    assert.ok(
      updatedForeignFile?.taskId,
      'ожидали установленный taskId у файла другого пользователя',
    );
    assert.equal(
      updatedForeignFile?.taskId?.toString(),
      taskId,
      'taskId файла другого пользователя должен совпадать с задачей',
    );
  });
});
