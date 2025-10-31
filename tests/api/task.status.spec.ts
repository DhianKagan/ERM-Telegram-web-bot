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

  it('запрещает обновление статуса пользователю без назначений', async () => {
    const task = await Task.create({
      title: 'restricted',
      created_by: 1,
      request_id: 'ERM_TEST',
      task_number: 'ERM_TEST',
      assigned_user_id: 77,
      assignees: [77],
    });
    const id = (task._id as Types.ObjectId).toHexString();

    await assert.rejects(
      () => updateTaskStatus(id, 'В работе', 42),
      /Нет прав на изменение статуса задачи/,
    );
  });

  it('не добавляет историю при повторном переводе в работу', async () => {
    const task = await Task.create({
      title: 'repeat in progress',
      created_by: 1,
      request_id: 'ERM_REPEAT',
      task_number: 'ERM_REPEAT',
    });
    const id = (task._id as Types.ObjectId).toHexString();

    const first = await updateTaskStatus(id, 'В работе', 42);
    assert.equal(first?.status, 'В работе');
    assert.ok(first?.in_progress_at instanceof Date);
    const historyAfterFirst = first?.history?.length ?? 0;
    const second = await updateTaskStatus(id, 'В работе', 42);
    const persisted = await Task.findById(id).lean();
    assert.ok(second);
    assert.ok(persisted);
    assert.equal(second.history?.length, historyAfterFirst);
    assert.equal(persisted.history?.length, historyAfterFirst);
    assert.ok(second.in_progress_at instanceof Date);
    assert.ok(persisted.in_progress_at instanceof Date);
    assert.equal(
      (second.in_progress_at as Date).getTime(),
      (first?.in_progress_at as Date).getTime(),
    );
    assert.equal(
      (persisted.in_progress_at as Date).getTime(),
      (first?.in_progress_at as Date).getTime(),
    );
  });

  it('не добавляет историю при повторном завершении', async () => {
    const task = await Task.create({
      title: 'repeat completion',
      created_by: 1,
      request_id: 'ERM_REPEAT_DONE',
      task_number: 'ERM_REPEAT_DONE',
    });
    const id = (task._id as Types.ObjectId).toHexString();

    const first = await updateTaskStatus(id, 'Выполнена', 42);
    assert.equal(first?.status, 'Выполнена');
    assert.ok(first?.completed_at instanceof Date);
    const historyAfterFirst = first?.history?.length ?? 0;
    const second = await updateTaskStatus(id, 'Выполнена', 42);
    const persisted = await Task.findById(id).lean();
    assert.ok(second);
    assert.ok(persisted);
    assert.equal(second.history?.length, historyAfterFirst);
    assert.equal(persisted.history?.length, historyAfterFirst);
    assert.ok(second.completed_at instanceof Date);
    assert.ok(persisted.completed_at instanceof Date);
    assert.equal(
      (second.completed_at as Date).getTime(),
      (first?.completed_at as Date).getTime(),
    );
    assert.equal(
      (persisted.completed_at as Date).getTime(),
      (first?.completed_at as Date).getTime(),
    );
  });

  it('разрешает отмену задачи только создателю через веб', async () => {
    const task = await Task.create({
      title: 'cancel web',
      created_by: 101,
      assigned_user_id: 77,
      assignees: [77],
    });
    const id = (task._id as Types.ObjectId).toHexString();

    const updated = await updateTaskStatus(id, 'Отменена', 101);
    assert.equal(updated?.status, 'Отменена');
    assert.ok(updated?.completed_at instanceof Date);

    await assert.rejects(
      () => updateTaskStatus(id, 'Отменена', 77),
      /Статус «Отменена» может установить только создатель задачи\./,
    );
  });

  it('запрещает отмену задачи через Telegram даже создателю', async () => {
    const task = await Task.create({
      title: 'cancel telegram',
      created_by: 202,
    });
    const id = (task._id as Types.ObjectId).toHexString();

    await assert.rejects(
      () => updateTaskStatus(id, 'Отменена', 202, { source: 'telegram' }),
      /Отмена задачи в Telegram недоступна\. Используйте веб-форму\./,
    );
  });

  it('позволяет обновить статус при исполнителях в виде объектов', async () => {
    const task = await Task.create({
      title: 'object assignee',
      created_by: 303,
      request_id: 'ERM_OBJECT',
      task_number: 'ERM_OBJECT',
    });
    await Task.collection.updateOne(
      { _id: task._id },
      {
        $set: {
          assignees: [{ telegram_id: 404 }, { user_id: 404 }],
        },
      },
    );
    const id = (task._id as Types.ObjectId).toHexString();
    const updated = await updateTaskStatus(id, 'В работе', 404);
    assert.equal(updated?.status, 'В работе');
  });

  it('позволяет автору заявки отменить её без назначения', async () => {
    const request = await Task.create({
      title: 'request cancel',
      kind: 'request',
      task_type: 'Заявка',
      created_by: 303,
    });
    const id = (request._id as Types.ObjectId).toHexString();

    const updated = await updateTaskStatus(id, 'Отменена', 303);
    assert.equal(updated?.status, 'Отменена');
  });

  it('запрещает отмену заявки стороннему пользователю', async () => {
    const request = await Task.create({
      title: 'request forbid',
      kind: 'request',
      task_type: 'Заявка',
      created_by: 404,
      assigned_user_id: 505,
      assignees: [505],
    });
    const id = (request._id as Types.ObjectId).toHexString();

    await assert.rejects(
      () => updateTaskStatus(id, 'Отменена', 909),
      /Отменить заявку могут только исполнитель или создатель\./,
    );
  });
});
