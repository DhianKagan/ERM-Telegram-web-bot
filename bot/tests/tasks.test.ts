// Назначение: автотесты. Модули: jest, supertest.
// Интеграционные тесты маршрутов /api/tasks с моками модели
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';
const request = require('supertest');
const express = require('express');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

jest.mock('../src/services/route', () => ({
  getRouteDistance: jest.fn(async () => ({ distance: 1000 })),
  clearRouteCache: jest.fn(),
}));
jest.mock('../src/services/maps', () => ({
  generateRouteLink: jest.fn(() => 'g'),
  expandMapsUrl: jest.fn(),
  extractCoords: jest.fn(),
}));

jest.mock('../src/db/model', () => ({
  Task: {
    create: jest.fn(async (d) => ({
      _id: '1',
      request_id: 'ERM_000001',
      ...d,
      title: `ERM_000001 ${d.title}`,
      status: 'Новая',
      time_spent: 0,
    })),
    findByIdAndUpdate: jest.fn(async (_id, d) => ({ _id, ...d })),
    findById: jest.fn(async () => ({ time_spent: 0, save: jest.fn() })),
    findByIdAndDelete: jest.fn(async () => ({
      _id: '1',
      request_id: 'ERM_000001',
      toObject() {
        return { _id: '1', request_id: 'ERM_000001' };
      },
    })),
    updateMany: jest.fn(async () => null),
    aggregate: jest.fn(async () => [{ count: 2, time: 30 }]),
    find: jest.fn(async () => []),
  },
  Archive: { create: jest.fn(async () => ({})) },
}));

jest.mock('../src/services/service', () => ({ writeLog: jest.fn() }));

const queries = require('../src/db/queries');
jest
  .spyOn(queries, 'getUsersMap')
  .mockResolvedValue({ 1: { telegram_id: 1, name: 'User' } });

jest.mock('../src/api/middleware', () => ({
  verifyToken: (req, _res, next) => {
    req.user = { role: 'admin', id: 1, access: 2 };
    next();
  },
  asyncHandler: (fn) => fn,
  errorHandler: (err, _req, res, _next) =>
    res.status(500).json({ error: err.message }),
  checkRole: () => (_req, _res, next) => next(),
  checkTaskAccess: (_req, _res, next) => next(),
}));

jest.mock('../src/middleware/taskAccess', () => (_req, _res, next) => next());

const router = require('../src/routes/tasks').default;
const { Task, Archive } = require('../src/db/model');

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/v1/tasks', router);
});

test('создание задачи возвращает 201', async () => {
  const res = await request(app)
    .post('/api/v1/tasks')
    .send({
      title: 'T',
      start_location_link: 'https://maps.google.com',
      end_location_link: 'https://maps.google.com',
      startCoordinates: { lat: 1, lng: 2 },
      finishCoordinates: { lat: 3, lng: 4 },
      start_date: '2025-01-01T10:00',
    });
  expect(res.status).toBe(201);
  expect(res.body.title).toBe('ERM_000001 T');
  expect(Task.create).toHaveBeenCalledWith(
    expect.objectContaining({
      start_date: '2025-01-01T10:00',
      google_route_url: 'g',
      route_distance_km: 1,
    }),
  );
});

test('создание задачи с неверными данными', async () => {
  const res = await request(app).post('/api/v1/tasks').send({ title: 1 });
  expect(res.status).toBe(400);
});

const id = '507f191e810c19729de860ea';

test('обновление задачи', async () => {
  const res = await request(app)
    .patch(`/api/v1/tasks/${id}`)
    .send({ status: 'Выполнена' });
  expect(res.body.status).toBe('Выполнена');
});

test('добавление времени', async () => {
  await request(app).patch(`/api/v1/tasks/${id}/time`).send({ minutes: 15 });
  expect(Task.findById).toHaveBeenCalled();
});

test('ошибка валидации времени', async () => {
  const res = await request(app).patch(`/api/v1/tasks/${id}/time`).send({});
  expect(res.status).toBe(400);
});

test('bulk update статуса', async () => {
  await request(app)
    .post('/api/v1/tasks/bulk')
    .send({ ids: [id, id], status: 'Выполнена' });
  expect(Task.updateMany).toHaveBeenCalled();
});

test('получение списка задач возвращает пользователей', async () => {
  Task.find.mockResolvedValueOnce([
    { _id: '1', assignees: [1], controllers: [], created_by: 1 },
  ]);
  const res = await request(app).get('/api/v1/tasks');
  expect(res.body.users['1'].name).toBe('User');
  expect(Array.isArray(res.body.tasks)).toBe(true);
});

test('summary report возвращает метрики', async () => {
  const res = await request(app).get('/api/v1/tasks/report/summary');
  expect(res.body.count).toBe(2);
  expect(res.body.time).toBe(30);
});

test('summary report c фильтром дат', async () => {
  const res = await request(app).get(
    '/api/v1/tasks/report/summary?from=2024-01-01&to=2024-12-31',
  );
  expect(res.body.count).toBe(2);
  expect(res.body.time).toBe(30);
});

test('удаление задачи', async () => {
  const res = await request(app).delete(`/api/v1/tasks/${id}`);
  expect(res.status).toBe(204);
  expect(Archive.create).toHaveBeenCalledWith(
    expect.objectContaining({ request_id: 'ERM_000001-DEL' }),
  );
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
