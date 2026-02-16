process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'token';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 'secret';
process.env.MONGO_DATABASE_URL ||= 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { RoutePlan } from '../src/db/models/routePlan';
import { Task } from '../src/db/model';
import { createDraftFromInputs } from '../src/services/routePlans';

jest.setTimeout(60_000);

describe('MongoDB Integrity & Transactions', () => {
  let taskIds: Types.ObjectId[] = [];
  let createdTaskIds: Types.ObjectId[] = [];
  let createdRoutePlanIds: Types.ObjectId[] = [];
  let mongod: MongoMemoryServer | null = null;
  let skipSuite = false;
  let usingExternalMongo = false;

  const shouldUseExternalMongo = (): boolean => {
    const mongoUrl = process.env.MONGO_DATABASE_URL;
    if (!mongoUrl) return false;
    if (mongoUrl === 'mongodb://localhost/db') return false;
    if (mongoUrl.includes('localhost:27017/ermdb')) return false;
    try {
      const parsed = new URL(mongoUrl);
      if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) return false;
      if (['localhost', '127.0.0.1', '::1', 'http'].includes(parsed.hostname)) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const getMongoHost = (): string | null => {
    const mongoUrl = process.env.MONGO_DATABASE_URL;
    if (!mongoUrl) return null;
    try {
      return new URL(mongoUrl).host;
    } catch {
      return null;
    }
  };

  beforeAll(async () => {
    try {
      if (shouldUseExternalMongo()) {
        usingExternalMongo = true;
        await mongoose.connect(process.env.MONGO_DATABASE_URL as string);
        const host = getMongoHost();
        if (host) {
          console.info(
            `mongo_integrity.test: подтверждена внешняя MongoDB по ссылке ${host}`,
          );
        }
        return;
      }

      await import('../../../tests/setupMongoMemoryServer');
      mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri());
    } catch (error) {
      if (usingExternalMongo) {
        usingExternalMongo = false;
        try {
          await import('../../../tests/setupMongoMemoryServer');
          mongod = await MongoMemoryServer.create();
          await mongoose.connect(mongod.getUri());
          console.warn(
            'Внешняя MongoDB недоступна, выполнен fallback на MongoMemoryServer',
            {
              error,
            },
          );
          return;
        } catch (fallbackError) {
          skipSuite = true;
          console.warn(
            'MongoMemoryServer недоступен, пропускаем mongo_integrity.test',
            {
              error,
              fallbackError,
            },
          );
          return;
        }
      }

      skipSuite = true;
      console.warn(
        'MongoMemoryServer недоступен, пропускаем mongo_integrity.test',
        {
          error,
        },
      );
    }
  });

  afterAll(async () => {
    if (skipSuite) return;

    if (createdTaskIds.length > 0) {
      await Task.deleteMany({ _id: { $in: createdTaskIds } });
    }

    if (createdRoutePlanIds.length > 0) {
      await RoutePlan.deleteMany({ _id: { $in: createdRoutePlanIds } });
    }

    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  it('should unassign tasks when RoutePlan is deleted', async () => {
    if (skipSuite) return;
    const tasks = await Task.create([
      { title: 'Task 1', status: 'Новая' },
      { title: 'Task 2', status: 'Новая' },
    ]);
    taskIds = tasks.map((t) => (t as { _id: Types.ObjectId })._id);
    createdTaskIds.push(...taskIds);

    const plan = await RoutePlan.create({
      title: 'Test Plan',
      status: 'draft',
      tasks: taskIds,
    });
    createdRoutePlanIds.push((plan as { _id: Types.ObjectId })._id);

    await Task.updateMany({ _id: { $in: taskIds } }, { routePlanId: plan._id });

    const tasksBefore = await Task.find({ _id: { $in: taskIds } });
    tasksBefore.forEach((t) =>
      expect(t.routePlanId?.toString()).toBe(plan._id.toString()),
    );

    await RoutePlan.deleteOne({ _id: plan._id });

    const tasksAfter = await Task.find({ _id: { $in: taskIds } });
    tasksAfter.forEach((t) => expect(t.routePlanId).toBeNull());
  });

  it('should confirm that public Mongo link is read when provided', async () => {
    if (skipSuite) return;
    if (!shouldUseExternalMongo() || !usingExternalMongo) return;
    const host = getMongoHost();
    expect(host).not.toBeNull();
    expect(host).not.toContain('localhost');
    expect(host).not.toContain('127.0.0.1');

    await mongoose.connection.db?.admin().ping();
  });

  it('should remove task from RoutePlan when Task is deleted', async () => {
    if (skipSuite) return;
    const task = await Task.create({
      title: 'Task To Delete',
      status: 'Новая',
    });
    createdTaskIds.push((task as { _id: Types.ObjectId })._id);

    const plan = await RoutePlan.create({
      title: 'Plan For Task Deletion',
      status: 'draft',
      tasks: [(task as { _id: Types.ObjectId })._id],
    });
    createdRoutePlanIds.push((plan as { _id: Types.ObjectId })._id);
    await Task.updateOne(
      { _id: (task as { _id: Types.ObjectId })._id },
      { routePlanId: plan._id },
    );

    await Task.deleteOne({ _id: (task as { _id: Types.ObjectId })._id });

    const planAfter = await RoutePlan.findById(plan._id);
    const taskIdsInPlan = planAfter?.tasks?.map((id) => id.toString());
    expect(taskIdsInPlan).not.toContain(
      (task as { _id: Types.ObjectId })._id.toString(),
    );

    await RoutePlan.deleteOne({ _id: plan._id });
  });

  it('should use transaction in createDraftFromInputs', async () => {
    if (skipSuite) return;
    try {
      const task = await Task.create({
        title: 'Transaction Task',
        status: 'Новая',
      });
      createdTaskIds.push((task as { _id: Types.ObjectId })._id);

      const result = await createDraftFromInputs(
        [
          {
            tasks: [(task as { _id: Types.ObjectId })._id.toString()],
            order: 0,
          },
        ],
        { title: 'Transaction Plan' },
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      createdRoutePlanIds.push(new Types.ObjectId(result.id));

      const updatedTask = await Task.findById(
        (task as { _id: Types.ObjectId })._id,
      );
      expect(updatedTask?.routePlanId?.toString()).toBe(result.id);

      await RoutePlan.deleteOne({ _id: result.id });
      await Task.deleteOne({ _id: (task as { _id: Types.ObjectId })._id });
    } catch (e: unknown) {
      const error = e as { message?: string };
      console.warn('Transaction test failed (possibly no Replica Set):', error);
      if (
        error.message?.includes('Transaction numbers') ||
        error.message?.includes('replica set')
      ) {
        console.log('Skipping transaction test due to standalone instance');
      } else {
        throw error;
      }
    }
  });
});
