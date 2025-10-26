// Назначение: проверка агрегирующего эндпойнта аналитики маршрутных планов.
// Основные модули: jest, supertest, mongodb-memory-server
import type { NextFunction } from 'express';

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'token';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 'secret';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import analyticsRouter from '../src/routes/analytics';
import { RoutePlan } from '../src/db/models/routePlan';

jest.mock(
  '../src/middleware/auth',
  () => () => (_req: unknown, _res: unknown, next: NextFunction) => next(),
);
jest.mock(
  '../src/utils/rateLimiter',
  () => () => (_req: unknown, _res: unknown, next: NextFunction) => next(),
);

let mongod: MongoMemoryServer;
let app: express.Express;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = express();
  app.use(express.json());
  app.use('/api/v1/analytics', analyticsRouter);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await RoutePlan.deleteMany({});

  const firstTaskId = new mongoose.Types.ObjectId();
  const secondTaskId = new mongoose.Types.ObjectId();

  await RoutePlan.create({
    title: 'Городская доставка',
    status: 'completed',
    completedAt: new Date('2024-10-10T08:00:00Z'),
    metrics: {
      totalDistanceKm: 120.5,
      totalRoutes: 1,
      totalTasks: 2,
      totalStops: 2,
      totalEtaMinutes: 360,
      totalLoad: 3.5,
    },
    routes: [
      {
        order: 0,
        vehicleId: new mongoose.Types.ObjectId(),
        vehicleName: 'Грузовик-1',
        driverId: 101,
        driverName: 'Иван',
        metrics: {
          distanceKm: 120.5,
          load: 3.5,
          etaMinutes: 360,
          tasks: 2,
          stops: 2,
        },
        tasks: [
          {
            taskId: firstTaskId,
            order: 0,
            title: 'Забрать груз',
            start: { lat: 50.45, lng: 30.52 },
            finish: { lat: 50.5, lng: 30.6 },
            startAddress: 'Склад А',
            finishAddress: 'Клиент Б',
            distanceKm: 60.2,
            windowStart: null,
            windowEnd: null,
            cargoWeightKg: 2.5,
          },
          {
            taskId: secondTaskId,
            order: 1,
            title: 'Доставить груз',
            start: { lat: 50.5, lng: 30.6 },
            finish: { lat: 50.6, lng: 30.7 },
            startAddress: 'Клиент Б',
            finishAddress: 'Клиент В',
            distanceKm: 60.3,
            windowStart: null,
            windowEnd: null,
            cargoWeightKg: 1.0,
          },
        ],
        stops: [
          {
            order: 0,
            kind: 'start',
            taskId: firstTaskId,
            coordinates: { lat: 50.45, lng: 30.52 },
            address: 'Склад А',
            etaMinutes: 5,
            load: 1.5,
            delayMinutes: 0,
          },
          {
            order: 1,
            kind: 'finish',
            taskId: firstTaskId,
            coordinates: { lat: 50.5, lng: 30.6 },
            address: 'Клиент Б',
            etaMinutes: 120,
            load: 0,
            delayMinutes: null,
          },
        ],
      },
    ],
    tasks: [firstTaskId, secondTaskId],
  });

  await RoutePlan.create({
    title: 'Пригородная доставка',
    status: 'completed',
    completedAt: new Date('2024-10-09T10:00:00Z'),
    metrics: {
      totalDistanceKm: 40.2,
      totalRoutes: 1,
      totalTasks: 1,
      totalStops: 1,
      totalEtaMinutes: 180,
      totalLoad: 2.1,
    },
    routes: [
      {
        order: 0,
        vehicleId: new mongoose.Types.ObjectId(),
        vehicleName: 'Фургон',
        driverId: 102,
        driverName: 'Пётр',
        metrics: {
          distanceKm: 40.2,
          load: 2.1,
          etaMinutes: 180,
          tasks: 1,
          stops: 2,
        },
        tasks: [
          {
            taskId: new mongoose.Types.ObjectId(),
            order: 0,
            title: 'Доставка оборудования',
            start: { lat: 50.4, lng: 30.45 },
            finish: { lat: 50.42, lng: 30.5 },
            startAddress: 'Склад С',
            finishAddress: 'Цех D',
            distanceKm: 40.2,
            windowStart: null,
            windowEnd: null,
            cargoWeightKg: 1.2,
          },
        ],
        stops: [
          {
            order: 0,
            kind: 'start',
            taskId: new mongoose.Types.ObjectId(),
            coordinates: { lat: 50.4, lng: 30.45 },
            address: 'Склад С',
            etaMinutes: 5,
            load: 2.1,
            delayMinutes: 0,
          },
          {
            order: 1,
            kind: 'finish',
            taskId: new mongoose.Types.ObjectId(),
            coordinates: { lat: 50.42, lng: 30.5 },
            address: 'Цех D',
            etaMinutes: 150,
            load: 0,
            delayMinutes: 12,
          },
        ],
      },
    ],
    tasks: [],
  });

  await RoutePlan.create({
    title: 'Черновой план',
    status: 'draft',
    createdAt: new Date('2024-10-08T07:00:00Z'),
    metrics: {
      totalDistanceKm: 25,
      totalRoutes: 1,
      totalTasks: 1,
      totalStops: 1,
      totalEtaMinutes: 90,
      totalLoad: 1,
    },
    routes: [],
    tasks: [],
  });
});

describe('GET /api/v1/analytics/route-plans/summary', () => {
  it('возвращает агрегированные метрики по пробегу, загрузке и SLA', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/route-plans/summary')
      .query({ from: '2024-10-09', to: '2024-10-10', status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.mileage.total).toBe(160.7);
    expect(res.body.mileage.byPeriod).toEqual([
      { date: '2024-10-09', value: 40.2 },
      { date: '2024-10-10', value: 120.5 },
    ]);
    expect(res.body.load.average).toBe(2.8);
    expect(res.body.load.byPeriod).toEqual([
      { date: '2024-10-09', value: 2.1 },
      { date: '2024-10-10', value: 3.5 },
    ]);
    expect(res.body.sla.average).toBe(0.5);
    expect(res.body.sla.byPeriod).toEqual([
      { date: '2024-10-09', onTime: 0, total: 1, rate: 0 },
      { date: '2024-10-10', onTime: 1, total: 1, rate: 1 },
    ]);
  });

  it('отклоняет некорректную дату', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/route-plans/summary')
      .query({ from: 'invalid-date' });
    expect(res.status).toBe(400);
  });
});
