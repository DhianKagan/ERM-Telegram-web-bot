// Назначение: автотесты. Модули: jest, supertest.
// Тесты проверки координат и переменных сервиса маршрутов
export {};

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';
process.env.ROUTING_URL = 'https://localhost:8000/route';

afterEach(() => {
  jest.resetAllMocks();
  jest.resetModules();
  jest.restoreAllMocks();
  delete process.env.ROUTE_TABLE_MAX_POINTS;
  delete process.env.ROUTE_TABLE_MIN_INTERVAL_MS;
  delete process.env.ROUTE_TABLE_GUARD;
});

test('table отклоняет некорректные координаты', async () => {
  jest.doMock('../src/metrics', () => ({
    osrmRequestDuration: { startTimer: () => () => {} },
    osrmErrorsTotal: { inc: jest.fn() },
  }));
  const { table } = require('../src/services/route');
  global.fetch = jest.fn();
  await expect(table('1,1;../../../etc', {})).rejects.toThrow(
    'Некорректные координаты',
  );
  expect(fetch).not.toHaveBeenCalled();
});

test('использует дефолт ROUTE_TABLE_MAX_POINTS при отрицательном значении', async () => {
  process.env.ROUTE_TABLE_GUARD = '1';
  process.env.ROUTE_TABLE_MAX_POINTS = '-1';
  const warn = jest.spyOn(console, 'warn').mockImplementation();
  jest.doMock('../src/metrics', () => ({
    osrmRequestDuration: { startTimer: () => () => {} },
    osrmErrorsTotal: { inc: jest.fn() },
  }));
  const { table } = require('../src/services/route');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  });
  await expect(table('1,1;2,2', {})).resolves.toBeDefined();
  expect(fetch).toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith(
    'ROUTE_TABLE_MAX_POINTS должен быть положительным. Используется значение по умолчанию 100',
  );
});

test('использует дефолт ROUTE_TABLE_MIN_INTERVAL_MS при отрицательном значении', async () => {
  process.env.ROUTE_TABLE_GUARD = '1';
  process.env.ROUTE_TABLE_MIN_INTERVAL_MS = '-5';
  const warn = jest.spyOn(console, 'warn').mockImplementation();
  jest.doMock('../src/metrics', () => ({
    osrmRequestDuration: { startTimer: () => () => {} },
    osrmErrorsTotal: { inc: jest.fn() },
  }));
  const { table } = require('../src/services/route');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  });
  await table('1,1;2,2', {});
  const mid = Date.now();
  await table('1,1;2,2', {});
  const diff = Date.now() - mid;
  // Допускаем 20 мс погрешности таймеров, чтобы избежать флаки
  expect(diff).toBeGreaterThanOrEqual(180);
  expect(warn).toHaveBeenCalledWith(
    'ROUTE_TABLE_MIN_INTERVAL_MS должен быть положительным. Используется значение по умолчанию 200',
  );
});
