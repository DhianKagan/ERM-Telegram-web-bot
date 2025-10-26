// Назначение: автотесты. Модули: jest, supertest.
// Интеграционные тесты маршрутов /api/tasks с моками модели
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

let lastTaskQueryItems = [];

const createTaskQueryResult = (items = []) => {
  lastTaskQueryItems = items;
  const query = {
    select: jest.fn(() => query),
    limit: jest.fn(() => query),
    skip: jest.fn(() => query),
    sort: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(items),
    exec: jest.fn().mockResolvedValue(items),
    then: jest.fn((resolve, reject) =>
      Promise.resolve(items).then(resolve, reject),
    ),
    catch: jest.fn((reject) => Promise.resolve(items).catch(reject)),
    finally: jest.fn((onFinally) =>
      Promise.resolve(items).finally(onFinally),
    ),
  };
  return query;
};

const request = require('supertest');
const express = require('express');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');
const { generateRouteLink } = require('shared');

jest.mock('../src/services/route', () => ({
  getRouteDistance: jest.fn(async () => ({ distance: 1000 })),
  clearRouteCache: jest.fn(),
}));

const mockDeleteMessage = jest.fn().mockResolvedValue(undefined);
const mockSendMessage = jest.fn().mockResolvedValue({ message_id: 100 });
const mockEditMessageMedia = jest.fn().mockResolvedValue(undefined);
const mockEditMessageText = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/bot/bot', () => ({
  bot: {
    telegram: {
      deleteMessage: mockDeleteMessage,
      sendMessage: mockSendMessage,
      editMessageMedia: mockEditMessageMedia,
      editMessageText: mockEditMessageText,
    },
  },
  buildTaskAppLink: jest.fn(() => null),
  buildDirectTaskKeyboard: jest.fn(() => null),
  buildDirectTaskMessage: jest.fn(() => ''),
}));

jest.mock('../src/db/model', () => ({
  Task: {
    create: jest.fn(async (d) => ({
      _id: '1',
      request_id: 'ERM_000001',
      task_number: 'ERM_000001',
      ...d,
      title: d.title,
      status: 'Новая',
      time_spent: 0,
    })),
    findOneAndUpdate: jest.fn(async (query, d) => ({ _id: query._id, ...(d.$set || d) })),
    findById: jest.fn(async () => ({
      _id: '1',
      time_spent: 0,
      save: jest.fn(),
      history: [],
      created_by: 1,
      telegram_topic_id: 777,
      telegram_message_id: 321,
      telegram_history_message_id: 322,
      telegram_summary_message_id: 323,
      telegram_status_message_id: 324,
      telegram_preview_message_ids: [401, 402],
      telegram_attachments_message_ids: [501],
      telegram_dm_message_ids: [{ user_id: 7, message_id: 601 }],
    })),
    findByIdAndUpdate: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(null) })),
    findByIdAndDelete: jest.fn(async () => ({
      _id: '507f191e810c19729de860ea',
      request_id: 'ERM_000001',
      task_number: 'ERM_000001',
      created_by: 1,
      toObject() {
        return {
          _id: '507f191e810c19729de860ea',
          request_id: 'ERM_000001',
          task_number: 'ERM_000001',
          created_by: 1,
        };
      },
    })),
    updateMany: jest.fn(async () => null),
    aggregate: jest.fn(async () => [{ count: 2, time: 30 }]),
    find: jest.fn(() => createTaskQueryResult()),
    countDocuments: jest.fn(async () => lastTaskQueryItems.length),
  },
  Archive: { create: jest.fn(async () => ({})) },
  File: {
    find: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue([]),
    })),
    deleteMany: jest.fn(() => ({
      exec: jest.fn().mockResolvedValue(null),
    })),
  },
}));

const mockWriteLog = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/services/service', () => ({ writeLog: mockWriteLog }));

const queries = require('../src/db/queries');
jest
  .spyOn(queries, 'getUsersMap')
  .mockResolvedValue({ 1: { telegram_id: 1, name: 'User' } });

jest.mock('../src/api/middleware', () => ({
  verifyToken: (req, _res, next) => {
    const role = String(req.headers['x-role'] || 'admin');
    const access = Number(req.headers['x-access'] || 6);
    req.user = { role, id: 1, telegram_id: 1, access };
    next();
  },
  asyncHandler: (fn) => fn,
  errorHandler: (err, _req, res, _next) =>
    res.status(500).json({ error: err.message }),
  checkRole: () => (_req, _res, next) => next(),
  checkTaskAccess: (_req, _res, next) => next(),
}));

jest.mock('../src/middleware/taskAccess', () => (_req, _res, next) => next());

const { taskFormSchema } = require('shared');
const router = require('../src/routes/tasks').default;
const { Task, Archive } = require('../src/db/model');
const { ACCESS_TASK_DELETE } = require('../src/utils/accessMask');

const { formVersion: validFormVersion } = taskFormSchema;

let app;
beforeEach(() => {
  lastTaskQueryItems = [];
  mockDeleteMessage.mockClear();
  mockSendMessage.mockClear();
  mockEditMessageMedia.mockClear();
  mockEditMessageText.mockClear();
  Task.find.mockClear();
  Task.countDocuments.mockClear();
  Task.find.mockImplementation(() => createTaskQueryResult());
  Task.countDocuments.mockImplementation(async () => lastTaskQueryItems.length);
});
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/v1/tasks', router);
});

