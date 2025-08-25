// Назначение: автотесты. Модули: jest, supertest.
// Тесты сервиса задач
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';

jest.mock('../src/services/route', () => ({
  getRouteDistance: jest.fn(async () => ({ distance: 5000 })),
  clearRouteCache: jest.fn(),
}));

const route = require('../src/services/route');
const { generateRouteLink } = require('shared');
const TasksService = require('../src/tasks/tasks.service.ts').default;

function createRepo() {
  return {
    createTask: jest.fn(async (d) => ({ id: '1', ...d })),
    getTasks: jest.fn(async () => ({ tasks: [], total: 0 })),
    getTask: jest.fn(),
    updateTask: jest.fn(async (_id, d) => ({ _id, ...d })),
    addTime: jest.fn(),
    bulkUpdate: jest.fn(),
    summary: jest.fn(),
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
  expect(route.getRouteDistance).toHaveBeenCalled();
});

test('update пересчитывает ссылку и дистанцию', async () => {
  const repo = createRepo();
  const service = new TasksService(repo);
  const task = await service.update('1', {
    startCoordinates: { lat: 0, lng: 0 },
    finishCoordinates: { lat: 1, lng: 1 },
  });
  expect(repo.updateTask).toHaveBeenCalledWith('1', expect.any(Object));
  const expectedUrl = generateRouteLink({ lat: 0, lng: 0 }, { lat: 1, lng: 1 });
  expect(task.google_route_url).toBe(expectedUrl);
  expect(task.route_distance_km).toBe(5);
});

test('update не падает без данных', async () => {
  const repo = createRepo();
  const service = new TasksService(repo);
  const task = await service.update('1', undefined as any);
  expect(repo.updateTask).toHaveBeenCalledWith('1', {});
  expect(task).toEqual({ _id: '1' });
});

test('create не падает без данных', async () => {
  const repo = createRepo();
  const service = new TasksService(repo);
  const task = await service.create(undefined as any);
  expect(repo.createTask).toHaveBeenCalledWith({});
  expect(task).toEqual({ id: '1' });
});
