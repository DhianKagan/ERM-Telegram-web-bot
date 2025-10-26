/**
 * Назначение файла: интеграционные тесты создания задач с вложениями.
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

import { taskFields } from '../../packages/shared/src/taskFields';
import taskFormSchema from '../../packages/shared/src/taskForm.schema.json';
import {
  ACCESS_ADMIN,
  ACCESS_MANAGER,
  ACCESS_TASK_DELETE,
  ACCESS_USER,
} from '../../apps/api/src/utils/accessMask';


describe('POST /api/v1/tasks с вложениями', function () {
  const suite = this as { timeout?: (ms: number) => void };
  suite.timeout?.(60000);

  let app: express.Express;
  let mongod: MongoMemoryServer;
  let token: string;
  let uploadsDir: string;
  let FileModel: typeof import('../../apps/api/src/db/model').File;
  let TaskModel: typeof import('../../apps/api/src/db/model').Task;
  let UserModel: typeof import('../../apps/api/src/db/model').User;

  const defaults = (() => {
    const lookup = new Map(taskFields.map((field) => [field.name, field]));
    const pick = (name: string, fallback: string) => {
      const field = lookup.get(name);
      return typeof field?.default === 'string' ? field.default : fallback;
    };
    return {
      taskType: pick('task_type', 'Доставка'),
      priority: pick('priority', 'Средний'),
      transportType: pick('transport_type', 'Пеший'),
      paymentMethod: pick('payment_method', 'Без оплаты'),
      status: pick('status', 'Новая'),
    };
  })();

  before(async function () {
    const hook = this as { timeout?: (ms: number) => void };
    hook.timeout?.(60000);
    uploadsDir = path.join(os.tmpdir(), `erm-task-uploads-${Date.now()}`);
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

    const models = await import('../../apps/api/src/db/model');
    FileModel = models.File;
    TaskModel = models.Task;
    UserModel = models.User;

    const tasksRouter = (await import('../../apps/api/src/routes/tasks')).default;
    app = express();
    app.use(express.json());
    app.use('/api/v1/tasks', tasksRouter);

    token = jwt.sign(
      {
        id: 500,
        telegram_id: 500,
        username: 'manager',
        role: 'admin',
        access: ACCESS_TASK_DELETE,
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

  it('привязывает загруженный файл к созданной задаче', async () => {
    await UserModel.create({
      telegram_id: 500,
      username: 'manager',
      name: 'Администратор',
      role: 'admin',
      access: ACCESS_TASK_DELETE,
      email: 'admin@example.com',
    });

    const response = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Тестовая задача')
      .field('task_type', defaults.taskType)
      .field('priority', defaults.priority)
      .field('transport_type', defaults.transportType)
      .field('payment_method', defaults.paymentMethod)
      .field('status', defaults.status)
      .field('formVersion', String(taskFormSchema.formVersion))
      .field('payment_amount', '0')
      .attach('file', Buffer.from('demo-content'), 'report.txt');

    assert.equal(response.status, 201);
    assert.ok(response.body?._id, 'ожидали идентификатор созданной задачи');
    assert.ok(
      Array.isArray(response.body.attachments),
      'ответ должен содержать массив вложений',
    );
    assert.equal(response.body.attachments.length, 1);
    const storedFile = await FileModel.findOne({ name: 'report.txt' }).lean();
    assert.ok(storedFile, 'файл должен быть сохранён в базе');
    const taskId = response.body._id as string;
    assert.equal(
      storedFile?.taskId?.toString(),
      taskId,
      'файл должен быть привязан к созданной задаче',
    );
    const persistedTask = await TaskModel.findById(taskId).lean();
    assert.ok(persistedTask, 'ожидали задачу в базе');
    assert.equal(persistedTask?.attachments?.length ?? 0, 1);
  });

  it('удаляет файл при ошибке создания заявки', async () => {
    await UserModel.create({
      telegram_id: 123,
      username: 'operator',
      name: 'Оператор',
      role: 'user',
      access: ACCESS_USER,
      email: 'user@example.com',
    });

    const response = await request(app)
      .post('/api/v1/tasks/requests')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Заявка без администратора')
      .field('task_type', defaults.taskType)
      .field('priority', defaults.priority)
      .field('transport_type', defaults.transportType)
      .field('payment_method', defaults.paymentMethod)
      .field('status', defaults.status)
      .field('formVersion', String(taskFormSchema.formVersion))
      .field('assignees[]', '123')
      .attach('file', Buffer.from('reject-me'), 'reject.txt');

    assert.equal(response.status, 403);
    assert.deepEqual(
      await FileModel.find({}).lean(),
      [],
      'файлы должны быть очищены при ошибке создания',
    );
  });
});
