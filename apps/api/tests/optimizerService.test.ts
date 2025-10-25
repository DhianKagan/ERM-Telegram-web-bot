// Назначение: автотесты сервиса оптимизации маршрутов.
// Модули: jest
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const mockSolveWithOrTools = jest.fn(async () => ({
  enabled: true,
  routes: [['__depot__', 'task-1', 'task-2']],
  totalDistanceKm: 12.3,
  totalDurationMinutes: 55,
  warnings: [],
}));

jest.mock('../src/services/vrp/orToolsAdapter', () => ({
  solveWithOrTools: (...args: unknown[]) => mockSolveWithOrTools(...args),
}));

const { optimize } = require('../src/services/optimizer');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

afterAll(() => {
  stopScheduler();
  stopQueue();
});

test('optimize возвращает маршруты и суммарные метрики', async () => {
  const result = await optimize(
    [
      {
        id: 'task-1',
        coordinates: { lat: 50.45, lng: 30.523 },
        demand: 2,
        serviceMinutes: 15,
      },
      {
        id: 'task-2',
        coordinates: { lat: 50.454, lng: 30.525 },
        demand: 1,
        serviceMinutes: 10,
      },
    ],
    { vehicleCapacity: 4, vehicleCount: 1 },
  );

  expect(result.routes).toHaveLength(1);
  expect(result.routes[0].taskIds).toEqual(['task-1', 'task-2']);
  expect(result.totalDistanceKm).toBeCloseTo(12.3, 1);
  expect(result.totalEtaMinutes).toBeGreaterThan(0);
  expect(result.totalLoad).toBeCloseTo(3, 1);
  expect(mockSolveWithOrTools).toHaveBeenCalledWith(
    expect.objectContaining({
      vehicle_capacity: 4,
      vehicle_count: 1,
    }),
  );
});

test('optimize обрабатывает ошибки VRP и возвращает предупреждение', async () => {
  mockSolveWithOrTools.mockRejectedValueOnce(new Error('solver failed'));
  const result = await optimize(
    [
      {
        id: 'task-1',
        coordinates: { lat: 50.45, lng: 30.523 },
      },
    ],
    { vehicleCapacity: 1, vehicleCount: 1 },
  );

  expect(result.routes).toHaveLength(0);
  expect(result.warnings[0]).toMatch(/Ошибка VRP/);
});
