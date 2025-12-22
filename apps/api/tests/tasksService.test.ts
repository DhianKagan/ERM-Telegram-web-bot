// Назначение: автотесты. Модули: jest, supertest.
// Тесты сервиса задач
import * as osrmClient from '../src/geo/osrm';
import { generateRouteLink, type TaskPoint } from 'shared';
import TasksService from '../src/tasks/tasks.service';
import { writeLog } from '../src/services/wgLogEngine';
import type { TaskDocument } from '../src/db/model';

process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';
process.env.QUEUE_REDIS_URL = '';

jest.mock('../src/config/queue', () => ({
  queueConfig: {
    enabled: false,
    connection: null,
    prefix: 'erm',
    attempts: 3,
    backoffMs: 5000,
    jobTimeoutMs: 30000,
    metricsIntervalMs: 15000,
  },
}));

jest.mock('../src/services/route', () => ({
  clearRouteCache: jest.fn(),
}));

jest.mock('../src/geo/osrm', () => ({
  getOsrmDistance: jest.fn(async () => 5),
}));

jest.mock('../src/services/wgLogEngine', () => ({
  writeLog: jest.fn().mockResolvedValue(undefined),
}));

const mockedWriteLog = writeLog as jest.Mock;

function createRepo() {
  return {
    createTask: jest.fn(async (d) => ({ id: '1', ...d })),
    getTasks: jest.fn(async () => ({ tasks: [], total: 0 })),
    getTask: jest.fn(),
    updateTask: jest.fn(async (_id, d) => ({ _id, ...d })),
    addTime: jest.fn(),
    bulkUpdate: jest.fn(),
    summary: jest.fn(),
    chart: jest.fn(),
    deleteTask: jest.fn(),
    listMentionedTasks: jest.fn(),
  };
}

test('create заполняет ссылку и дистанцию', async () => {
  const repo = createRepo();
  const service = new TasksService(repo);
  const task = await service.create({
    startCoordinates: { lat: 0, lng: 0 },
    finishCoordinates: { lat: 1, lng: 1 },
  });
  expect(repo.createTask).toHaveBeenCalled();
  const expectedUrl = generateRouteLink({ lat: 0, lng: 0 }, { lat: 1, lng: 1 });
  expect(task.google_route_url).toBe(expectedUrl);
  expect(task.route_distance_km).toBe(5);
  expect(osrmClient.getOsrmDistance).toHaveBeenCalled();
});

test('create использует points для маршрута и координат', async () => {
  const repo = createRepo();
  const service = new TasksService(repo);
  const task = await service.create({
    points: [
      { order: 0, kind: 'start', coordinates: { lat: 10, lng: 20 } },
      { order: 1, kind: 'finish', coordinates: { lat: 11, lng: 21 } },
    ] satisfies TaskPoint[],
  });
  expect(repo.createTask).toHaveBeenCalled();
  const expectedUrl = generateRouteLink(
    { lat: 10, lng: 20 },
    { lat: 11, lng: 21 },
  );
  expect(task.google_route_url).toBe(expectedUrl);
  expect(task.startCoordinates).toEqual({ lat: 10, lng: 20 });
  expect(task.finishCoordinates).toEqual({ lat: 11, lng: 21 });
  expect(task.points).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'start',
        coordinates: { lat: 10, lng: 20 },
      }),
      expect.objectContaining({
        kind: 'finish',
        coordinates: { lat: 11, lng: 21 },
      }),
    ]),
  );
});

test('update пересчитывает ссылку и дистанцию', async () => {
  const repo = createRepo();
  const service = new TasksService(repo);
  const task = await service.update(
    '1',
    {
      startCoordinates: { lat: 0, lng: 0 },
      finishCoordinates: { lat: 1, lng: 1 },
    },
    1,
  );
  expect(repo.updateTask).toHaveBeenCalledWith(
    '1',
    expect.any(Object),
    1,
    {},
  );
  const expectedUrl = generateRouteLink({ lat: 0, lng: 0 }, { lat: 1, lng: 1 });
  expect(task.google_route_url).toBe(expectedUrl);
  expect(task.route_distance_km).toBe(5);
});

test('update не падает без данных', async () => {
  const repo = createRepo();
  const service = new TasksService(repo);
  const emptyPayload = undefined as unknown as Partial<TaskDocument>;
  const task = await service.update('1', emptyPayload, 1);
  expect(repo.updateTask).toHaveBeenCalledWith('1', {}, 1, {});
  expect(task).toEqual({ _id: '1' });
});

test('create не падает без данных', async () => {
  const repo = createRepo();
  const service = new TasksService(repo);
  const emptyPayload = undefined as unknown as Partial<TaskDocument>;
  const task = await service.create(emptyPayload);
  expect(repo.createTask).toHaveBeenCalledWith({}, undefined);
  expect(task).toEqual({ id: '1' });
});

test('create передаёт идентификатор пользователя в репозиторий', async () => {
  const repo = createRepo();
  const service = new TasksService(repo);
  await service.create({}, 42);
  expect(repo.createTask).toHaveBeenCalledWith({}, 42);
});

test('create логирует fallback для вложений без userId', async () => {
  mockedWriteLog.mockClear();
  const repo = createRepo();
  const service = new TasksService(repo);
  await service.create({
    attachments: [
      {
        name: 'fallback.txt',
        url: '/api/v1/files/507f1f77bcf86cd799439011',
        uploadedAt: new Date(),
        type: 'text/plain',
        size: 1,
      },
    ],
  });
  expect(mockedWriteLog).toHaveBeenCalledWith(
    'Создание задачи с вложениями без идентификатора пользователя, активирован fallback',
    'warn',
    expect.objectContaining({ fallback: true, attachments: 1 }),
  );
});

test('bulk выставляет completed_at для финальных статусов', async () => {
  const repo = createRepo();
  const service = new TasksService(repo);
  const payload: Partial<TaskDocument> = { status: 'Выполнена' };
  await service.bulk(['1'], payload);
  expect(repo.bulkUpdate).toHaveBeenCalledTimes(1);
  const callPayload = repo.bulkUpdate.mock.calls[0][1];
  expect(callPayload.status).toBe('Выполнена');
  expect(callPayload.completed_at).toBeInstanceOf(Date);
});

test('bulk сбрасывает completed_at при возврате статуса', async () => {
  const repo = createRepo();
  const service = new TasksService(repo);
  const date = new Date();
  const payload: Partial<TaskDocument> = {
    status: 'В работе',
    completed_at: date,
  };
  await service.bulk(['1'], payload);
  expect(repo.bulkUpdate).toHaveBeenCalledTimes(1);
  const callPayload = repo.bulkUpdate.mock.calls[0][1];
  expect(callPayload.status).toBe('В работе');
  expect(callPayload.completed_at).toBeNull();
});
