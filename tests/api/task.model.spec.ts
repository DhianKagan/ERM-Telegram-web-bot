/**
 * Назначение файла: проверки хуков модели Task (приоритет и окна доставки).
 * Основные модули: mongodb-memory-server, mongoose, Task.
 */
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

describe('Task model — хуки сохранения', function () {
  const suite = this as { timeout?: (ms: number) => void };
  suite.timeout?.(60000);

  let mongod: MongoMemoryServer;
  let Task: typeof import('../../apps/api/src/db/model').Task;

  before(async function () {
    const hook = this as { timeout?: (ms: number) => void };
    hook.timeout?.(60000);
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGO_DATABASE_URL = uri;
    await mongoose.connect(uri);
    ({ Task } = await import('../../apps/api/src/db/model'));
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  it('нормализует приоритет и копирует логистику в окно доставки', async () => {
    const startDate = new Date('2024-03-01T08:00:00Z');
    const endDate = new Date('2024-03-01T12:00:00Z');

    const task = await Task.create({
      title: 'Проверка приоритета',
      priority: '  Бессрочная задача  ',
      logistics_details: { start_date: startDate, end_date: endDate },
    });

    assert.equal(task.priority, 'До выполнения');
    assert.ok(task.delivery_window_start instanceof Date);
    assert.ok(task.delivery_window_end instanceof Date);

    const persisted = await Task.findById(task._id).lean();
    assert.ok(persisted);
    assert.ok(persisted?.delivery_window_start instanceof Date);
    assert.ok(persisted?.delivery_window_end instanceof Date);
  });

  it('прокидывает окно доставки в логистику при создании', async () => {
    const windowStart = new Date('2024-03-05T09:30:00Z');
    const windowEnd = new Date('2024-03-05T14:15:00Z');

    const created = await Task.create({
      title: 'Проверка окна',
      delivery_window_start: windowStart,
      delivery_window_end: windowEnd,
    });

    const stored = await Task.findById(created._id).lean();
    assert.ok(stored);
    assert.ok(stored?.logistics_details);
    assert.ok(stored?.logistics_details?.start_date instanceof Date);
    assert.ok(stored?.logistics_details?.end_date instanceof Date);
  });
});
