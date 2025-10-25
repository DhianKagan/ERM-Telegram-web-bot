/**
 * Назначение файла: интеграционные тесты сервиса маршрутных планов и метрик.
 * Основные модули: mongoose, MongoMemoryServer, services/routePlans.
 */

import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { strict as assert } from 'assert';

declare const describe: (
  name: string,
  suite: (this: unknown) => void,
) => void;

declare const it: (
  name: string,
  test: (this: unknown) => unknown | Promise<unknown>,
) => void;

declare const before: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;

declare const after: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;

declare const afterEach: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;

describe('routePlans service analytics', function () {
  const suite = this as { timeout?: (ms: number) => void };
  suite.timeout?.(60000);

  let mongod: MongoMemoryServer;
  let Task: typeof import('../../apps/api/src/db/model').Task;
  let RoutePlan: typeof import('../../apps/api/src/db/models/routePlan').RoutePlan;
  let createDraftFromInputs: typeof import('../../apps/api/src/services/routePlans').createDraftFromInputs;
  let getPlan: typeof import('../../apps/api/src/services/routePlans').getPlan;
  let listPlans: typeof import('../../apps/api/src/services/routePlans').listPlans;

  before(async function () {
    const hook = this as { timeout?: (ms: number) => void };
    hook.timeout?.(60000);
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGO_DATABASE_URL = uri;
    await mongoose.connect(uri);

    const models = await import('../../apps/api/src/db/model');
    Task = models.Task;
    ({ RoutePlan } = await import('../../apps/api/src/db/models/routePlan'));
    const services = await import('../../apps/api/src/services/routePlans');
    createDraftFromInputs = services.createDraftFromInputs;
    getPlan = services.getPlan;
    listPlans = services.listPlans;
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  afterEach(async () => {
    await RoutePlan.deleteMany({});
    await Task.deleteMany({});
  });

  it('добавляет к остановкам ETA, загрузку и задержку и возвращает их через API', async () => {
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
    assert.ok(typeof dropoff.delayMinutes === 'number' && dropoff.delayMinutes > 0);
    assert.ok(typeof dropoff.etaMinutes === 'number' && dropoff.etaMinutes > pickup.etaMinutes!);
    assert.equal(plan.metrics.totalLoad, 12.3);
    assert.equal(plan.metrics.totalRoutes, 1);
    assert.ok(plan.metrics.totalEtaMinutes && plan.metrics.totalEtaMinutes >= dropoff.etaMinutes!);

    const stored = await getPlan(plan.id);
    assert.ok(stored);
    assert.equal(stored?.metrics.totalLoad, 12.3);
    assert.equal(stored?.routes[0]?.stops[1]?.delayMinutes, dropoff.delayMinutes);

    const listed = await listPlans();
    assert.equal(listed.total, 1);
    assert.equal(listed.items[0]?.metrics.totalLoad, 12.3);
    assert.equal(listed.items[0]?.routes[0]?.stops[1]?.delayMinutes, dropoff.delayMinutes);
  });
});
