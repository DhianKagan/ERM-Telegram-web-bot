/**
 * Назначение файла: интеграционные тесты сервиса маршрутных планов и метрик.
 * Основные модули: mongoose, services/routePlans.
 */

import mongoose, { Types } from 'mongoose';
import { strict as assert } from 'assert';
import type {
  LogisticsEvent,
  LogisticsRoutePlanRemovedEvent,
  LogisticsRoutePlanUpdatedEvent,
} from '../../packages/shared/src/types';

declare const describe: (name: string, suite: (this: unknown) => void) => void;

declare const it: (
  name: string,
  test: (this: unknown) => unknown | Promise<unknown>,
) => void;

declare const beforeAll: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;

declare const afterAll: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;

declare const afterEach: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;

describe('routePlans service analytics', function () {
  let skipSuite = false;

  let Task: typeof import('../../apps/api/src/db/model').Task;
  let RoutePlan: typeof import('../../apps/api/src/db/models/routePlan').RoutePlan;
  let createDraftFromInputs: typeof import('../../apps/api/src/services/routePlans').createDraftFromInputs;
  let getPlan: typeof import('../../apps/api/src/services/routePlans').getPlan;
  let listPlans: typeof import('../../apps/api/src/services/routePlans').listPlans;
  let updatePlan: typeof import('../../apps/api/src/services/routePlans').updatePlan;
  let updatePlanStatus: typeof import('../../apps/api/src/services/routePlans').updatePlanStatus;
  let removePlan: typeof import('../../apps/api/src/services/routePlans').removePlan;
  let subscribeLogisticsEvents: typeof import('../../apps/api/src/services/logisticsEvents').subscribeLogisticsEvents;

  beforeAll(async function () {
    const uri = process.env.MONGO_DATABASE_URL;
    if (!uri) {
      skipSuite = true;
      console.warn('MONGO_DATABASE_URL не задан для routePlans.service.spec');
      return;
    }
    const normalizedUri = uri.endsWith('/') ? uri : `${uri}/`;
    process.env.MONGO_DATABASE_URL = `${normalizedUri}ermdb`;
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    } catch (error) {
      skipSuite = true;
      console.warn('MongoDB недоступна, пропускаем suite', { error });
      return;
    }

    const models = await import('../../apps/api/src/db/model');
    Task = models.Task;
    ({ RoutePlan } = await import('../../apps/api/src/db/models/routePlan'));
    const services = await import('../../apps/api/src/services/routePlans');
    createDraftFromInputs = services.createDraftFromInputs;
    getPlan = services.getPlan;
    listPlans = services.listPlans;
    updatePlan = services.updatePlan;
    updatePlanStatus = services.updatePlanStatus;
    removePlan = services.removePlan;
    ({ subscribeLogisticsEvents } = await import(
      '../../apps/api/src/services/logisticsEvents'
    ));
  }, 60000);

  afterAll(async () => {
    if (skipSuite) return;
    await mongoose.disconnect();
  }, 60000);

  afterEach(async () => {
    if (skipSuite) return;
    await RoutePlan.deleteMany({});
    await Task.deleteMany({});
  });

  it('добавляет к остановкам ETA, загрузку и задержку и возвращает их через API', async () => {
    if (skipSuite) return;
    const task = await Task.create({
      title: 'Доставка оборудования',
      request_id: 'REQ-1',
      task_number: 'REQ-1',
      created_by: 1,
      status: 'Новая',
      start_location: 'Київ',
      end_location: 'Львів',
      startCoordinates: { lat: 50.45, lng: 30.523 },
      finishCoordinates: { lat: 50.9, lng: 24.7 },
      route_distance_km: 540,
      cargo_weight_kg: 12.3,
      delivery_window_start: new Date('2024-01-01T06:00:00.000Z'),
      delivery_window_end: new Date('2024-01-01T07:00:00.000Z'),
    });

    const taskId = (task._id as Types.ObjectId).toHexString();

    const plan = await createDraftFromInputs([
      {
        tasks: [taskId],
      },
    ]);

    assert.equal(plan.routes.length, 1);
    assert.equal(plan.tasks.length, 1);
    const [route] = plan.routes;
    assert.ok(route.metrics);
    assert.equal(route.metrics?.load, 12.3);
    assert.ok(route.metrics?.etaMinutes && route.metrics.etaMinutes > 0);
    const [pickup, dropoff] = route.stops;
    assert.ok(pickup);
    assert.ok(dropoff);
    assert.equal(pickup.kind, 'start');
    assert.equal(dropoff.kind, 'finish');
    assert.equal(pickup.load, 12.3);
    assert.equal(dropoff.load, 0);
    assert.equal(pickup.windowStartMinutes, 480);
    assert.equal(dropoff.windowEndMinutes, 540);
    assert.ok(
      typeof dropoff.delayMinutes === 'number' && dropoff.delayMinutes > 0,
    );
    assert.ok(
      typeof dropoff.etaMinutes === 'number' &&
        dropoff.etaMinutes > pickup.etaMinutes!,
    );
    assert.equal(plan.metrics.totalLoad, 12.3);
    assert.equal(plan.metrics.totalRoutes, 1);
    assert.ok(
      plan.metrics.totalEtaMinutes &&
        plan.metrics.totalEtaMinutes >= dropoff.etaMinutes!,
    );

    const stored = await getPlan(plan.id);
    assert.ok(stored);
    assert.equal(stored?.metrics.totalLoad, 12.3);
    assert.equal(
      stored?.routes[0]?.stops[1]?.delayMinutes,
      dropoff.delayMinutes,
    );

    const listed = await listPlans();
    assert.equal(listed.total, 1);
    assert.equal(listed.items[0]?.metrics.totalLoad, 12.3);
    assert.equal(
      listed.items[0]?.routes[0]?.stops[1]?.delayMinutes,
      dropoff.delayMinutes,
    );
  });

  it('публикует событие при создании маршрутного плана', async () => {
    if (skipSuite) return;
    const events: LogisticsEvent[] = [];
    const unsubscribe = subscribeLogisticsEvents((event) => {
      events.push(event);
    });

    try {
      await createDraftFromInputs([
        {
          tasks: [],
        },
      ]);
    } finally {
      unsubscribe();
    }

    const message = events.find(
      (event): event is LogisticsRoutePlanUpdatedEvent =>
        event.type === 'route-plan.updated',
    );
    assert.ok(message, 'ожидалось событие создания маршрутного плана');
    assert.equal(message.reason, 'created');
  });

  it('публикует событие при обновлении маршрутного плана', async () => {
    if (skipSuite) return;
    const plan = await createDraftFromInputs([
      {
        tasks: [],
      },
    ]);

    const events: LogisticsEvent[] = [];
    const unsubscribe = subscribeLogisticsEvents((event) => {
      events.push(event);
    });

    try {
      const updated = await updatePlan(plan.id, { title: 'Обновлённый план' });
      assert.ok(updated);
      assert.equal(updated.title, 'Обновлённый план');
    } finally {
      unsubscribe();
    }

    const message = events.find(
      (event): event is LogisticsRoutePlanUpdatedEvent =>
        event.type === 'route-plan.updated',
    );
    assert.ok(message, 'ожидалось событие обновления плана');
    assert.equal(message.reason, 'updated');
    assert.equal(message.plan.id, plan.id);
    assert.equal(message.plan.title, 'Обновлённый план');
  });

  it('публикует событие при смене статуса маршрутного плана', async () => {
    if (skipSuite) return;
    const plan = await createDraftFromInputs([
      {
        tasks: [],
      },
    ]);

    const events: LogisticsEvent[] = [];
    const unsubscribe = subscribeLogisticsEvents((event) => {
      events.push(event);
    });

    try {
      const updated = await updatePlanStatus(plan.id, 'approved', 401);
      assert.ok(updated);
      assert.equal(updated.status, 'approved');
    } finally {
      unsubscribe();
    }

    const message = events.find(
      (event): event is LogisticsRoutePlanUpdatedEvent =>
        event.type === 'route-plan.updated',
    );
    assert.ok(message, 'ожидалось событие обновления плана при смене статуса');
    assert.equal(message.reason, 'updated');
    assert.equal(message.plan.id, plan.id);
    assert.equal(message.plan.status, 'approved');
  });

  it('сохраняет дополнительные поля и связывает задачи с маршрутным планом', async () => {
    if (skipSuite) return;
    const taskA = await Task.create({
      title: 'Погрузка',
      status: 'Новая',
    });
    const taskB = await Task.create({
      title: 'Разгрузка',
      status: 'Новая',
    });

    const taskAId = (taskA._id as Types.ObjectId).toHexString();
    const taskBId = (taskB._id as Types.ObjectId).toHexString();
    const pointId = new Types.ObjectId().toHexString();
    const transportId = new Types.ObjectId().toHexString();

    const plan = await createDraftFromInputs([], {
      creatorId: 11,
      executorId: 22,
      companyPointIds: [pointId],
      transportId,
      transportName: 'Фургон',
      tasks: [taskAId],
    });

    assert.equal(plan.creatorId, 11);
    assert.equal(plan.executorId, 22);
    assert.deepEqual(plan.companyPointIds, [pointId]);
    assert.equal(plan.transportId, transportId);
    assert.equal(plan.transportName, 'Фургон');
    assert.deepEqual(plan.tasks, [taskAId]);

    const storedTaskA = await Task.findById(taskAId);
    assert.ok(storedTaskA?.routePlanId);
    assert.equal(
      (storedTaskA?.routePlanId as Types.ObjectId).toHexString(),
      plan.id,
    );

    const updated = await updatePlan(plan.id, {
      executorId: 33,
      transportName: null,
      companyPointIds: [],
      tasks: [taskBId],
    });

    assert.ok(updated);
    assert.equal(updated?.executorId, 33);
    assert.equal(updated?.transportName, null);
    assert.deepEqual(updated?.companyPointIds, []);
    assert.deepEqual(updated?.tasks, [taskBId]);

    const refreshedTaskA = await Task.findById(taskAId);
    const refreshedTaskB = await Task.findById(taskBId);
    assert.equal(refreshedTaskA?.routePlanId ?? null, null);
    assert.ok(refreshedTaskB?.routePlanId);
    assert.equal(
      (refreshedTaskB?.routePlanId as Types.ObjectId).toHexString(),
      plan.id,
    );
  });

  it('запрещает добавлять задачу во второй активный маршрутный лист', async () => {
    if (skipSuite) return;
    const task = await Task.create({
      title: 'Контрольная задача',
      status: 'Новая',
    });
    const taskId = (task._id as Types.ObjectId).toHexString();

    await createDraftFromInputs(
      [
        {
          tasks: [taskId],
        },
      ],
      { title: 'Первый лист' },
    );

    await assert.rejects(
      () =>
        createDraftFromInputs(
          [
            {
              tasks: [taskId],
            },
          ],
          { title: 'Второй лист' },
        ),
      /Нельзя добавить задачи в другой маршрутный лист/,
    );
  });

  it('после отмены листа задача может быть назначена в новый маршрутный лист', async () => {
    if (skipSuite) return;
    const task = await Task.create({
      title: 'Задача для отмены',
      status: 'Новая',
    });
    const taskId = (task._id as Types.ObjectId).toHexString();

    const plan = await createDraftFromInputs([
      {
        tasks: [taskId],
      },
    ]);

    const cancelled = await updatePlanStatus(plan.id, 'cancelled', 401);
    assert.ok(cancelled);
    assert.equal(cancelled?.status, 'cancelled');

    const detachedTask = await Task.findById(taskId);
    assert.equal(detachedTask?.routePlanId ?? null, null);

    const nextPlan = await createDraftFromInputs([
      {
        tasks: [taskId],
      },
    ]);

    assert.equal(nextPlan.tasks.length, 1);
    assert.equal(nextPlan.tasks[0], taskId);
  });

  it('после принятия в работу запрещает менять состав задач', async () => {
    if (skipSuite) return;
    const firstTask = await Task.create({
      title: 'Первая задача',
      status: 'Новая',
    });
    const secondTask = await Task.create({
      title: 'Вторая задача',
      status: 'Новая',
    });

    const firstTaskId = (firstTask._id as Types.ObjectId).toHexString();
    const secondTaskId = (secondTask._id as Types.ObjectId).toHexString();

    const plan = await createDraftFromInputs([
      {
        tasks: [firstTaskId],
      },
    ]);

    const approved = await updatePlanStatus(plan.id, 'approved', 401);
    assert.ok(approved);
    assert.equal(approved?.status, 'approved');

    await assert.rejects(
      () =>
        updatePlan(plan.id, {
          tasks: [secondTaskId],
        }),
      /После принятия в работу маршрутный лист нельзя изменять/,
    );
  });

  it('разрешает менять метаданные у плана не в draft, если tasks не меняется', async () => {
    if (skipSuite) return;
    const task = await Task.create({
      title: 'Задача без изменений',
      status: 'Новая',
    });
    const taskId = (task._id as Types.ObjectId).toHexString();

    const plan = await createDraftFromInputs([
      {
        tasks: [taskId],
      },
    ]);

    const approved = await updatePlanStatus(plan.id, 'approved', 401);
    assert.ok(approved);
    assert.equal(approved?.status, 'approved');

    const updated = await updatePlan(plan.id, {
      title: 'Обновлённое название',
      notes: 'Обновлённые заметки',
      tasks: [taskId],
    });

    assert.ok(updated);
    assert.equal(updated?.title, 'Обновлённое название');
    assert.equal(updated?.notes, 'Обновлённые заметки');
    assert.deepEqual(updated?.tasks, [taskId]);
  });

  it('в draft не перестраивает существующие routes, когда приходит только tasks', async () => {
    if (skipSuite) return;
    const firstTask = await Task.create({
      title: 'Первая задача',
      status: 'Новая',
    });
    const secondTask = await Task.create({
      title: 'Вторая задача',
      status: 'Новая',
    });
    const firstTaskId = (firstTask._id as Types.ObjectId).toHexString();
    const secondTaskId = (secondTask._id as Types.ObjectId).toHexString();

    const plan = await createDraftFromInputs([
      {
        order: 0,
        vehicleName: 'Фургон 1',
        notes: 'Маршрут 1',
        tasks: [firstTaskId],
      },
      {
        order: 1,
        vehicleName: 'Фургон 2',
        notes: 'Маршрут 2',
        tasks: [secondTaskId],
      },
    ]);

    assert.equal(plan.routes.length, 2);

    const updated = await updatePlan(plan.id, {
      title: 'Черновик без изменения маршрутов',
      tasks: [firstTaskId, secondTaskId],
    });

    assert.ok(updated);
    assert.equal(updated?.routes.length, 2);
    assert.equal(updated?.routes[0]?.vehicleName, 'Фургон 1');
    assert.equal(updated?.routes[0]?.notes, 'Маршрут 1');
    assert.equal(updated?.routes[1]?.vehicleName, 'Фургон 2');
    assert.equal(updated?.routes[1]?.notes, 'Маршрут 2');
  });

  it('в draft синхронизирует состав routes при tasks-only обновлении', async () => {
    if (skipSuite) return;
    const firstTask = await Task.create({
      title: 'Синхронизация 1',
      status: 'Новая',
    });
    const secondTask = await Task.create({
      title: 'Синхронизация 2',
      status: 'Новая',
    });
    const thirdTask = await Task.create({
      title: 'Синхронизация 3',
      status: 'Новая',
    });

    const firstTaskId = (firstTask._id as Types.ObjectId).toHexString();
    const secondTaskId = (secondTask._id as Types.ObjectId).toHexString();
    const thirdTaskId = (thirdTask._id as Types.ObjectId).toHexString();

    const plan = await createDraftFromInputs([
      {
        order: 0,
        vehicleName: 'Фургон 1',
        tasks: [firstTaskId],
      },
      {
        order: 1,
        vehicleName: 'Фургон 2',
        tasks: [secondTaskId],
      },
    ]);

    const updated = await updatePlan(plan.id, {
      tasks: [firstTaskId, thirdTaskId],
    });

    assert.ok(updated);
    assert.deepEqual(updated?.tasks, [firstTaskId, thirdTaskId]);
    const routeTaskIds = (updated?.routes ?? []).flatMap((route) =>
      route.tasks.map((task) => task.taskId),
    );
    assert.deepEqual(routeTaskIds.sort(), [firstTaskId, thirdTaskId].sort());
    assert.equal(updated?.metrics.totalTasks, 2);

    const detachedTask = await Task.findById(secondTaskId);
    assert.equal(detachedTask?.routePlanId ?? null, null);
  });

  it('при отмене не очищает routePlanId у задач, уже переназначенных в другой лист', async () => {
    if (skipSuite) return;
    const task = await Task.create({
      title: 'Задача для гонки отмены',
      status: 'Новая',
    });
    const taskId = (task._id as Types.ObjectId).toHexString();

    const sourcePlan = await createDraftFromInputs([
      {
        tasks: [taskId],
      },
    ]);
    const targetPlan = await createDraftFromInputs([
      {
        tasks: [],
      },
    ]);

    await Task.updateOne(
      { _id: task._id },
      { $set: { routePlanId: new Types.ObjectId(targetPlan.id) } },
    );

    const cancelled = await updatePlanStatus(sourcePlan.id, 'cancelled', 401);
    assert.ok(cancelled);
    assert.equal(cancelled?.status, 'cancelled');

    const refreshed = await Task.findById(taskId);
    assert.ok(refreshed?.routePlanId);
    assert.equal(
      (refreshed?.routePlanId as Types.ObjectId).toHexString(),
      targetPlan.id,
    );
  });

  it('публикует событие при удалении маршрутного плана', async () => {
    if (skipSuite) return;
    const plan = await createDraftFromInputs([
      {
        tasks: [],
      },
    ]);

    const events: LogisticsEvent[] = [];
    const unsubscribe = subscribeLogisticsEvents((event) => {
      events.push(event);
    });

    try {
      const removed = await removePlan(plan.id);
      assert.equal(removed, true);
    } finally {
      unsubscribe();
    }

    const message = events.find(
      (event): event is LogisticsRoutePlanRemovedEvent =>
        event.type === 'route-plan.removed',
    );
    assert.ok(message, 'ожидалось событие удаления плана');
    assert.equal(message.planId, plan.id);
  });
});
