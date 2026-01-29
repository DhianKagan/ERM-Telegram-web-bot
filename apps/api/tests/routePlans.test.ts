// Назначение: проверка POST /api/v1/route-plans
// Основные модули: jest, supertest, express
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

import express from 'express';
import request from 'supertest';

const createDraftFromInputs = jest.fn(async () => ({
  id: 'plan-1',
  title: 'LOG_00000',
  status: 'draft',
  notes: null,
  routes: [],
  tasks: [],
  metrics: {
    totalDistanceKm: null,
    totalRoutes: 0,
    totalTasks: 0,
    totalStops: 0,
    totalEtaMinutes: null,
    totalLoad: null,
  },
  createdAt: '2024-01-10T10:00:00.000Z',
  updatedAt: '2024-01-10T10:00:00.000Z',
}));

jest.mock('../src/middleware/auth', () => () => (req, _res, next) => {
  req.user = { id: 42 };
  next();
});

jest.mock('../src/api/middleware', () => ({
  asyncHandler: (fn) => fn,
}));

jest.mock('../src/services/routePlans', () => ({
  createDraftFromInputs: (...args) => createDraftFromInputs(...args),
  listPlans: jest.fn(),
  getPlan: jest.fn(),
  updatePlan: jest.fn(),
  updatePlanStatus: jest.fn(),
  removePlan: jest.fn(),
}));

import errorMiddleware from '../src/middleware/errorMiddleware';
import routePlansRouter from '../src/routes/routePlans';

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/v1/route-plans', routePlansRouter);
  app.use(errorMiddleware);
});

afterEach(() => {
  createDraftFromInputs.mockClear();
});

test('POST /api/v1/route-plans создает маршрутный лист', async () => {
  const response = await request(app)
    .post('/api/v1/route-plans')
    .send({
      title: 'Тестовый лист',
      notes: 'Заметка',
      creatorId: 5,
      executorId: 7,
      companyPointIds: ['point-1'],
      transportId: 'transport-1',
      transportName: 'Газель',
      tasks: ['task-2'],
      routes: [{ tasks: ['task-1'] }],
    });

  expect(response.status).toBe(201);
  expect(response.body.plan.title).toBe('LOG_00000');
  expect(createDraftFromInputs).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ tasks: ['task-1'] })]),
    expect.objectContaining({
      actorId: 42,
      title: 'Тестовый лист',
      notes: 'Заметка',
      creatorId: 5,
      executorId: 7,
      companyPointIds: ['point-1'],
      transportId: 'transport-1',
      transportName: 'Газель',
      tasks: ['task-2'],
    }),
  );
});
