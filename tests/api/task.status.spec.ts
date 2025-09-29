/**
 * Назначение файла: интеграционные тесты статуса задач.
 * Основные модули: mongodb-memory-server, mongoose, queries.updateTaskStatus.
 */
import mongoose, { Types } from 'mongoose';
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

describe('updateTaskStatus', function () {
  const suite = this as { timeout?: (ms: number) => void };
  suite.timeout?.(60000);

  let mongod: MongoMemoryServer;
  let Task: typeof import('../../apps/api/src/db/model').Task;
  let updateTaskStatus: typeof import('../../apps/api/src/db/queries').updateTaskStatus;
  let bulkUpdate: typeof import('../../apps/api/src/db/queries').bulkUpdate;

  before(async function () {
    const hook = this as { timeout?: (ms: number) => void };
    hook.timeout?.(60000);
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGO_DATABASE_URL = uri;
    await mongoose.connect(uri);

    const models = await import('../../apps/api/src/db/model');
    Task = models.Task;
    ({ updateTaskStatus, bulkUpdate } = await import(
      '../../apps/api/src/db/queries'
    ));
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  it('устанавливает completed_at для финальных статусов и сбрасывает при откате', async () => {
    const task = await Task.create({
      title: 'demo',
      created_by: 1,
      request_id: 'ERM_TEST',
      task_number: 'ERM_TEST',
    });
    const id = (task._id as Types.ObjectId).toHexString();

    const completed = await updateTaskStatus(id, 'Выполнена', 42);
    assert.equal(completed?.status, 'Выполнена');
    assert.ok(completed?.completed_at instanceof Date);

    const reopened = await updateTaskStatus(id, 'В работе', 42);
    assert.equal(reopened?.status, 'В работе');
    assert.equal(reopened?.completed_at, null);

    await bulkUpdate([id], { status: 'Отменена' });
    const afterBulk = await Task.findById(id).lean();
    assert.equal(afterBulk?.status, 'Отменена');
    assert.ok(afterBulk?.completed_at instanceof Date);

    await bulkUpdate([id], { status: 'Новая' });
    const reopenedBulk = await Task.findById(id).lean();
    assert.equal(reopenedBulk?.status, 'Новая');
    assert.equal(reopenedBulk?.completed_at, null);
  });
});
