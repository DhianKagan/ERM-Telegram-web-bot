// Назначение: автотесты. Модули: jest, supertest.
// Тест распределения задач между транспортом
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const ids = [
  '507f1f77bcf86cd799439011',
  '507f1f77bcf86cd799439012',
  '507f1f77bcf86cd799439013',
];

const mockTasks = {
  [ids[0]]: {
    _id: ids[0],
    title: 'Задача 1',
    startCoordinates: { lat: 0, lng: 0 },
    finishCoordinates: { lat: 0, lng: 1 },
  },
  [ids[1]]: {
    _id: ids[1],
    title: 'Задача 2',
    startCoordinates: { lat: 0, lng: 2 },
    finishCoordinates: { lat: 0, lng: 3 },
  },
  [ids[2]]: {
    _id: ids[2],
    title: 'Задача 3',
    startCoordinates: { lat: 0, lng: 4 },
    finishCoordinates: { lat: 0, lng: 5 },
  },
};

jest.mock('../src/db/queries', () => ({
  getTask: jest.fn((id) => Promise.resolve(mockTasks[id])),
}));

jest.mock('../src/services/route', () => ({
  trip: jest.fn(async () => ({
    trips: [{ waypoints: [{ waypoint_index: 0 }, { waypoint_index: 1 }] }],
  })),
}));

jest.mock('../src/services/routePlans', () => ({
  createDraftFromInputs: jest.fn(async (routes, options) => ({
    id: 'plan-id',
    title: 'План',
    status: 'draft',
    suggestedBy: options?.actorId ?? null,
    method: options?.method,
    count: options?.count,
    notes: null,
    approvedBy: null,
    approvedAt: null,
    completedBy: null,
    completedAt: null,
    metrics: {
      totalRoutes: routes.length,
      totalTasks: routes.reduce((sum, route) => sum + route.tasks.length, 0),
      totalStops: 0,
      totalDistanceKm: null,
    },
    routes: routes.map((route, index) => ({
      id: route.id ?? `route-${index}`,
      order: index,
      vehicleId: null,
      vehicleName: null,
      driverId: null,
      driverName: null,
      notes: null,
      routeLink: null,
      metrics: { tasks: route.tasks.length, stops: 0, distanceKm: null },
      stops: [],
      tasks: route.tasks.map((taskId, taskIndex) => ({
        taskId,
        order: taskIndex,
        title: `Task ${taskId}`,
      })),
    })),
    tasks: routes.flatMap((route) => route.tasks),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
}));

const { optimize } = require('../src/services/optimizer');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

afterAll(() => {
  stopScheduler();
  stopQueue();
});

test('optimize распределяет задачи между машинами', async () => {
  const plan = await optimize(ids, 2);
  expect(plan).not.toBeNull();
  expect(plan?.routes.length).toBe(2);
  const all = plan
    ? plan.routes.flatMap((route) => route.tasks.map((task) => task.taskId))
    : [];
  expect(new Set(all)).toEqual(new Set(ids));
});

test('optimize с методом trip вызывает сервис trip', async () => {
  const { trip } = require('../src/services/route');
  const plan = await optimize(ids.slice(0, 2), 1, 'trip');
  expect(trip).toHaveBeenCalled();
  expect(plan).not.toBeNull();
  expect(plan?.routes[0]?.tasks.length).toBe(2);
});
