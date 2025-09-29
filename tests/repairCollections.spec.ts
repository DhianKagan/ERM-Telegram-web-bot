// Назначение: проверяет восстановление и очистку ссылок коллекций.
// Основные модули: mongoose, mongodb-memory-server, repairCollections.
import { MongoMemoryServer } from 'mongodb-memory-server';

import { repairCollections } from '../scripts/db/repairCollections';

jest.setTimeout(180000);

const mongoose = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('mongoose');
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../apps/api/node_modules/mongoose');
  }
})();

const getModel = (name: string) => mongoose.model(name);

describe('repairCollections', () => {
  let server: MongoMemoryServer;
  let uri: string;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    uri = server.getUri();
    process.env.MONGO_DATABASE_URL = uri;
    await mongoose.connect(uri);
  });

  afterEach(async () => {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (server) {
      await server.stop();
    }
    delete process.env.MONGO_DATABASE_URL;
  });

  test('восстанавливает отсутствующие элементы и нормализует значения', async () => {
    const CollectionItem = getModel('CollectionItem');
    const User = getModel('User');
    const Task = getModel('Task');
    const Employee = getModel('Employee');

    const existingDepartmentId = new mongoose.Types.ObjectId();
    await CollectionItem.create({
      _id: existingDepartmentId,
      type: 'departments',
      name: '  Финансовый отдел  ',
      value: '  finance  ',
    });

    const missingDivisionId = new mongoose.Types.ObjectId();
    const missingPositionId = new mongoose.Types.ObjectId();
    const missingTaskDepartmentId = new mongoose.Types.ObjectId();

    await User.create({
      telegram_id: 101,
      email: '101@example.com',
      access: 1,
      departmentId: existingDepartmentId,
      divisionId: missingDivisionId,
      positionId: missingPositionId,
    });

    await Task.create({
      title: 'Тестовая задача',
      task_number: 'ERM_000001',
      departmentId: missingTaskDepartmentId,
    });

    await Employee.create({
      name: 'Иван',
      departmentId: existingDepartmentId,
      positionId: missingPositionId,
    });

    const result = await repairCollections();

    expect(result.normalized).toBe(1);
    expect(result.restored).toBe(3);
    expect(result.cleared).toBe(0);

    const items = await CollectionItem.find().lean();
    const names = items.map((item: any) => item.name);
    expect(names).toContain('Финансовый отдел');
    const restoredDivision = await CollectionItem.findOne({ _id: missingDivisionId });
    expect(restoredDivision).not.toBeNull();
    expect(restoredDivision?.get('meta')).toMatchObject({ invalid: true });
    const restoredPosition = await CollectionItem.findOne({ _id: missingPositionId });
    expect(restoredPosition?.get('value')).toBe(missingPositionId.toHexString());
    const restoredDepartment = await CollectionItem.findOne({ _id: missingTaskDepartmentId });
    expect(restoredDepartment?.get('name')).toContain(missingTaskDepartmentId.toHexString());
  });

  test('очищает ссылки с недопустимыми идентификаторами', async () => {
    const usersCollection = mongoose.connection.collection('users');
    await usersCollection.insertOne({
      telegram_id: 202,
      email: '202@example.com',
      access: 1,
      divisionId: 'неверный-id',
    });

    const result = await repairCollections();

    expect(result.cleared).toBe(1);
    const stored = await usersCollection.findOne({ telegram_id: 202 });
    expect(stored?.divisionId).toBeUndefined();
  });
});
