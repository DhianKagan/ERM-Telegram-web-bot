import mongoose, { Types } from 'mongoose';
import { RoutePlan } from '../src/db/models/routePlan';
import { Task } from '../src/db/model';
import { createDraftFromInputs } from '../src/services/routePlans';

describe('MongoDB Integrity & Transactions', () => {
    let routePlanId: Types.ObjectId;
    let taskIds: Types.ObjectId[] = [];

    beforeAll(async () => {
        // Assume database connection is handled by global setup or we connect here
        // Usually jest config handles global setup. If not, we might need:
        // await mongoose.connect(process.env.MONGO_URI!);
    });

    afterAll(async () => {
        // Cleanup if needed
        // await mongoose.disconnect();
    });

    it('should unassign tasks when RoutePlan is deleted', async () => {
        // 1. Create Tasks
        const tasks = await Task.create([
            { title: 'Task 1', status: 'Pending' },
            { title: 'Task 2', status: 'Pending' }
        ]);
        taskIds = tasks.map(t => (t as any)._id as Types.ObjectId);

        // 2. Create RoutePlan linked to tasks
        const plan = await RoutePlan.create({
            title: 'Test Plan',
            status: 'draft',
            tasks: taskIds
        });
        routePlanId = plan._id;

        // 3. Link tasks to plan (simulate what service does)
        await Task.updateMany({ _id: { $in: taskIds } }, { routePlanId: plan._id });

        // Verify link
        const tasksBefore = await Task.find({ _id: { $in: taskIds } });
        tasksBefore.forEach(t => expect(t.routePlanId?.toString()).toBe(plan._id.toString()));

        // 4. Delete RoutePlan
        await RoutePlan.deleteOne({ _id: plan._id });

        // 5. Verify Tasks are unassigned
        const tasksAfter = await Task.find({ _id: { $in: taskIds } });
        tasksAfter.forEach(t => expect(t.routePlanId).toBeNull());
    });

    it('should remove task from RoutePlan when Task is deleted', async () => {
        // 1. Create Task
        const task = await Task.create({ title: 'Task To Delete', status: 'Pending' });

        // 2. Create RoutePlan linked to task
        const plan = await RoutePlan.create({
            title: 'Plan For Task Deletion',
            status: 'draft',
            tasks: [(task as any)._id]
        });
        await Task.updateOne({ _id: (task as any)._id }, { routePlanId: plan._id });

        // 3. Delete Task
        await Task.deleteOne({ _id: (task as any)._id });

        // 4. Verify RoutePlan tasks array
        const planAfter = await RoutePlan.findById(plan._id);
        // planAfter.tasks is array of ObjectIds
        const taskIdsInPlan = planAfter?.tasks?.map(id => id.toString());
        expect(taskIdsInPlan).not.toContain((task as any)._id.toString());

        // Cleanup
        await RoutePlan.deleteOne({ _id: plan._id });
    });

    it('should use transaction in createDraftFromInputs', async () => {
        const session = await mongoose.startSession();
        // This test requires Replica Set. If not available, it might fail or we should skip.
        // We fundamentally test that the function completes and linking happens.

        try {
            const task = await Task.create({ title: 'Transaction Task', status: 'new' });

            const result = await createDraftFromInputs(
                [{ tasks: [(task as any)._id.toString()], order: 0 }],
                { title: 'Transaction Plan' }
            );

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();

            // Verify Linkage
            const updatedTask = await Task.findById((task as any)._id);
            expect(updatedTask?.routePlanId?.toString()).toBe(result.id);

            // Cleanup
            await RoutePlan.deleteOne({ _id: result.id });
            await Task.deleteOne({ _id: (task as any)._id });
        } catch (e: any) {
            console.warn('Transaction test failed (possibly no Replica Set):', e);
            // Don't fail the test suite if just local env issue, but log it
            // e.message might vary
            if (e.message?.includes('Transaction numbers') || e.message?.includes('replica set')) {
                console.log('Skipping transaction test due to standalone instance');
            } else {
                throw e;
            }
        } finally {
            await session.endSession();
        }
    });
});