test('создание задачи возвращает 201', async () => {
  const res = await request(app)
    .post('/api/v1/tasks')
    .send({
      formVersion: validFormVersion,
      title: 'T',
      assigned_user_id: 1,
      start_location_link: 'https://maps.google.com',
      end_location_link: 'https://maps.google.com',
      startCoordinates: { lat: 1, lng: 2 },
      finishCoordinates: { lat: 3, lng: 4 },
      start_date: '2025-01-01T10:00',
    });
  expect(res.status).toBe(201);
  expect(res.body.title).toBe('T');
  expect(res.body.task_number).toBe('ERM_000001');
  const expectedUrl = generateRouteLink({ lat: 1, lng: 2 }, { lat: 3, lng: 4 });
  expect(Task.create).toHaveBeenCalledWith(
    expect.objectContaining({
      assigned_user_id: 1,
      assignees: [1],
      start_date: '2025-01-01T10:00',
      google_route_url: expectedUrl,
      route_distance_km: 1,
    }),
  );
});

test('создание задачи без исполнителей возвращает 400', async () => {
  const res = await request(app)
    .post('/api/v1/tasks')
    .send({
      formVersion: validFormVersion,
      title: 'T',
      assignees: [''],
    });
  expect(res.status).toBe(400);
  const messages = Array.isArray(res.body?.errors)
    ? res.body.errors.map((err) => err.msg)
    : [];
  expect(messages).toContain('Укажите хотя бы одного исполнителя');
});

test('создание задачи через multipart', async () => {
  const res = await request(app)
    .post('/api/v1/tasks')
    .field('formVersion', String(validFormVersion))
    .field('title', 'T')
    .field('assignees', '1')
    .field('assignees', '2');
  expect(res.status).toBe(201);
});

test('создание задачи с неверными данными', async () => {
  const res = await request(app)
    .post('/api/v1/tasks')
    .send({ formVersion: validFormVersion, title: 1 });
  expect(res.status).toBe(400);
});

test('создание задачи с неизвестной версией формы', async () => {
  const res = await request(app)
    .post('/api/v1/tasks')
    .send({ formVersion: validFormVersion + 1, title: 'T' });
  expect(res.status).toBe(400);
});

const id = '507f191e810c19729de860ea';

test('обновление задачи', async () => {
  const res = await request(app)
    .patch(`/api/v1/tasks/${id}`)
    .send({ status: 'Выполнена' });
  expect(res.body.status).toBe('Выполнена');
});

test('обновление задачи доступно назначенному пользователю без прав менеджера', async () => {
  const res = await request(app)
    .patch(`/api/v1/tasks/${id}`)
    .set('x-access', String(1))
    .send({ title: 'Обновлённая задача' });
  expect(res.status).toBe(200);
  expect(res.body.title).toBe('Обновлённая задача');
});

test('обновление с очисткой габаритов проходит валидацию', async () => {
  const res = await request(app)
    .patch(`/api/v1/tasks/${id}`)
    .send({ cargo_length_m: '', cargo_weight_kg: '   ' });
  expect(res.status).toBe(200);
  const [, update] = Task.findOneAndUpdate.mock.calls.at(-1);
  expect(update.$set).not.toHaveProperty('cargo_length_m', '');
  expect(update.$set).not.toHaveProperty('cargo_weight_kg', '   ');
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
  Task.find.mockReturnValueOnce(
    createTaskQueryResult([
      { _id: '1', assignees: [1], controllers: [], created_by: 1 },
    ]),
  );
  const res = await request(app).get('/api/v1/tasks');
  expect(res.body.users['1'].name).toBe('User');
  expect(Array.isArray(res.body.tasks)).toBe(true);
  expect(res.body.total).toBe(1);
});

test('получение всех задач для роли manager', async () => {
  Task.find.mockReturnValueOnce(
    createTaskQueryResult([
      { _id: '1', assignees: [1], controllers: [], created_by: 1 },
    ]),
  );
  const res = await request(app).get('/api/v1/tasks').set('x-role', 'manager');
  expect(res.body.total).toBe(1);
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

test('удаление задачи доступно только уровню 8', async () => {
  const res = await request(app)
    .delete(`/api/v1/tasks/${id}`)
    .set('x-access', String(ACCESS_TASK_DELETE));
  expect(res.status).toBe(204);
  expect(Archive.create).toHaveBeenCalledWith(
    expect.objectContaining({
      request_id: 'ERM_000001-DEL',
      task_number: 'ERM_000001-DEL',
      archived_at: expect.any(Date),
      archived_by: 1,
    }),
  );
  expect(mockDeleteMessage).toHaveBeenCalledWith('1', 321);
  expect(mockDeleteMessage).toHaveBeenCalledWith('1', 322);
  expect(mockDeleteMessage).toHaveBeenCalledWith('1', 323);
  expect(mockDeleteMessage).toHaveBeenCalledWith('1', 324);
  expect(mockDeleteMessage).toHaveBeenCalledWith('1', 401);
  expect(mockDeleteMessage).toHaveBeenCalledWith('1', 402);
  expect(mockDeleteMessage).toHaveBeenCalledWith('1', 501);
  expect(mockDeleteMessage).toHaveBeenCalledWith(7, 601);
});

test('удаление задачи недоступно обычному администратору', async () => {
  Archive.create.mockClear();
  const res = await request(app)
    .delete(`/api/v1/tasks/${id}`)
    .set('x-access', '6');
  expect(res.status).toBe(403);
  expect(Archive.create).not.toHaveBeenCalledWith(
    expect.objectContaining({ request_id: 'ERM_000001-DEL' }),
  );
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
