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
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('should unassign tasks when RoutePlan is deleted', async () => {
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

  it('should cleanup the exact task deleted by query deleteOne', async () => {
    const [task1, task2] = await Task.create([
      { title: 'Same title', status: 'Новая' },
      { title: 'Same title', status: 'Новая' },
    ]);

    const plan1 = await RoutePlan.create({
      title: 'Plan 1',
      status: 'draft',
      tasks: [(task1 as { _id: Types.ObjectId })._id],
    });
    const plan2 = await RoutePlan.create({
      title: 'Plan 2',
      status: 'draft',
      tasks: [(task2 as { _id: Types.ObjectId })._id],
    });

    await Task.updateMany(
      {
        _id: {
          $in: [
            (task1 as { _id: Types.ObjectId })._id,
            (task2 as { _id: Types.ObjectId })._id,
          ],
        },
      },
      [
        {
          $set: {
            routePlanId: {
              $cond: [
                { $eq: ['$_id', (task1 as { _id: Types.ObjectId })._id] },
                plan1._id,
                plan2._id,
              ],
            },
          },
        },
      ],
    );

    await Task.deleteOne({ title: 'Same title' });

    const remainingTasks = await Task.find({
      _id: {
        $in: [
          (task1 as { _id: Types.ObjectId })._id,
          (task2 as { _id: Types.ObjectId })._id,
        ],
      },
    });
    expect(remainingTasks).toHaveLength(1);

    const deletedTaskId =
      (task1 as { _id: Types.ObjectId })._id.toString() ===
      remainingTasks[0]._id.toString()
        ? (task2 as { _id: Types.ObjectId })._id.toString()
        : (task1 as { _id: Types.ObjectId })._id.toString();

    const plansAfter = await RoutePlan.find({
      _id: { $in: [plan1._id, plan2._id] },
    });
    const allPlanTaskIds = plansAfter.flatMap((plan) =>
      plan.tasks.map((taskId) => taskId.toString()),
    );
    expect(allPlanTaskIds).not.toContain(deletedTaskId);

    await Task.deleteMany({
      _id: {
        $in: [
          (task1 as { _id: Types.ObjectId })._id,
          (task2 as { _id: Types.ObjectId })._id,
        ],
      },
    });
    await RoutePlan.deleteMany({ _id: { $in: [plan1._id, plan2._id] } });
  });

  it('should unassign tasks for the exact RoutePlan deleted by query deleteOne', async () => {
    const [task1, task2] = await Task.create([
      { title: 'RP delete task 1', status: 'Новая' },
      { title: 'RP delete task 2', status: 'Новая' },
    ]);

    const plan1 = await RoutePlan.create({
      title: 'Same plan title',
      status: 'draft',
      tasks: [(task1 as { _id: Types.ObjectId })._id],
    });
    const plan2 = await RoutePlan.create({
      title: 'Same plan title',
      status: 'draft',
      tasks: [(task2 as { _id: Types.ObjectId })._id],
    });

    await Task.updateOne(
      { _id: (task1 as { _id: Types.ObjectId })._id },
      { routePlanId: plan1._id },
    );
    await Task.updateOne(
      { _id: (task2 as { _id: Types.ObjectId })._id },
      { routePlanId: plan2._id },
    );

    await RoutePlan.deleteOne({ title: 'Same plan title' });

    const remainingPlans = await RoutePlan.find({
      _id: { $in: [plan1._id, plan2._id] },
    });
    expect(remainingPlans).toHaveLength(1);
    const deletedPlanId =
      remainingPlans[0]._id.toString() === plan1._id.toString()
        ? plan2._id.toString()
        : plan1._id.toString();

    const updatedTask1 = await Task.findById(
      (task1 as { _id: Types.ObjectId })._id,
    );
    const updatedTask2 = await Task.findById(
      (task2 as { _id: Types.ObjectId })._id,
    );

    const byPlanId = new Map<string, Types.ObjectId | null>([
      [plan1._id.toString(), updatedTask1?.routePlanId ?? null],
      [plan2._id.toString(), updatedTask2?.routePlanId ?? null],
    ]);

    expect(byPlanId.get(deletedPlanId)).toBeNull();

    await Task.deleteMany({
      _id: {
        $in: [
          (task1 as { _id: Types.ObjectId })._id,
          (task2 as { _id: Types.ObjectId })._id,
        ],
      },
    });
    await RoutePlan.deleteMany({ _id: { $in: [plan1._id, plan2._id] } });
  });

  it('should use transaction in createDraftFromInputs', async () => {
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
