// Назначение: автотесты. Модули: jest, supertest.
// Тест оптимизации маршрута /api/v1/route-optimize
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

jest.mock('../src/api/middleware', () => ({
  verifyToken: (_req, _res, next) => next(),
  asyncHandler: (fn) => fn,
  errorHandler: (err, _req, res, _next) =>
    res.status(500).json({ error: err.message }),
}));

const { optimize } = require('../src/services/optimizer');
jest.mock('../src/services/optimizer', () => ({
  optimize: jest.fn(async () => ({
    routes: [
      {
        vehicleIndex: 0,
        taskIds: ['1'],
        distanceKm: 2.5,
        etaMinutes: 35,
        load: 1,
      },
    ],
    totalDistanceKm: 2.5,
    totalEtaMinutes: 35,
    totalLoad: 1,
    warnings: [],
  })),
}));
const router = require('../src/routes/optimizer').default;

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/v1/route-optimize', router);
});

test('POST /api/v1/route-optimize возвращает расчёт', async () => {
  const res = await request(app)
    .post('/api/v1/route-optimize')
    .send({
      tasks: [
        {
          id: '1',
          coordinates: { lat: 50.1, lng: 30.2 },
          demand: 1,
          serviceMinutes: 10,
        },
      ],
      vehicleCapacity: 10,
      vehicleCount: 1,
    });
  expect(res.status).toBe(200);
  expect(res.body.result).toBeTruthy();
  expect(Array.isArray(res.body.result.routes)).toBe(true);
  expect(optimize).toHaveBeenCalledWith(
    [
      {
        id: '1',
        coordinates: { lat: 50.1, lng: 30.2 },
        demand: 1,
        serviceMinutes: 10,
        timeWindow: undefined,
        title: undefined,
        startAddress: undefined,
        finishAddress: undefined,
      },
    ],
    {
      vehicleCapacity: 10,
      vehicleCount: 1,
      timeWindows: undefined,
      averageSpeedKmph: undefined,
    },
    undefined,
  );
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
