/**
 * Назначение файла: e2e-проверка агрегирующего эндпойнта аналитики маршрутных планов.
 * Основные модули: @playwright/test, express, mongodb-memory-server.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { routePlanSummary } from '../../apps/api/src/controllers/analytics';
import { RoutePlan } from '../../apps/api/src/db/models/routePlan';

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'token';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 'secret';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const app = express();
app.get('/api/v1/analytics/route-plans/summary', (req, res) => {
  routePlanSummary(req, res).catch((error) => {
    console.error('analytics route error', error);
    res.status(500).json({ error: 'internal' });
  });
});

let mongod: MongoMemoryServer;
let server: Server;
let baseURL: string;

async function seedPlans(): Promise<void> {
  await RoutePlan.deleteMany({});
  const taskId = new mongoose.Types.ObjectId();
  await RoutePlan.create({
    title: 'Аналитика 1',
    status: 'completed',
    completedAt: new Date('2024-10-10T09:00:00Z'),
    metrics: {
      totalDistanceKm: 80.4,
      totalRoutes: 1,
      totalTasks: 1,
      totalStops: 2,
      totalEtaMinutes: 220,
      totalLoad: 2.4,
    },
    routes: [
      {
        order: 0,
        vehicleId: new mongoose.Types.ObjectId(),
        vehicleName: 'Газель',
        driverId: 200,
        driverName: 'Андрей',
        metrics: {
          distanceKm: 80.4,
          load: 2.4,
          etaMinutes: 220,
          tasks: 1,
          stops: 2,
        },
        tasks: [
          {
            taskId,
            order: 0,
            title: 'Поставка мебели',
            start: { lat: 50.45, lng: 30.5 },
            finish: { lat: 50.48, lng: 30.52 },
            startAddress: 'Склад',
            finishAddress: 'Офис',
            distanceKm: 80.4,
            windowStart: null,
            windowEnd: null,
            cargoWeightKg: 2.4,
          },
        ],
        stops: [
          {
            order: 0,
            kind: 'start',
            taskId,
            coordinates: { lat: 50.45, lng: 30.5 },
            address: 'Склад',
            etaMinutes: 10,
            load: 2.4,
            delayMinutes: 0,
          },
          {
            order: 1,
            kind: 'finish',
            taskId,
            coordinates: { lat: 50.48, lng: 30.52 },
            address: 'Офис',
            etaMinutes: 150,
            load: 0,
            delayMinutes: null,
          },
        ],
      },
    ],
    tasks: [taskId],
  });

  await RoutePlan.create({
    title: 'Аналитика 2',
    status: 'completed',
    completedAt: new Date('2024-10-09T07:00:00Z'),
    metrics: {
      totalDistanceKm: 30.1,
      totalRoutes: 1,
      totalTasks: 1,
      totalStops: 2,
      totalEtaMinutes: 120,
      totalLoad: 1.6,
    },
    routes: [
      {
        order: 0,
        vehicleId: new mongoose.Types.ObjectId(),
        vehicleName: 'Пикап',
        driverId: 201,
        driverName: 'Сергей',
        metrics: {
          distanceKm: 30.1,
          load: 1.6,
          etaMinutes: 120,
          tasks: 1,
          stops: 2,
        },
        tasks: [
          {
            taskId: new mongoose.Types.ObjectId(),
            order: 0,
            title: 'Выездной монтаж',
            start: { lat: 50.4, lng: 30.45 },
            finish: { lat: 50.42, lng: 30.48 },
            startAddress: 'База',
            finishAddress: 'Объект',
            distanceKm: 30.1,
            windowStart: null,
            windowEnd: null,
            cargoWeightKg: 1.6,
          },
        ],
        stops: [
          {
            order: 0,
            kind: 'start',
            taskId: new mongoose.Types.ObjectId(),
            coordinates: { lat: 50.4, lng: 30.45 },
            address: 'База',
            etaMinutes: 5,
            load: 1.6,
            delayMinutes: 0,
          },
          {
            order: 1,
            kind: 'finish',
            taskId: new mongoose.Types.ObjectId(),
            coordinates: { lat: 50.42, lng: 30.48 },
            address: 'Объект',
            etaMinutes: 90,
            load: 0,
            delayMinutes: 6,
          },
        ],
      },
    ],
    tasks: [],
  });
}

test.beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseURL = `http://127.0.0.1:${port}`;
});

test.afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  server.close();
});

test.beforeEach(async () => {
  await seedPlans();
});

test('эндпойнт возвращает данные для дашборда', async ({ request }) => {
  const response = await request.get(
    `${baseURL}/api/v1/analytics/route-plans/summary?from=2024-10-09&to=2024-10-10&status=completed`,
  );
  expect(response.status()).toBe(200);
  const data = (await response.json()) as {
    mileage: { total: number };
    load: { average: number | null };
    sla: { average: number | null };
  };
  expect(data.mileage.total).toBeCloseTo(110.5, 1);
  expect(data.load.average).toBeCloseTo(2.0, 1);
  expect(data.sla.average).toBeCloseTo(0.5, 2);
});
