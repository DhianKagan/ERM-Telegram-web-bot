// Назначение: проверка использования индексов MongoDB.
// Модули: mongoose, mongodb-memory-server, ensureTaskIndexes.
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  ensureTaskIndexes,
  ensureUploadIndexes,
} from '../../scripts/db/ensureIndexes';

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

describe('индексы задач', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await mongoose.connection.db.collection('tasks').insertOne({
      assigneeId: 1,
      status: 'Новая',
      dueAt: new Date(),
      createdAt: new Date(),
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test('запрос по исполнителю и статусу использует композитный индекс', async () => {
    await ensureTaskIndexes(mongoose.connection);
    const cursor = mongoose.connection.db
      .collection('tasks')
      .find({ assigneeId: 1, status: 'Новая', dueAt: { $gte: new Date(0) } })
      .sort({ dueAt: 1 });
    const exp = await cursor.explain('queryPlanner');
    expect(planHasStage(exp.queryPlanner.winningPlan, 'IXSCAN')).toBe(true);
  });

  test('сортировка по дате создания использует индекс', async () => {
    const cursor = mongoose.connection.db
      .collection('tasks')
      .find()
      .sort({ createdAt: -1 });
    const exp = await cursor.explain('queryPlanner');
    expect(planHasStage(exp.queryPlanner.winningPlan, 'IXSCAN')).toBe(true);
  });
});

describe('индексы загрузок', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test('создаются индексы ключа и владельца', async () => {
    await ensureUploadIndexes(mongoose.connection);
    const indexes = await mongoose.connection.db
      .collection('uploads')
      .indexes();
    expect(indexes.some((i) => i.name === 'key_unique')).toBe(true);
    expect(indexes.some((i) => i.name === 'owner_idx')).toBe(true);
  });
});
