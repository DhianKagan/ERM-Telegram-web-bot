// Назначение: проверка использования индексов MongoDB.
// Модули: mongoose, ensureTaskIndexes.
import mongoose from 'mongoose';
import {
  ensureTaskIndexes,
  ensureUploadIndexes,
  ensureCollectionItemIndexes,
} from '../../../scripts/db/ensureIndexes';

jest.setTimeout(60000);
interface Plan {
  stage?: string;
  inputStage?: Plan;
  inputStages?: Plan[];
}

function planHasStage(plan: Plan | undefined, stage: string): boolean {
  if (!plan) return false;
  if (plan.stage === stage) return true;
  if (plan.inputStage) return planHasStage(plan.inputStage, stage);
  if (plan.inputStages)
    return plan.inputStages.some((p) => planHasStage(p, stage));
  return false;
}

describe('индексы MongoDB', () => {
  let skipSuite = false;

  const cleanDatabase = async () => {
    if (mongoose.connection.readyState !== 1) return;
    try {
      const db = mongoose.connection.db;
      if (!db) return;
      await db.dropDatabase();
    } catch (error) {
      const maybe = error as { codeName?: string; message?: string };
      if (
        maybe?.codeName !== 'NamespaceNotFound' &&
        !maybe?.message?.includes('ns not found')
      ) {
        throw error;
      }
    }
  };

  const getDb = () => {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Подключение MongoDB недоступно');
    }
    return db;
  };

  beforeAll(async () => {
    try {
      const mongoUrl = process.env.MONGO_DATABASE_URL;
      if (!mongoUrl)
        throw new Error('MONGO_DATABASE_URL не задан для mongoIndexes.test');
      await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5000 });
    } catch (error) {
      skipSuite = true;
      console.warn('MongoDB недоступна, пропускаем mongoIndexes.test', {
        error,
      });
    }
  });

  afterAll(async () => {
    if (skipSuite) return;
    await cleanDatabase();
    await mongoose.disconnect();
  });

  describe('индексы задач', () => {
    beforeEach(async () => {
      if (skipSuite) return;
      await cleanDatabase();
      await getDb().collection('tasks').insertOne({
        assigneeId: 1,
        status: 'Новая',
        dueAt: new Date(),
        createdAt: new Date(),
      });
      await ensureTaskIndexes(mongoose.connection);
    });

    afterAll(async () => {
      await cleanDatabase();
    });

    test('запрос по исполнителю и статусу использует композитный индекс', async () => {
      if (skipSuite) return;
      const cursor = getDb()
        .collection('tasks')
        .find({ assigneeId: 1, status: 'Новая', dueAt: { $gte: new Date(0) } })
        .sort({ dueAt: 1 });
      const exp = await cursor.explain('queryPlanner');
      expect(planHasStage(exp.queryPlanner.winningPlan, 'IXSCAN')).toBe(true);
    });

    test('сортировка по дате создания использует индекс', async () => {
      if (skipSuite) return;
      const cursor = getDb().collection('tasks').find().sort({ createdAt: -1 });
      const exp = await cursor.explain('queryPlanner');
      expect(planHasStage(exp.queryPlanner.winningPlan, 'IXSCAN')).toBe(true);
    });
  });

  describe('индексы загрузок', () => {
    beforeEach(async () => {
      if (skipSuite) return;
      await cleanDatabase();
      await ensureUploadIndexes(mongoose.connection);
    });

    test('создаются индексы ключа и владельца', async () => {
      if (skipSuite) return;
      const indexes = await getDb().collection('uploads').indexes();
      expect(indexes.some((i) => i.name === 'key_unique')).toBe(true);
      expect(indexes.some((i) => i.name === 'owner_idx')).toBe(true);
    });

    afterAll(async () => {
      await cleanDatabase();
    });
  });

  describe('индексы коллекции', () => {
    beforeEach(async () => {
      if (skipSuite) return;
      await cleanDatabase();
      await ensureCollectionItemIndexes(mongoose.connection);
    });

    test('создаются уникальный и текстовый индексы', async () => {
      if (skipSuite) return;
      const indexes = await getDb().collection('collectionitems').indexes();
      expect(indexes.some((i) => i.name === 'type_name_unique')).toBe(true);
      expect(indexes.some((i) => i.name === 'search_text')).toBe(true);
    });

    afterAll(async () => {
      await cleanDatabase();
    });
  });
});
