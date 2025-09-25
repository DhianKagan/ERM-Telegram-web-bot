// Назначение: проверка CRUD-роутов автопарка
// Основные модули: express, supertest, mongodb-memory-server
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 'secret';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

jest.setTimeout(30_000);

import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fleetsRouter from '../src/routes/fleets';
import { FleetVehicle } from '../src/db/models/fleet';

jest.mock('../src/utils/rateLimiter', () => () => (_req: any, _res: any, next: () => void) => next());
jest.mock('../src/middleware/auth', () => () => (_req: any, _res: any, next: () => void) => next());
jest.mock('../src/auth/roles.guard', () => (_req: any, _res: any, next: () => void) => next());
jest.mock('../src/auth/roles.decorator', () => ({ Roles: () => () => undefined }));

let mongod: MongoMemoryServer;
let app: express.Express;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = express();
  app.use('/api/v1/fleets', fleetsRouter);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await FleetVehicle.deleteMany({});
});

describe('fleets router', () => {
  const payload = {
    name: 'Газель',
    registrationNumber: 'AA 1234 BB',
    odometerInitial: 1000,
    odometerCurrent: 1200,
    mileageTotal: 200,
    fuelType: 'Бензин' as const,
    fuelRefilled: 50,
    fuelAverageConsumption: 0.25,
    fuelSpentTotal: 40,
    currentTasks: [] as string[],
  };

  it('создаёт транспорт', async () => {
    const res = await request(app).post('/api/v1/fleets').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Газель');
    expect(res.body.registrationNumber).toBe('AA 1234 BB');
    const stored = await FleetVehicle.findById(res.body.id).lean();
    expect(stored?.fuelType).toBe('Бензин');
  });

  it('обновляет транспорт', async () => {
    const created = await FleetVehicle.create(payload);
    const res = await request(app)
      .put(`/api/v1/fleets/${created._id}`)
      .send({ odometerCurrent: 1300, fuelType: 'Дизель' });
    expect(res.status).toBe(200);
    expect(res.body.odometerCurrent).toBe(1300);
    expect(res.body.fuelType).toBe('Дизель');
  });

  it('удаляет транспорт', async () => {
    const created = await FleetVehicle.create(payload);
    const res = await request(app).delete(`/api/v1/fleets/${created._id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    const exists = await FleetVehicle.findById(created._id);
    expect(exists).toBeNull();
  });

  it('фильтрует список по поиску', async () => {
    await FleetVehicle.deleteMany({});
    await FleetVehicle.create({ ...payload, name: 'Газель 1', registrationNumber: 'AA 1111 BB' });
    await FleetVehicle.create({ ...payload, name: 'Манипулятор', registrationNumber: 'CC 2222 DD' });
    const res = await request(app).get('/api/v1/fleets?search=Манипулятор');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe('Манипулятор');
  });
});
