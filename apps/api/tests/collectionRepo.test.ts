// Назначение: проверка фильтрации и пагинации в collectionRepo
// Модули: mongoose, collectionRepo, ensureIndexes
import mongoose from 'mongoose';
import { create, list } from '../src/db/repos/collectionRepo';
import { ensureCollectionItemIndexes } from '../../../scripts/db/ensureIndexes';

jest.setTimeout(30000);

describe('collectionRepo', () => {
  let skipSuite = false;

  beforeAll(async () => {
    try {
      const mongoUrl = process.env.MONGO_DATABASE_URL;
      if (!mongoUrl)
        throw new Error('MONGO_DATABASE_URL не задан для collectionRepo.test');
      await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5000 });
      await ensureCollectionItemIndexes(mongoose.connection);
    } catch (error) {
      skipSuite = true;
      console.warn('MongoDB недоступна, пропускаем collectionRepo.test', {
        error,
      });
    }
  });

  afterAll(async () => {
    if (skipSuite) return;
    await mongoose.disconnect();
  });

  test('фильтрация и пагинация', async () => {
    if (skipSuite) return;
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
