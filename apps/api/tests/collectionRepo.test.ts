// Назначение: проверка фильтрации и пагинации в collectionRepo
// Модули: mongodb-memory-server, mongoose, collectionRepo
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { create, list } from '../src/db/repos/collectionRepo';

jest.setTimeout(30000);

describe('collectionRepo', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test('фильтрация и пагинация', async () => {
    await create({ type: 't1', name: 'n1', value: 'v1' });
    await create({ type: 't1', name: 'n2', value: 'v2' });
    await create({ type: 't2', name: 'n3', value: 'v3' });
    const res = await list({ type: 't1' }, 1, 10);
    expect(res.total).toBe(2);
    expect(res.items).toHaveLength(2);
    const page2 = await list({}, 2, 1);
    expect(page2.items).toHaveLength(1);
    const search = await list({ search: 'v3' }, 1, 10);
    expect(search.items[0].name).toBe('n3');
  });
});
