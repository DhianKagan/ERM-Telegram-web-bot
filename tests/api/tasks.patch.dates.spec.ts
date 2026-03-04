/**
 * Назначение файла: интеграционный тест обновления задачи без изменения дат.
 * Основные модули: express, supertest, mongoose.
 */
import express from 'express';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
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

describe('PATCH /api/v1/tasks/:id без изменения дат', function () {
  let skipSuite = false;
  let app: express.Express;
  let Task: typeof import('../../apps/api/src/db/model').Task;
  let updateTask: typeof import('../../apps/api/src/db/queries').updateTask;

  beforeAll(async function () {
    const uri = process.env.MONGO_DATABASE_URL;
    if (!uri) {
      skipSuite = true;
      console.warn('MONGO_DATABASE_URL не задан для tasks.patch.dates.spec');
      return;
    }
    process.env.MONGO_DATABASE_URL = uri;
    delete process.env.MONGODB_URI;
    delete process.env.DATABASE_URL;
    process.env.SESSION_SECRET ||= 'test-session-secret';

    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    } catch (error) {
      skipSuite = true;
      console.warn('MongoDB недоступна, пропускаем suite', { error });
      return;
    }
    ({ Task } = await import('../../apps/api/src/db/model'));
    ({ updateTask } = await import('../../apps/api/src/db/queries'));

    app = express();
    app.use(express.json());
    app.patch('/api/v1/tasks/:id', async (req, res) => {
      try {
        const task = await updateTask(req.params.id, req.body, 777);
        if (!task) {
          res.status(404).json({ error: 'not found' });
          return;
        }
        res.json(task);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });
  }, 60000);

  afterAll(async () => {
    if (skipSuite) return;
    await mongoose.disconnect();
  }, 60000);

  beforeEach(async () => {
    if (skipSuite) return;
    const connection = mongoose.connection;
    if (connection.readyState === 1) {
      const { db } = connection;
      if (db) {
        await db.dropDatabase();
      }
    }
  });

  it('не добавляет записи об изменении дат в историю', async () => {
    if (skipSuite) return;
    const start = new Date('2024-05-01T09:00:00Z');
    const due = new Date('2024-05-01T14:00:00Z');
    const baseHistory = {
      changed_at: new Date('2024-05-01T08:00:00Z'),
      changed_by: 555,
      changes: { from: {}, to: { status: 'Новая' } },
    };
    const task = await Task.create({
      title: 'Задача без изменения дат',
      created_by: 555,
      request_id: 'ERM_HISTORY',
      task_number: 'ERM_HISTORY',
      start_date: start,
      due_date: due,
      history: [baseHistory],
    });
    const taskId = (task._id as Types.ObjectId).toHexString();

    const response = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .send({ priority: 'Срочно' });

    assert.equal(response.status, 200);
    assert.equal(response.body.priority, 'Срочно');
    const stored = await Task.findById(taskId).lean();
    assert.ok(stored, 'ожидали найденную задачу после обновления');
    assert.ok(
      Array.isArray(stored?.history),
      'должна существовать история изменений',
    );
    const history = stored?.history as Array<{
      changes: { from: Record<string, unknown>; to: Record<string, unknown> };
    }>;
    assert.equal(history.length, 2);
    const lastEntry = history[history.length - 1];
    assert.deepEqual(lastEntry.changes.to, { priority: 'Срочно' });
    assert.ok(!('start_date' in lastEntry.changes.to));
    assert.ok(!('due_date' in lastEntry.changes.to));
  });
});
