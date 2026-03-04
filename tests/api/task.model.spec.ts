/**
 * Назначение файла: проверки хуков модели Task (приоритет и окна доставки).
 * Основные модули: mongoose, Task.
 */
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

describe('Task model — хуки сохранения', function () {
  let skipSuite = false;
  jest.setTimeout(60000);

  let Task: typeof import('../../apps/api/src/db/model').Task;

  beforeAll(async function () {
    jest.setTimeout(60000);
    const uri = process.env.MONGO_DATABASE_URL;
    if (!uri) {
      throw new Error('MONGO_DATABASE_URL не задан для task.model.spec');
    }
    process.env.MONGO_DATABASE_URL = uri;
    try {
      await mongoose.connect(uri);
    } catch (error) {
      skipSuite = true;
      console.warn('MongoDB недоступна, пропускаем task.model.spec', { error });
      return;
    }
    ({ Task } = await import('../../apps/api/src/db/model'));
  });

  afterAll(async () => {
    if (skipSuite) return;
    await mongoose.disconnect();
  });

  it('нормализует приоритет и копирует логистику в окно доставки', async () => {
    if (skipSuite) return;
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
    if (skipSuite) return;
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
