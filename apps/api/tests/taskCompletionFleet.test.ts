// Назначение: интеграционные тесты завершения задач с автопарком.
// Основные модули: mongodb-memory-server, mongoose, tasks.service, db/models.
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 'secret';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost:27017/ermdb?authSource=admin';
process.env.APP_URL = 'https://localhost';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { URL: NodeURL } = require('url');
(globalThis as unknown as { URL: typeof NodeURL }).URL = NodeURL;

jest.mock('../src/config', () => ({
  __esModule: true,
  default: {
    botToken: 'test-bot-token',
    chatId: 0,
    jwtSecret: 'test-secret',
    mongoUrl: 'mongodb://localhost:27017/ermdb',
    appUrl: 'https://localhost',
    port: 3000,
    locale: 'ru',
    routingUrl: 'https://localhost:8000/route',
    graphhopper: { matrixUrl: undefined, apiKey: undefined, profile: 'car' },
    cookieDomain: undefined,
    vrpOrToolsEnabled: false,
  },
  port: 3000,
  locale: 'ru',
  routingUrl: 'https://localhost:8000/route',
  graphhopperConfig: { matrixUrl: undefined, apiKey: undefined, profile: 'car' },
  cookieDomain: undefined,
}));

jest.setTimeout(120_000);

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import TasksService from '../src/tasks/tasks.service';
import queries from '../src/db/queries';
import { Task } from '../src/db/model';
import { FleetVehicle } from '../src/db/models/fleet';

jest.mock('../src/services/route', () => ({
  getRouteDistance: jest.fn(),
  clearRouteCache: jest.fn(),
}));

jest.mock('../src/services/taskLinks', () => ({
  ensureTaskLinksShort: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/logisticsEvents', () => ({
  notifyTasksChanged: jest.fn(),
}));

jest.mock('../src/services/wgLogEngine', () => ({
  writeLog: jest.fn().mockResolvedValue(undefined),
}));

describe('завершение задач с транспортом', () => {
  let mongod: MongoMemoryServer;
  let service: TasksService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    service = new TasksService({
      createTask: queries.createTask,
      getTasks: queries.getTasks,
      getTask: queries.getTask,
      updateTask: queries.updateTask,
      addTime: queries.addTime,
      bulkUpdate: queries.bulkUpdate,
      summary: queries.summary,
      deleteTask: queries.deleteTask,
      listMentionedTasks: queries.listMentionedTasks,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  afterEach(async () => {
    await Promise.all([Task.deleteMany({}), FleetVehicle.deleteMany({})]);
  });

  it('увеличивает показатели автопарка при завершении задачи', async () => {
    const vehicle = await FleetVehicle.create({
      name: 'Газель',
      registrationNumber: 'AA 1234 BB',
      odometerInitial: 1_000,
      odometerCurrent: 1_200,
      mileageTotal: 200,
      transportType: 'Грузовой',
      fuelType: 'Бензин',
      fuelRefilled: 50,
      fuelAverageConsumption: 0.25,
      fuelSpentTotal: 40,
      currentTasks: [],
    });

    const executorId = 101;
    const task = await Task.create({
      title: 'Доставка',
      status: 'В работе',
      created_by: executorId,
      assigned_user_id: executorId,
      assignees: [executorId],
      transport_type: 'Грузовой',
      transport_vehicle_id: vehicle._id,
      transport_vehicle_name: vehicle.name,
      transport_vehicle_registration: vehicle.registrationNumber,
      transport_driver_id: 9001,
      route_distance_km: 12.5,
      history: [],
    });

    await service.update(String(task._id), { status: 'Выполнена' }, executorId);

    const updatedVehicle = await FleetVehicle.findById(vehicle._id).lean();
    expect(updatedVehicle?.odometerCurrent).toBeCloseTo(1_212.5, 3);
    expect(updatedVehicle?.mileageTotal).toBeCloseTo(212.5, 3);
    expect(updatedVehicle?.fuelSpentTotal).toBeCloseTo(43.125, 3);
  });

  it('не меняет показатели без дистанции маршрута', async () => {
    const vehicle = await FleetVehicle.create({
      name: 'Манипулятор',
      registrationNumber: 'CC 2222 DD',
      odometerInitial: 500,
      odometerCurrent: 600,
      mileageTotal: 100,
      transportType: 'Легковой',
      fuelType: 'Дизель',
      fuelRefilled: 20,
      fuelAverageConsumption: 0.2,
      fuelSpentTotal: 30,
      currentTasks: [],
    });

    const executorId = 77;
    const task = await Task.create({
      title: 'Курьер',
      status: 'В работе',
      created_by: executorId,
      assigned_user_id: executorId,
      assignees: [executorId],
      transport_type: 'Легковой',
      transport_vehicle_id: vehicle._id,
      transport_vehicle_name: vehicle.name,
      transport_vehicle_registration: vehicle.registrationNumber,
      transport_driver_id: 555,
      history: [],
    });

    await service.update(String(task._id), { status: 'Выполнена' }, executorId);

    const updatedVehicle = await FleetVehicle.findById(vehicle._id).lean();
    expect(updatedVehicle?.odometerCurrent).toBe(600);
    expect(updatedVehicle?.mileageTotal).toBe(100);
    expect(updatedVehicle?.fuelSpentTotal).toBe(30);
  });
});

