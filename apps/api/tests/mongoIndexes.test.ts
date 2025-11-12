// Назначение: проверка использования индексов MongoDB.
// Модули: mongoose, mongodb-memory-server, ensureTaskIndexes.
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
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
  let mongod: MongoMemoryServer;

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
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await cleanDatabase();
    await mongoose.disconnect();
    await mongod.stop();
  });

  describe('индексы задач', () => {
    beforeEach(async () => {
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
      const cursor = getDb()
        .collection('tasks')
        .find({ assigneeId: 1, status: 'Новая', dueAt: { $gte: new Date(0) } })
        .sort({ dueAt: 1 });
      const exp = await cursor.explain('queryPlanner');
      expect(planHasStage(exp.queryPlanner.winningPlan, 'IXSCAN')).toBe(true);
    });

    test('сортировка по дате создания использует индекс', async () => {
      const cursor = getDb().collection('tasks').find().sort({ createdAt: -1 });
      const exp = await cursor.explain('queryPlanner');
      expect(planHasStage(exp.queryPlanner.winningPlan, 'IXSCAN')).toBe(true);
    });
  });

  describe('индексы загрузок', () => {
    beforeEach(async () => {
      await cleanDatabase();
      await ensureUploadIndexes(mongoose.connection);
    });

    test('создаются индексы ключа и владельца', async () => {
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
      await cleanDatabase();
      await ensureCollectionItemIndexes(mongoose.connection);
    });

    test('создаются уникальный и текстовый индексы', async () => {
      const indexes = await getDb().collection('collectionitems').indexes();
      expect(indexes.some((i) => i.name === 'type_name_unique')).toBe(true);
      expect(indexes.some((i) => i.name === 'search_text')).toBe(true);
    });

    afterAll(async () => {
      await cleanDatabase();
    });
  });
});
