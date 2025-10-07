/**
 * Назначение файла: интеграционные тесты сервисов настроек задач.
 * Основные модули: mongoose, mongodb-memory-server, taskSettings service.
 */
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { strict as assert } from 'assert';

declare const describe: (
  name: string,
  suite: (this: unknown) => void,
) => void;
declare const it: (
  name: string,
  test: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const before: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const after: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const beforeEach: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;

describe('Сервис taskSettings', function () {
  const suite = this as { timeout?: (ms: number) => void };
  suite.timeout?.(60000);
  let mongod: MongoMemoryServer;
  let Task: typeof import('../../apps/api/src/db/model').Task;
  let CollectionItem: typeof import('../../apps/api/src/db/models/CollectionItem').CollectionItem;
  let getTaskFieldSettings: typeof import('../../apps/api/src/services/taskSettings').getTaskFieldSettings;
  let setTaskFieldLabel: typeof import('../../apps/api/src/services/taskSettings').setTaskFieldLabel;
  let setTaskTypeTheme: typeof import('../../apps/api/src/services/taskSettings').setTaskTypeTheme;
  let resolveTaskTypeTopicId: typeof import('../../apps/api/src/services/taskSettings').resolveTaskTypeTopicId;

  before(async function () {
    const hook = this as { timeout?: (ms: number) => void };
    hook.timeout?.(60000);
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGO_DATABASE_URL = uri;
    delete process.env.MONGODB_URI;
    delete process.env.DATABASE_URL;
    process.env.SESSION_SECRET ||= 'test-session-secret';
    process.env.NODE_ENV = 'test';

    await mongoose.connect(uri);
    ({ Task } = await import('../../apps/api/src/db/model'));
    ({ CollectionItem } = await import('../../apps/api/src/db/models/CollectionItem'));
    ({
      getTaskFieldSettings,
      setTaskFieldLabel,
      setTaskTypeTheme,
      resolveTaskTypeTopicId,
    } = await import('../../apps/api/src/services/taskSettings'));

    // Инициализируем express, чтобы не было неиспользуемого импорта
    express();
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
      await connection.db?.dropDatabase();
    }
  });

  it('обновляет пользовательскую подпись поля', async () => {
    const initial = await getTaskFieldSettings();
    const titleField = initial.find((field) => field.name === 'title');
    assert.ok(titleField, 'ожидали поле title в схеме');
    assert.equal(titleField.label, titleField.defaultLabel);

    await setTaskFieldLabel('title', 'Название заявки');

    const updated = await getTaskFieldSettings();
    const updatedTitle = updated.find((field) => field.name === 'title');
    assert.ok(updatedTitle);
    assert.equal(updatedTitle?.label, 'Название заявки');

    const stored = await CollectionItem.findOne({
      type: 'task_field_labels',
      name: 'title',
    })
      .lean()
      .exec();
    assert.ok(stored, 'ожидали сохранённый элемент');
    assert.equal(stored?.value, 'Название заявки');
  });

  it('назначает тему Telegram для типа задачи и обновляет задачи', async () => {
    await Task.create({
      title: 'Первая задача',
      task_type: 'Выполнить',
      history: [],
    });

    const setting = await setTaskTypeTheme(
      'Выполнить',
      'https://t.me/c/2705661520/627',
    );

    assert.equal(setting.topicId, 627);
    assert.ok(setting.tg_theme_url?.includes('/627'));

    const storedTask = await Task.findOne({ task_type: 'Выполнить' })
      .lean()
      .exec();
    assert.ok(storedTask);
    assert.equal(storedTask?.telegram_topic_id, 627);

    const topicId = await resolveTaskTypeTopicId('Выполнить');
    assert.equal(topicId, 627);

    const cleared = await setTaskTypeTheme('Выполнить', '');
    assert.equal(cleared.topicId, undefined);
    const refreshedTask = await Task.findOne({ task_type: 'Выполнить' })
      .lean()
      .exec();
    assert.ok(refreshedTask);
    assert.ok(
      !Object.prototype.hasOwnProperty.call(refreshedTask ?? {}, 'telegram_topic_id'),
    );
  });
});
