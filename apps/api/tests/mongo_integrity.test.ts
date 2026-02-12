process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'token';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 'secret';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

import '../../../tests/setupMongoMemoryServer';

import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { RoutePlan } from '../src/db/models/routePlan';
import { Task } from '../src/db/model';
import { createDraftFromInputs } from '../src/services/routePlans';

jest.setTimeout(60_000);

describe('MongoDB Integrity & Transactions', () => {
  let taskIds: Types.ObjectId[] = [];
  let mongod: MongoMemoryServer | null = null;
  let skipSuite = false;

  beforeAll(async () => {
    try {
      mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri());
    } catch (error) {
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
    if (skipSuite || !mongod) return;
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('should unassign tasks when RoutePlan is deleted', async () => {
    if (skipSuite) return;
    const tasks = await Task.create([
      { title: 'Task 1', status: 'Новая' },
      { title: 'Task 2', status: 'Новая' },
    ]);
    taskIds = tasks.map((t) => (t as { _id: Types.ObjectId })._id);

    const plan = await RoutePlan.create({
      title: 'Test Plan',
      status: 'draft',
      tasks: taskIds,
    });

    await Task.updateMany({ _id: { $in: taskIds } }, { routePlanId: plan._id });

    const tasksBefore = await Task.find({ _id: { $in: taskIds } });
    tasksBefore.forEach((t) =>
      expect(t.routePlanId?.toString()).toBe(plan._id.toString()),
    );

    await RoutePlan.deleteOne({ _id: plan._id });

    const tasksAfter = await Task.find({ _id: { $in: taskIds } });
    tasksAfter.forEach((t) => expect(t.routePlanId).toBeNull());
  });

  it('should remove task from RoutePlan when Task is deleted', async () => {
    if (skipSuite) return;
    const task = await Task.create({
      title: 'Task To Delete',
      status: 'Новая',
    });

    const plan = await RoutePlan.create({
      title: 'Plan For Task Deletion',
      status: 'draft',
      tasks: [(task as { _id: Types.ObjectId })._id],
    });
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
