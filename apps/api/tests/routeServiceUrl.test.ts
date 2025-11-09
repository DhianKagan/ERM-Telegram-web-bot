// Назначение: автотесты. Модули: jest, supertest.
// Тесты формирования URL сервисом маршрутов
process.env.ROUTING_URL = 'https://localhost:8000/route';
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const { table, nearest } = require('../src/services/route');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

afterEach(() => {
  jest.resetAllMocks();
});
afterAll(() => {
  stopScheduler();
  stopQueue();
});

test('table формирует корректный адрес', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({}) });
  await table('1,1;2,2', { annotations: 'distance' });
  const url = new URL(global.fetch.mock.calls[0][0]);
  expect(url.pathname).toBe('/table');
  expect(url.searchParams.get('points')).toBe('1,1;2,2');
  expect(url.searchParams.get('annotations')).toBe('distance');
});

test('nearest использует параметр point', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({}) });
  await nearest('1,1', { number: 1 });
  const url = new URL(global.fetch.mock.calls[0][0]);
  expect(url.pathname).toBe('/nearest');
  expect(url.searchParams.get('point')).toBe('1,1');
  expect(url.searchParams.get('number')).toBe('1');
});
